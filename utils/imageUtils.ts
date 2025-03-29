import { Image, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import * as Crypto from 'expo-crypto';

// Cache configuration
const CACHE_FOLDER = `${FileSystem.cacheDirectory}image_cache/`;
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Create cache directory if it doesn't exist
async function ensureCacheDirectory() {
  const dirInfo = await FileSystem.getInfoAsync(CACHE_FOLDER);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_FOLDER, { intermediates: true });
  }
}

// Generate a cache key for a URL
async function generateCacheKey(url: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    url
  );
  return hash.slice(0, 32); // Use first 32 chars of hash
}

// Check if a cached file is expired
async function isCacheExpired(filePath: string): Promise<boolean> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) return true;

    // Use modification time to check expiry
    const modTime = fileInfo.modificationTime ? new Date(fileInfo.modificationTime).getTime() : 0;
    return Date.now() - modTime > CACHE_EXPIRY;
  } catch (error) {
    console.warn('Error checking cache expiry:', error);
    return true;
  }
}

// Fallback image as a data URI to ensure it's always available
export const PLACEHOLDER_IMAGE = { 
  uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAMAAABrrFhUAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6QTFCRTE4Q0E4NTg1MTFFQTg3QzNBOTY0NkJGQkY5NUMiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6QTFCRTE4Q0I4NTg1MTFFQTg3QzNBOTY0NkJGQkY5NUMiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpBMUJFMThDODg1ODUxMUVBODdDM0E5NjQ2QkZCRjk1QyIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpBMUJFMThDOTg1ODUxMUVBODdDM0E5NjQ2QkZCRjk1QyIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PtF/4/8AAAGAUExURdfX19jY2PLy8uTk5Pz8/OPj4/n5+erq6vf39+fn5/T09Pb29unp6d7e3vj4+PPz8/X19d/f397e3/v7+9zc3ODg4Pn5+vDw8Nra2vHx8ff3+OHh4d3d3fr6+uLi4/v7/NnZ2djY2d3d3vLy8+vr6+bm5urq6+Tk5eTk5vPz9OXl5e/v7+Xl5tra29vb2+Li4vr6+/Hx8tnZ2tLS0/39/e7u7u7u7+Pj5Ozs7O3t7ezs7dXV1ebo6trZ2vT19dbW1t/f4OXm5tXV1ubm59jZ2dbW19PT0/Dx8dTU1fDw8dXU1dnY2dTU1Ofo6OXm5+Hh4uDh4ePi49LS0tjX19PT1Ojp6fX29tXV1N/g4Nvb3Nzb3OHg4dnY2PLz8+zr7PPy8vb19fX09O/u7vb29/Tz9Ojn5+3s7N3c3evq6uLh4eLj4+bl5dHR0u/v8O7v7+no6O/u7e3t7uvr7Obm5dHR0djX2O7t7fT19NTT1OTj5Ojn6OTj4/f4+PPz8tva2ubl5uDg4eLi4dna2tPU1P///9LS0hXUTM8AAABIZVhJZk1NACoAAAAIAAGHaQAEAAAAAQAAABoAAAAAAAOgAQADAAAAAQABAACgAgAEAAAAAQAAAQCgAwAEAAAAAQAAAQAAAAAAlZzV+AAAAk1JREFUeNrt3MtOwzAQQNGEhDpxnGL+/1+BaiQcJLTpZmoH5x6JZeWNdtXFxA4sC4ZhGIZhGIZhGIZhGIZheEieHIfD4XRdLs/n8/FSvbwcP/l4m3w5b3Xcy6b4nP7e6Xye9tvb9pz6/W1eO31Kvx0O+/3+VC7PUfOPq8/9dH+dxqnv6aOfrgf4g9h8EwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGTltn8d8gJ6B8TnF9APqC+gH1BbQD9geQH9gOKC3XO5eVmWTcvrCxB5QQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBATLzAgICAgICAkblBQQEBAQEBMicFzAu7xMYEBAQEBAQEBAQEBBwvs4L+Jv/wD/LCwgICAgIGJkXEBAQEBAQEBAQEBAQEBAwMy8gICAgICAgICAgICAgICDgeHkBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAa/KCwgI+HGdxeWnAT4S4F2Ah4D/c5Uv/1ZubmNz4gEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4GlWy25bbF73w/qy2y3b9DUd969t8svdvN7+sC6/pnXuW60ueXXJ/8xrC5CXFxAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQELDwedU8ARd+8gICAgICAgKG5QUEBAQEBASInBcQEBAQEBAQEBDwewDfBHgIKNovAQ4b/gHSw/O3ZKJErgAAAABJRU5ErkJggg=='
};

// Cache an image locally
async function cacheImage(url: string, cacheKey: string): Promise<string> {
  const cachePath = `${CACHE_FOLDER}${cacheKey}`;
  
  try {
    await FileSystem.downloadAsync(url, cachePath);
    return cachePath;
  } catch (error) {
    console.warn('Error caching image:', error);
    throw error;
  }
}

// Get cached image path or download if not cached
async function getCachedImage(url: string): Promise<string> {
  try {
    await ensureCacheDirectory();
    const cacheKey = await generateCacheKey(url);
    const cachePath = `${CACHE_FOLDER}${cacheKey}`;
    
    const fileInfo = await FileSystem.getInfoAsync(cachePath);
    if (fileInfo.exists && !(await isCacheExpired(cachePath))) {
      return cachePath;
    }
    
    return await cacheImage(url, cacheKey);
  } catch (error) {
    console.warn('Error getting cached image:', error);
    throw error;
  }
}

/**
 * Safely prefetch an image with error handling and caching
 */
export const safeImagePrefetch = async (imageUrl: string): Promise<boolean> => {
  if (!isValidImageUrl(imageUrl)) {
    return Promise.resolve(false);
  }
  
  try {
    // First check if we have a valid cached version
    const cachedPath = await getCachedImage(imageUrl);
    if (cachedPath) {
      // If we have a cached version, we're done
      return true;
    }
    
    // If no cache or cache expired, prefetch from network
    await Image.prefetch(imageUrl);
    return true;
  } catch (error) {
    console.warn(`Failed to preload image: ${imageUrl}`, error);
    return false;
  }
};

/**
 * Safely handle image loading errors
 */
export const handleImageError = (imageUrl: string, error: any): void => {
  try {
    console.warn(`Error loading image: ${imageUrl}`, error);
  } catch (e) {
    console.warn('Failed to log image error');
  }
};

/**
 * Check if a URL is valid for image loading
 */
export const isValidImageUrl = (url: any): boolean => {
  return url && typeof url === 'string' && url.trim() !== '';
};

/**
 * Batch prefetch images with individual error handling and caching
 */
export const batchPrefetchImages = async (
  imageUrls: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<string[]> => {
  if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
    return [];
  }
  
  const validUrls = imageUrls.filter(isValidImageUrl);
  const successfulUrls: string[] = [];
  
  await ensureCacheDirectory();
  
  for (let i = 0; i < validUrls.length; i++) {
    const url = validUrls[i];
    try {
      const success = await safeImagePrefetch(url);
      if (success) {
        successfulUrls.push(url);
      }
      
      if (onProgress) {
        onProgress(i + 1, validUrls.length);
      }
    } catch (error) {
      console.warn(`Error prefetching image ${url}:`, error);
    }
  }
  
  return successfulUrls;
}; 