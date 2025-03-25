# Distance Calculation and Pricing Features

## Overview

This document describes two major features implemented in the Chewz app:

1. **Price Level Display**: Shows the pricing level of each restaurant/dish based on metadata.
2. **Distance Calculation**: Calculates and displays the distance and estimated travel time from the user to each restaurant.

## Price Level Display

The price level data is now included in the restaurant metadata JSON file. We've updated the app to:

- Parse the `price_level` field from the metadata
- Display the price level (e.g., "$", "$$", "$$$") in the food card UI
- Include price level information in the detailed view

## Distance Calculation

We've implemented distance calculation using the Google Routes API:

### Configuration

- **API Key**: `AIzaSyBaaoBruSs1Wl0YbmXqErLl6w8ZiepPdwk`
- **Default User Location**: Westwood, Los Angeles (Latitude: 34.04053500, Longitude: -118.44994500)

### Features

- Calculates distances using the Google Routes API
- Shows both the distance in miles and estimated travel time
- Sorts food items by proximity (closest first)
- Provides a fallback calculation using the Haversine formula if the API call fails

### Implementation

The distance calculation is implemented in `locationService.ts` with these key functions:

1. `calculateDistance`: Calls the Google Routes API to get the driving distance and duration
2. `calculateStraightLineDistance`: Calculates direct distance using the Haversine formula (fallback)
3. `calculateBatchDistances`: Processes multiple food items in batches
4. `getUserLocation`: Returns the user's location (currently using a default value)

## UI Changes

The app now displays:

- Distance information in the food card view
- Travel time in minutes/hours
- Distance and duration in the details modal
- Restaurant address when available

## Testing

A test file is included at `test/testLocationServices.ts` that demonstrates the distance calculation functionality.

To run the test:

```bash
npx ts-node chu/test/testLocationServices.ts
```

## Future Improvements

1. Use the device's actual location instead of the hardcoded default
2. Implement caching of distance calculations to reduce API usage
3. Add distance-based filtering options
4. Add map integration for restaurant locations 