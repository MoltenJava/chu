export interface SanityMenuItem {
  _id: string;
  _createdAt: string;
  title: string; // Restaurant name
  menu_item: string;
  image: SanityImage;
  postmates_url?: string;
  doordash_url?: string;
  uber_eats_url?: string;
  address: string;
  latitude: number;
  longitude: number;
  price: number;
  price_level: string;
}

// Helper type for Sanity image URLs
export interface SanityImage {
  _type: 'image';
  asset: {
    _ref: string;
    _type: 'reference';
    url?: string; // Optional URL from expanded reference
  };
} 