/**
 * UberEats API Response Schema
 * 
 * This schema defines the structure of the UberEats API response for restaurant and menu data.
 * It focuses on capturing restaurant details, menu categories, menu items, and delivery information.
 */

// Main response object
interface UberEatsResponse {
  state: string;                 // Status of the request (e.g., "completed")
  name: string;                  // Name of the queue or request
  data: {
    scraper: {
      maxRows: number;           // Maximum number of results to return
      query: string;             // Search query (e.g., "Fried Chicken")
      address: string;           // User's address
      locale: string;            // Language/locale setting
      page: number;              // Page number of results
    }
  };
  id: string;                    // Unique identifier for the request
  progress: number;              // Progress percentage of the request
  returnvalue: {
    hasMorePage: boolean;        // Whether there are more pages of results
    currentPage: number;         // Current page number
    data: Restaurant[];          // Array of restaurant data
  };
}

// Restaurant information
interface Restaurant {
  title: string;                 // Restaurant name
  sanitizedTitle: string;        // Clean version of restaurant name
  phoneNumber: string;           // Restaurant phone number
  cuisineList: string[];         // List of cuisine types
  location: {
    address: string;             // Full address
    streetAddress: string;       // Street address component
    city: string;                // City
    country: string;             // Country code
    postalCode: string;          // Postal/zip code
    region: string;              // State/region code
    latitude: number;            // Latitude coordinates
    longitude: number;           // Longitude coordinates
    geo: {                       // Geographical information
      city: string;
      country: string;
      neighborhood?: string;
      region: string;
    };
    locationType: string;        // Type of location
  };
  currencyCode: string;          // Currency code (e.g., "USD")
  rating: {
    ratingValue: number;         // Average rating (e.g., 4.5)
    reviewCount: string;         // Number of reviews (e.g., "1000+")
  };
  etaRange: string;              // Estimated delivery time (e.g., "Delivered in 35 to 35 min")
  hours: BusinessHours[];        // Business operating hours
  categories: string[];          // Restaurant categories
  categoriesLink: {
    text: string;                // Category name
    link?: string;               // Link to category (optional)
  }[];
  menu: MenuSection[];           // Menu sections
  uuid: string;                  // Unique identifier for the restaurant
  url: string;                   // UberEats URL for the restaurant
  logoImageUrl?: string;         // URL to restaurant logo image
}

// Business hours information
interface BusinessHours {
  dayRange: string;              // Day range (e.g., "Monday - Friday")
  sectionHours: {
    startTime: number;           // Start time in minutes from midnight
    endTime: number;             // End time in minutes from midnight
    sectionTitle: string;        // Section name (e.g., "Breakfast", "Dinner")
  }[];
}

// Menu section (category)
interface MenuSection {
  catalogSectionUUID: string;    // Unique identifier for the section
  catalogName: string;           // Section name (e.g., "Burgers", "Sides")
  catalogItems: MenuItem[];      // Items in this section
  catalogSectionPosition: number; // Order position in the menu
}

// Menu item details
interface MenuItem {
  uuid: string;                  // Unique identifier for the item
  title: string;                 // Item name
  titleBadge: string;            // Item title badge (usually same as title)
  imageUrl?: string;             // URL to the item image
  itemDescription?: string;      // Description of the item
  price: number;                 // Price in smallest currency unit (e.g., cents)
  priceTagline: string;          // Formatted price (e.g., "$10.99", "$5.99 • 420 Cal.")
  isSoldOut: boolean;            // Whether the item is sold out
  isAvailable: boolean;          // Whether the item is available
  hasCustomizations: boolean;    // Whether the item has customization options
  numAlcoholicItems?: number;    // Number of alcoholic components (if applicable)
  endorsement?: string;          // Endorsement label (e.g., "Popular")
  labelPrimary: string;          // Primary label (combines price, rating, calories)
  rating?: string;               // Rating percentage (e.g., "85%")
  numRatings?: number;           // Number of ratings
}

/**
 * Example usage to access key information:
 * 
 * // Get restaurant name
 * const restaurantName = response.returnvalue.data[0].title;
 * 
 * // Get estimated delivery time
 * const eta = response.returnvalue.data[0].etaRange;
 * 
 * // Get menu categories
 * const menuCategories = response.returnvalue.data[0].menu.map(section => section.catalogName);
 * 
 * // Get all menu items with images from a specific restaurant
 * const menuItems = response.returnvalue.data[0].menu.flatMap(section => 
 *   section.catalogItems.map(item => ({
 *     name: item.title,
 *     description: item.itemDescription,
 *     price: item.price,
 *     formattedPrice: item.priceTagline,
 *     imageUrl: item.imageUrl,
 *     category: section.catalogName
 *   }))
 * );
 * 
 * // Filter only items with images
 * const itemsWithImages = menuItems.filter(item => item.imageUrl);
 */