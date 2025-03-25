import { calculateDistance, calculateStraightLineDistance, getUserLocation } from '../utils/locationService';

/**
 * This file demonstrates the usage of the location services
 * It can be run separately to test the distance calculation API
 */

// Run the test
async function runTest() {
  console.log('Testing location services...');

  // Get the user's location
  const userLocation = await getUserLocation();
  console.log('User location:', userLocation);

  // Test coordinates (sample restaurants in Westwood)
  const destinations = [
    {
      name: "Diddy Riese",
      coordinates: { latitude: 34.06344400, longitude: -118.44628100 }
    },
    {
      name: "In-N-Out Burger",
      coordinates: { latitude: 34.04803500, longitude: -118.44305200 }
    },
    {
      name: "Stan's Donuts",
      coordinates: { latitude: 34.06308700, longitude: -118.44610700 }
    }
  ];

  // Test straight-line distance calculations
  console.log('\nCalculating straight-line distances:');
  for (const dest of destinations) {
    const distance = calculateStraightLineDistance(userLocation, dest.coordinates);
    console.log(`Distance to ${dest.name}: ${distance.toFixed(2)} miles (straight-line)`);
  }

  // Test Google Routes API distance calculations
  console.log('\nCalculating driving distances using Google Routes API:');
  try {
    for (const dest of destinations) {
      const result = await calculateDistance(userLocation, dest.coordinates);
      console.log(`Distance to ${dest.name}: ${result.distance.toFixed(2)} miles`);
      console.log(`Estimated travel time: ${Math.round(result.duration / 60)} minutes`);
    }
  } catch (error) {
    console.error('Error calculating distances:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runTest().catch(console.error);
}

export default runTest; 