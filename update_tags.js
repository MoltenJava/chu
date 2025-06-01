import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in the .env file.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CHUNK_SIZE = 1000; // How many items to fetch from DB at a time

async function fetchAllMenuItems() {
    console.log(`Fetching all menu items from Supabase in chunks of ${CHUNK_SIZE}...`);
    let allItems = [];
    let offset = 0;
    let keepFetching = true;

    while (keepFetching) {
        console.log(`Fetching chunk starting at index ${offset}...`);
        const { data: chunk, error } = await supabase
            .from('menu_items')
            .select('id, name')
            .range(offset, offset + CHUNK_SIZE - 1); // Fetch range

        if (error) {
            throw new Error(`Error fetching menu items chunk: ${error.message}`);
        }

        if (chunk && chunk.length > 0) {
            allItems = allItems.concat(chunk);
            offset += chunk.length;
            console.log(`Fetched ${chunk.length} items. Total fetched: ${allItems.length}`);
            if (chunk.length < CHUNK_SIZE) {
                keepFetching = false; // Last chunk fetched
            }
        } else {
            keepFetching = false; // No more items
        }
    }
    console.log(`Finished fetching. Total items retrieved: ${allItems.length}`);
    return allItems;
}


async function updateDishTagsUpsertWithNameAll() {
    console.log("Starting tag update process (Upsert with Name, Fetching All)...");

    try {
        // 1. Read the JSON file
        console.log("Reading tagged_dishes_contextual.json...");
        const jsonFilePath = path.resolve('tagged_dishes_contextual.json');
        const jsonData = await fs.readFile(jsonFilePath, 'utf-8');
        const taggedDishes = JSON.parse(jsonData);
        console.log(`Read ${taggedDishes.length} items from JSON.`);

        // 2. Fetch ALL necessary menu item data (ID and Name) from Supabase
        const menuItems = await fetchAllMenuItems(); // Use the new fetching function

        if (!menuItems || menuItems.length === 0) {
             throw new Error("No menu items found in the database.");
        }

        // 3. Create a map for quick lookup: UUID -> Name
        console.log("Building UUID-to-Name map...");
        const uuidToNameMap = new Map();
        menuItems.forEach(dbItem => {
            if (dbItem.id && dbItem.name) { // Ensure we have both id and name
                 uuidToNameMap.set(dbItem.id, dbItem.name);
            }
        });
        console.log(`Built map with ${uuidToNameMap.size} items.`);


        // 4. Prepare the update payload (including the existing name)
        console.log("Preparing update payload...");
        const updatePayload = [];
        let itemsFoundInDb = 0;
        let itemsNotFoundInDb = 0;
        let itemsSkippedJson = 0;

        for (const taggedDish of taggedDishes) {
            const menuItemId = taggedDish.menu_item_uuid; // Adjust key if needed

            if (menuItemId && typeof menuItemId === 'string') {
                const currentName = uuidToNameMap.get(menuItemId);

                if (currentName) { // Only proceed if UUID exists in map and has a name
                    const tagsToUpdate = Array.isArray(taggedDish.subcategory_tags) ? taggedDish.subcategory_tags : [];
                    updatePayload.push({
                        id: menuItemId,
                        name: currentName,
                        dish_types: tagsToUpdate
                    });
                    itemsFoundInDb++;
                } else {
                    console.warn(`UUID ${menuItemId} from JSON not found in DB map.`);
                    itemsNotFoundInDb++;
                }
            } else {
                 console.warn(`Skipping JSON item due to missing/invalid UUID: ${JSON.stringify(taggedDish)}`);
                 itemsSkippedJson++;
            }
        }
        console.log(`Prepared payload: ${itemsFoundInDb} items matched in DB. ${itemsNotFoundInDb} UUIDs not found. ${itemsSkippedJson} items skipped from JSON.`);

        // 5. Perform bulk update/upsert
        if (updatePayload.length === 0) {
            console.log("No items found to update. Exiting.");
            return;
        }

        console.log(`Attempting to update ${updatePayload.length} items in Supabase using UPSERT...`);
        const upsertChunkSize = 500; // Keep upsert chunk size reasonable
        let updatedCount = 0;
        for (let i = 0; i < updatePayload.length; i += upsertChunkSize) {
            const chunk = updatePayload.slice(i, i + upsertChunkSize);
            console.log(`Processing upsert chunk ${Math.floor(i / upsertChunkSize) + 1}/${Math.ceil(updatePayload.length / upsertChunkSize)}...`);
            const { data: upsertData, error: upsertError } = await supabase
                .from('menu_items')
                .upsert(chunk, { onConflict: 'id' });

            if (upsertError) {
                 console.error(`Error updating chunk starting at index ${i}:`, upsertError.message);
            } else {
                updatedCount += chunk.length;
                console.log(`Chunk processed successfully.`);
            }
        }

        console.log(`----------------------------------------`);
        console.log(`Tag Update Summary (Upsert with Name - All Fetched):`);
        console.log(`  JSON Items Read: ${taggedDishes.length}`);
        console.log(`  DB Items Fetched: ${menuItems.length}`);
        console.log(`  Items Found/Matched in DB: ${itemsFoundInDb}`);
        console.log(`  Items Not Found/Matched in DB: ${itemsNotFoundInDb}`);
        console.log(`  Items Skipped from JSON: ${itemsSkippedJson}`);
        console.log(`  Items Attempted Update: ${updatePayload.length}`);
        console.log(`  Chunks Processed for Upsert: ${Math.ceil(updatePayload.length / upsertChunkSize)}`);
        console.log(`----------------------------------------`);
        console.log("Tag update process finished.");

    } catch (error) {
        console.error("An error occurred during the tag update process:", error);
        process.exit(1);
    }
}

updateDishTagsUpsertWithNameAll();