import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { SupabaseMenuItem, convertToSupabaseMenuItem, RpcMenuItemWithRestaurant, Restaurant } from '@/types/supabase';
import * as Sentry from '@sentry/react-native';
import { useLocationContext } from '../context/LocationContext';

// Constants for infinite scroll behavior
const ID_POOL_FETCH_SIZE = 300; // How many IDs to fetch for the pool at a time
const DETAILS_CHUNK_SIZE = 20;  // How many items' full details to fetch and display at once
const POOL_REPLENISH_THRESHOLD_PERCENT = 0.3; // Trigger replenish when 30% of pool (or less) is consumed or available

// Westwood, Los Angeles coordinates
const WESTWOOD_LOCATION = {
  coords: {
    latitude: 34.0633,
    longitude: -118.4478,
    accuracy: 5,
    altitude: 0,
    altitudeAccuracy: -1,
    heading: -1,
    speed: -1
  },
  timestamp: Date.now()
};

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Function to ensure average QualityScore for every 10 items
function ensureQualityScoreAverage(items: SupabaseMenuItem[]): SupabaseMenuItem[] {
  const CHUNK_SIZE = 10;
  const TARGET_AVERAGE = 0.8;
  const processedItems = [...items]; // Create a mutable copy

  for (let i = 0; i < processedItems.length; i += CHUNK_SIZE) {
    const chunk = processedItems.slice(i, i + CHUNK_SIZE);
    if (chunk.length === 0) continue;

    let currentChunkSum = chunk.reduce((sum, item) => sum + (item.QualityScore || 0), 0);
    let currentChunkAverage = currentChunkSum / chunk.length;

    if (currentChunkAverage >= TARGET_AVERAGE) {
      continue; // Average is already good for this chunk
    }

    // Attempt to improve the chunk's average
    for (let j = 0; j < chunk.length; j++) {
      if ((chunk[j].QualityScore || 0) < TARGET_AVERAGE) {
        // Look for a higher quality item outside the current chunk (and not yet processed)
        for (let k = i + CHUNK_SIZE; k < processedItems.length; k++) {
          if ((processedItems[k].QualityScore || 0) > (chunk[j].QualityScore || 0) && (processedItems[k].QualityScore || 0) > TARGET_AVERAGE) {
            // Swap items
            const temp = processedItems[i + j]; // item from current chunk
            processedItems[i + j] = processedItems[k];
            processedItems[k] = temp;

            // Recalculate chunk sum and average
            // It's simpler to recalculate the whole chunk's sum/avg after a swap
            const updatedChunk = processedItems.slice(i, i + CHUNK_SIZE);
            currentChunkSum = updatedChunk.reduce((sum, item) => sum + (item.QualityScore || 0), 0);
            currentChunkAverage = currentChunkSum / updatedChunk.length;
            
            // Update the current item in the outer loop to re-evaluate with the new item
            chunk[j] = processedItems[i+j];

            if (currentChunkAverage >= TARGET_AVERAGE) {
              break; // Target average met for this chunk
            }
          }
        }
      }
      if (currentChunkAverage >= TARGET_AVERAGE) {
        break; // Target average met for this chunk
      }
    }
  }
  return processedItems;
}

// Function to ensure average aesthetic_score for every 10 items
function ensureAestheticScoreAverage(items: SupabaseMenuItem[]): SupabaseMenuItem[] {
  const CHUNK_SIZE = 10;
  const TARGET_AVERAGE = 0.75; // Target average for aesthetic_score
  const processedItems = [...items]; // Create a mutable copy

  for (let i = 0; i < processedItems.length; i += CHUNK_SIZE) {
    const chunk = processedItems.slice(i, i + CHUNK_SIZE);
    if (chunk.length === 0) continue;

    let currentChunkSum = chunk.reduce((sum, item) => sum + (item.aesthetic_score || 0), 0);
    let currentChunkAverage = currentChunkSum / chunk.length;

    if (currentChunkAverage >= TARGET_AVERAGE) {
      continue; // Average is already good for this chunk
    }

    // Attempt to improve the chunk's average
    for (let j = 0; j < chunk.length; j++) {
      if ((chunk[j].aesthetic_score || 0) < TARGET_AVERAGE) {
        // Look for a higher aesthetic score item outside the current chunk (and not yet processed)
        for (let k = i + CHUNK_SIZE; k < processedItems.length; k++) {
          if ((processedItems[k].aesthetic_score || 0) > (chunk[j].aesthetic_score || 0) && (processedItems[k].aesthetic_score || 0) > TARGET_AVERAGE) {
            // Swap items
            const temp = processedItems[i + j]; // item from current chunk
            processedItems[i + j] = processedItems[k];
            processedItems[k] = temp;

            // Recalculate chunk sum and average
            const updatedChunk = processedItems.slice(i, i + CHUNK_SIZE);
            currentChunkSum = updatedChunk.reduce((sum, item) => sum + (item.aesthetic_score || 0), 0);
            currentChunkAverage = currentChunkSum / updatedChunk.length;
            
            // Update the current item in the outer loop to re-evaluate with the new item
            chunk[j] = processedItems[i+j];

            if (currentChunkAverage >= TARGET_AVERAGE) {
              break; // Target average met for this chunk
            }
          }
        }
      }
      if (currentChunkAverage >= TARGET_AVERAGE) {
        break; // Target average met for this chunk
      }
    }
  }
  return processedItems;
}

export function useMenuItems(selectedTags: string[] = []) {
  const { currentUserLocationForApp, simulatedLocationActive, actualUserLocation } = useLocationContext();

  const [itemIdsPool, setItemIdsPool] = useState<string[]>([]);
  const [displayedItems, setDisplayedItems] = useState<SupabaseMenuItem[]>([]);
  const [currentIndexInPool, setCurrentIndexInPool] = useState(0);

  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [isLoadingMoreIds, setIsLoadingMoreIds] = useState<boolean>(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [allIdsLoaded, setAllIdsLoaded] = useState<boolean>(false); // True if DB returns fewer IDs than requested
  const [error, setError] = useState<string | null>(null);
  
  // To prevent multiple concurrent fetches for the same thing
  const fetchIdsInProgress = useRef(false);
  const fetchDetailsInProgress = useRef(false);

  // Waiter mode
  const [currentRestaurantForWaiterMode, setCurrentRestaurantForWaiterMode] = useState<string | null>(null);
  const [waiterModeAnchorItem, setWaiterModeAnchorItem] = useState<SupabaseMenuItem | null>(null);
  console.log("[useMenuItems State] currentRestaurantForWaiterMode initialized/updated to:", currentRestaurantForWaiterMode);
  console.log("[useMenuItems State] waiterModeAnchorItem initialized/updated to:", waiterModeAnchorItem?.id);

  // Location related state (if you re-add useLocation)
  // const [location, setLocation] = useState<Location.LocationObject | null>(null);

  // Log the location from context
  useEffect(() => {
    console.log('[useMenuItems] Location context:', {
      appLocation: currentUserLocationForApp,
      isSimulated: simulatedLocationActive,
      actualLocation: actualUserLocation
    });
    // If appLocation is null here, it might indicate an issue with timing or context propagation.
    // We might need to prevent fetching if appLocation is not yet available.
    if (!currentUserLocationForApp) {
      console.warn('[useMenuItems] currentUserLocationForApp is null. Item fetching might be delayed or use defaults if any part relies on it.');
      // Potentially set an error state or return early if location is strictly required for initial fetch.
    }
  }, [currentUserLocationForApp, simulatedLocationActive, actualUserLocation]);

  // --- Helper: Reset state for a full refresh ---
  const resetStateForRefresh = () => {
    setItemIdsPool([]);
    setDisplayedItems([]);
    setCurrentIndexInPool(0);
    setAllIdsLoaded(false);
    setError(null);
    setLoadingInitial(true); // Will trigger initial loading states
    fetchIdsInProgress.current = false;
    fetchDetailsInProgress.current = false;
  };
  
  // --- Function to fetch IDs for the pool ---
  const fetchIdsForPool = useCallback(async (isInitialCall: boolean, currentFilterTags?: string[], waiterRestaurantId?: string | null) => {
    if (fetchIdsInProgress.current || allIdsLoaded) {
      // console.log('[useMenuItems] fetchIdsForPool: Skipped (already in progress or all IDs loaded)');
      return;
    }
    console.log(`[useMenuItems] fetchIdsForPool: START. isInitialCall: ${isInitialCall}, Filters: ${currentFilterTags ? currentFilterTags.join(',') : 'none'}, RestaurantID: ${waiterRestaurantId || 'none'}`);
    
    fetchIdsInProgress.current = true;
    if (!isInitialCall) setIsLoadingMoreIds(true);

    try {
      Sentry.addBreadcrumb({
        category: 'data.fetch.ids',
        message: 'Fetching item IDs for pool',
        data: { 
          currentPoolSize: itemIdsPool.length, 
          excludedCount: isInitialCall ? 0 : itemIdsPool.length,
          filters: currentFilterTags,
          restaurantId: waiterRestaurantId,
        }
      });
      const rpcParams: any = {
        limit_count: ID_POOL_FETCH_SIZE,
        excluded_ids: isInitialCall ? [] : itemIdsPool,
      };

      if (currentFilterTags && currentFilterTags.length > 0) {
        rpcParams.filter_tags = currentFilterTags;
      }
      if (waiterRestaurantId) {
        rpcParams.filter_restaurant_id = waiterRestaurantId;
      }

      const { data: newIdObjects, error: rpcError } = await supabase
        .rpc('get_random_menu_item_ids', rpcParams);

      if (rpcError) throw rpcError;

      const newIds = newIdObjects ? newIdObjects.map((item: { id: string }) => item.id) : [];
      
      if (newIds.length > 0) {
        setItemIdsPool(prevPool => {
          const uniqueNewIds = newIds.filter((id: string) => !prevPool.includes(id));
          return [...prevPool, ...uniqueNewIds];
        });
      }

      if (newIds.length < ID_POOL_FETCH_SIZE) {
        // console.log('[useMenuItems] fetchIdsForPool: All available unique IDs might have been loaded.');
        setAllIdsLoaded(true);
      }
      // If it's the initial call and we got IDs, or if the pool was empty and now has IDs, trigger details fetch
      if (isInitialCall && newIds.length > 0) {
         console.log(`[useMenuItems] fetchIdsForPool: Initial call got ${newIds.length} new IDs. Triggering fetchNextDetailsChunk.`);
         fetchNextDetailsChunk(true, newIds); // Pass newIds directly to fetch details immediately
      } else if (itemIdsPool.length === 0 && newIds.length > 0 && !isInitialCall) { // Ensure not initial call for this else if
         console.log(`[useMenuItems] fetchIdsForPool: Pool was empty/replenished, got ${newIds.length} new IDs. Triggering fetchNextDetailsChunk.`);
         fetchNextDetailsChunk(false, newIds);
      } else {
        console.log(`[useMenuItems] fetchIdsForPool: No new IDs or conditions not met to fetch details. New IDs length: ${newIds.length}, isInitialCall: ${isInitialCall}, itemIdsPool.length: ${itemIdsPool.length}`);
        // If this is an initial call and no IDs were fetched (e.g. filters yield nothing), ensure loadingInitial is false.
        if (isInitialCall && newIds.length === 0) {
            console.log("[useMenuItems] fetchIdsForPool: Initial call, no new IDs. Setting setLoadingInitial(false) directly.");
            setLoadingInitial(false);
        }
      }

    } catch (err: any) {
      console.error('[useMenuItems] Error fetching IDs for pool:', err);
      Sentry.captureException(err, { extra: { message: 'Error in fetchIdsForPool' } });
      setError(err.message || 'Failed to fetch item IDs');
    } finally {
      if (!isInitialCall) setIsLoadingMoreIds(false);
      fetchIdsInProgress.current = false;
      // console.log('[useMenuItems] fetchIdsForPool: Finished.');
    }
  }, [itemIdsPool, allIdsLoaded]); // Removed selectedTags and currentRestaurantForWaiterMode, will pass them directly


  // --- Function to fetch full details for a chunk of IDs ---
  const fetchNextDetailsChunk = useCallback(async (isInitialDetailsLoad = false, idsToFetchOverride?: string[]) => {
    if (fetchDetailsInProgress.current) {
        // console.log('[useMenuItems] fetchNextDetailsChunk: Skipped (details fetch already in progress).');
        return;
    }
    // console.log('[useMenuItems] fetchNextDetailsChunk: Triggered.');

    const idsToFetch = idsToFetchOverride || itemIdsPool.slice(currentIndexInPool, currentIndexInPool + DETAILS_CHUNK_SIZE);

    if (idsToFetch.length === 0) {
      // console.log('[useMenuItems] fetchNextDetailsChunk: No IDs to fetch details for.');
      if (isInitialDetailsLoad) {
        console.log("[useMenuItems] fetchNextDetailsChunk: No IDs to fetch, initial load. Setting setLoadingInitial(false).");
        setLoadingInitial(false); // Ensure loading stops if initial and no IDs
      }
      setIsLoadingDetails(false);
      return;
    }

    // console.log(`[useMenuItems] fetchNextDetailsChunk: Attempting to fetch details for ${idsToFetch.length} items. IDs:`, idsToFetch);
    fetchDetailsInProgress.current = true;
    if (isInitialDetailsLoad) {
      console.log("[useMenuItems] fetchNextDetailsChunk: Initial details load. Setting setLoadingInitial(true).");
      setLoadingInitial(true);
    } else {
      setIsLoadingDetails(true);
    }

    try {
      Sentry.addBreadcrumb({
        category: 'data.fetch.details',
        message: 'Fetching full item details for chunk by specific IDs',
        data: { count: idsToFetch.length, ids: idsToFetch }
      });
      
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_menu_items_by_ids', { 
          item_ids: idsToFetch // Corrected parameter name
        });

      if (rpcError) throw rpcError;

      // More granular logging for the specific item
      /*
      if (rpcData && Array.isArray(rpcData)) {
        const problemItem = rpcData.find(item => item.id === '50f30b5d-cf55-46cd-9410-0cefddfe0063');
        if (problemItem) {
          console.log('[useMenuItems] Problem Item (50f30b5d) direct from rpcData:', problemItem);
          console.log('[useMenuItems] Problem Item (50f30b5d) dish_types from rpcData:', problemItem.dish_types);
          console.log('[useMenuItems] Problem Item (50f30b5d) typeof dish_types:', typeof problemItem.dish_types);
          if (problemItem.dish_types && Array.isArray(problemItem.dish_types)) {
            console.log('[useMenuItems] Problem Item (50f30b5d) dish_types[0]:', problemItem.dish_types[0]);
            console.log('[useMenuItems] Problem Item (50f30b5d) dish_types.length:', problemItem.dish_types.length);
          }
        }
      }
      */

      // Log raw RPC data
      // console.log('[useMenuItems] Raw data from RPC (should be get_menu_items_by_ids):', JSON.stringify(rpcData, null, 2));

      if (rpcData && Array.isArray(rpcData)) {
        const rawItems = rpcData as RpcMenuItemWithRestaurant[];
        let newDisplayItems = rawItems.map(convertToSupabaseMenuItem);
        
        // Log items after conversion
        // console.log('[useMenuItems] Items after convertToSupabaseMenuItem (first 2):', JSON.stringify(newDisplayItems.slice(0, 2), null, 2));

        // === NEW LOGIC for Waiter Mode Anchor ===
        if (currentRestaurantForWaiterMode && waiterModeAnchorItem && newDisplayItems.length > 0) {
          console.log(`[useMenuItems] In waiter mode for ${currentRestaurantForWaiterMode}. Anchor: ${waiterModeAnchorItem.id}. Reordering...`);
          const anchorIdx = newDisplayItems.findIndex(item => item.id === waiterModeAnchorItem.id);
          if (anchorIdx > -1) {
            const anchor = newDisplayItems.splice(anchorIdx, 1)[0];
            newDisplayItems.unshift(anchor); // Put anchor item first
            console.log(`[useMenuItems] Anchor item ${anchor.id} moved to front. New list starts with: ${newDisplayItems[0]?.id}`);
          } else {
            console.warn(`[useMenuItems] Waiter mode: Anchor item ${waiterModeAnchorItem.id} not found in fetched chunk. Current chunk items:`, newDisplayItems.map(i => i.id));
          }
        }
        // === END NEW LOGIC ===
        
        // Apply score averaging
        newDisplayItems = ensureQualityScoreAverage(newDisplayItems);
        newDisplayItems = ensureAestheticScoreAverage(newDisplayItems);
        
        // Log items after score averaging (check if hours are still there)
        // console.log('[useMenuItems] Items after score averaging (first 2):', JSON.stringify(newDisplayItems.slice(0, 2), null, 2));

        setDisplayedItems(prevItems => {
          if (currentRestaurantForWaiterMode) { // If in waiter mode, newDisplayItems is the complete, reordered list for the restaurant.
            console.log("[useMenuItems] Waiter mode: Replacing displayedItems entirely with anchor-first list.");
            return newDisplayItems; 
          } else { // Normal mode, append new items if they are not already present
            const existingIds = new Set(prevItems.map(item => item.id));
            const trulyNewItems = newDisplayItems.filter(item => !existingIds.has(item.id));
            return [...prevItems, ...trulyNewItems];
          }
        });
        setCurrentIndexInPool(prevIdx => prevIdx + idsToFetch.length);
      } else {
        // console.log('[useMenuItems] fetchNextDetailsChunk: No data returned from RPC or not an array.');
      }

    } catch (err: any) {
      console.error('[useMenuItems] Error fetching item details:', err);
      Sentry.captureException(err, { extra: { message: 'Error in fetchNextDetailsChunk' } });
      setError(err.message || 'Failed to fetch item details');
    } finally {
      setIsLoadingDetails(false);
      if (isInitialDetailsLoad) {
        console.log("[useMenuItems] fetchNextDetailsChunk: FINALLY an initial details load. Setting setLoadingInitial(false).");
        setLoadingInitial(false);
      }
      fetchDetailsInProgress.current = false;
      console.log('[useMenuItems] fetchNextDetailsChunk: FINISHED.');
    }
  }, [currentIndexInPool, itemIdsPool, allIdsLoaded, fetchIdsForPool]); // Removed selectedTags

  // --- Effect for initial ID fetch ---
  useEffect(() => {
    // Only trigger refresh on mount or when waiter mode changes
    // Remove selectedTags to prevent filter changes from causing full data reloads
    console.log(`[useMenuItems Effect for Refresh] Mount or waiter mode change. currentRestaurantForWaiterMode: ${currentRestaurantForWaiterMode || 'none'}. Triggering refreshData.`);
    refreshData(); 
  }, [currentRestaurantForWaiterMode]); // Remove selectedTags dependency

  // --- Effect for replenishing ID pool ---
  useEffect(() => {
    const consumedRatio = itemIdsPool.length > 0 ? currentIndexInPool / itemIdsPool.length : 0;
    // console.log(`[useMenuItems] Pool consumption: ${consumedRatio.toFixed(2)} (currentIndex: ${currentIndexInPool}, poolSize: ${itemIdsPool.length})`);

    // Replenish if pool is small (due to filters) or getting depleted
    const shouldReplenish = itemIdsPool.length < DETAILS_CHUNK_SIZE || (itemIdsPool.length > 0 && consumedRatio >= POOL_REPLENISH_THRESHOLD_PERCENT);

    if (shouldReplenish && !isLoadingMoreIds && !allIdsLoaded && !fetchIdsInProgress.current) {
      console.log(`[useMenuItems Replenish Effect] Replenish threshold reached or pool too small. Fetching more IDs for pool. RestaurantID: ${currentRestaurantForWaiterMode || 'none'}`);
      // Remove selectedTags from fetchIdsForPool - use empty array for no filters
      fetchIdsForPool(false, [], currentRestaurantForWaiterMode);
    }
  }, [currentIndexInPool, itemIdsPool, isLoadingMoreIds, allIdsLoaded, fetchIdsForPool, currentRestaurantForWaiterMode]); // Remove selectedTags dependency
  
  // --- Function to be called by UI to load more items ---
  const loadMoreItems = useCallback(() => {
    // console.log('[useMenuItems] loadMoreItems called.');
    if (!fetchDetailsInProgress.current && !loadingInitial) { 
        fetchNextDetailsChunk();
    }
  }, [loadingInitial, fetchNextDetailsChunk]);

  // --- Function for pull-to-refresh or "start over" ---
  const refreshData = useCallback(() => {
    // console.log('[useMenuItems] refreshData: Resetting state and fetching initial IDs.');
    console.log(`[useMenuItems refreshData] Called. Resetting state. Will fetch with RestaurantID: ${currentRestaurantForWaiterMode || 'none'}`);
    resetStateForRefresh();
    // Remove selectedTags - use empty array for no server-side filtering
    setTimeout(() => {
        fetchIdsForPool(true, [], currentRestaurantForWaiterMode);
    }, 50);
  }, [currentRestaurantForWaiterMode]); // Remove selectedTags dependency

  // Location fetching logic (can be re-integrated if useLocation is true)
  // const openSettings = ...
  // const requestLocationPermission = ...
  // const getLocation = ...
  // useEffect(() => { if (useLocation) { getLocation().then(setLocation); } }, [useLocation]);

  // Waiter mode (if still needed)
  const enterWaiterMode = useCallback(async (restaurantId: string, anchorItem: SupabaseMenuItem) => {
    console.log(`[useMenuItems ENTER WAITER MODE] START. Restaurant ID: ${restaurantId}, Anchor Item ID: ${anchorItem.id}, Name: ${anchorItem.name}`);
    Sentry.addBreadcrumb({ category: 'waitermode', message: `Entering waiter mode for restaurant ${restaurantId}, anchor ${anchorItem.id}`, level: 'info' });
    
    // Store the anchor item
    console.log(`[useMenuItems ENTER WAITER MODE] Setting waiterModeAnchorItem to: ${anchorItem.id}`);
    setWaiterModeAnchorItem(anchorItem);

    // Reset states for the new mode
    console.log("[useMenuItems ENTER WAITER MODE] Resetting states: allIdsLoaded=false, itemIdsPool=[], displayedItems=[], currentIndexInPool=0, loadingInitial=true, error=null");
    setAllIdsLoaded(false);
    setItemIdsPool([]);       // Clear pool to force fetch for this restaurant only
    setDisplayedItems([]);    // Clear displayed items INITIALLY
    setCurrentIndexInPool(0); // Reset index in pool
    setLoadingInitial(true);  // Set loading true as we are re-fetching
    setError(null);
    fetchIdsInProgress.current = false; // Ensure fetch can start
    fetchDetailsInProgress.current = false; // Ensure details fetch can start
    
    // Set current restaurant for waiter mode *before* calling fetchIdsForPool
    console.log(`[useMenuItems ENTER WAITER MODE] Setting currentRestaurantForWaiterMode to: ${restaurantId}`);
    setCurrentRestaurantForWaiterMode(restaurantId);
    
    // The useEffect watching currentRestaurantForWaiterMode will trigger refreshData,
    // which then calls fetchIdsForPool with the correct waiterRestaurantId.
    // fetchNextDetailsChunk will then be called with the new pool and has the reordering logic.
    console.log("[useMenuItems ENTER WAITER MODE] END. State updates initiated.");

  }, []); // Removed fetchIdsForPool from deps

  const exitWaiterMode = useCallback(async () => {
    console.log('[useMenuItems EXIT WAITER MODE] START.');
    Sentry.addBreadcrumb({ category: 'waitermode', message: 'Exiting waiter mode', level: 'info' });
    
    console.log("[useMenuItems EXIT WAITER MODE] Setting waiterModeAnchorItem to null.");
    setWaiterModeAnchorItem(null);
    console.log("[useMenuItems EXIT WAITER MODE] Setting currentRestaurantForWaiterMode to null.");
    setCurrentRestaurantForWaiterMode(null);

    // Reset states for general mode
    console.log("[useMenuItems EXIT WAITER MODE] Resetting states: allIdsLoaded=false, itemIdsPool=[], displayedItems=[], currentIndexInPool=0, loadingInitial=true, error=null");
    setAllIdsLoaded(false);
    setItemIdsPool([]);       // Clear pool to force general fetch
    setDisplayedItems([]);    // Clear displayed items
    setCurrentIndexInPool(0); // Reset index in pool
    setLoadingInitial(true);  // Set loading true
    setError(null);
    fetchIdsInProgress.current = false; // Ensure fetch can start
    fetchDetailsInProgress.current = false; // Ensure details fetch can start
    
    // fetchIdsForPool will be triggered by the useEffect watching currentRestaurantForWaiterMode (now null)
    console.log("[useMenuItems EXIT WAITER MODE] END. State updates initiated.");
  }, []); // Removed fetchIdsForPool from deps

  return {
    items: displayedItems, 
    loading: loadingInitial || isLoadingDetails, 
    loadingInitial,       
    isLoadingMoreDetails: isLoadingDetails, 
    error,
    loadMoreItems,        
    refresh: refreshData, 
    currentRestaurant: currentRestaurantForWaiterMode, // Use the new state variable
    enterWaiterMode,
    exitWaiterMode,
    isWaiterMode: !!currentRestaurantForWaiterMode, // Use the new state variable
    // location, // if location is re-enabled
  };
} 