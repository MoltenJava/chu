import React, { useState, useEffect } from 'react';
import { StyleSheet, View, StatusBar as RNStatusBar, ActivityIndicator, Text, BackHandler, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { loadFoodData, loadRealFoodData } from '../../data/realFoodData';
import CoupleMode from '../../components/food/CoupleMode';
import { FoodItem } from '../../types/food';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  clearCurrentSessionData, 
  testAsyncStorage,
  getCurrentSessionId,
  deepCleanupAllCoupleModeData,
  checkStorageStatus,
  COUPLE_SESSIONS_KEY
} from '../../utils/coupleSessionService';

// Generate a random user ID if none exists
const getUserId = async (): Promise<string> => {
  try {
    const userId = await AsyncStorage.getItem('userId');
    if (userId) return userId;
    
    const newUserId = `user_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    await AsyncStorage.setItem('userId', newUserId);
    return newUserId;
  } catch (error) {
    console.error('Error getting/setting userId:', error);
    return `user_${Date.now()}`;
  }
};

// Add a function to set test data directly in AsyncStorage
const setTestSessionData = async () => {
  try {
    // Create a test session object
    const testSessionId = `test_${Date.now()}`;
    const testSession = {
      id: testSessionId,
      sessionCode: '123456',
      startTime: Date.now(),
      endTime: 0,
      status: 'pending',
      participants: ['test_user_1'],
      currentIndex: 0
    };
    
    // Create a sessions object with the test session
    const sessions = {
      [testSessionId]: testSession
    };
    
    // Stringify and save to AsyncStorage
    const sessionsJson = JSON.stringify(sessions);
    console.log(`[TEST] Setting test session data: ${sessionsJson.substring(0, 100)}...`);
    
    // Direct set to AsyncStorage
    await AsyncStorage.setItem(COUPLE_SESSIONS_KEY, sessionsJson);
    
    // Verify by reading it back immediately
    const verifyJson = await AsyncStorage.getItem(COUPLE_SESSIONS_KEY);
    console.log(`[TEST] Verification read: ${verifyJson ? 'Data received (length: ' + verifyJson.length + ')' : 'No data'}`);
    
    if (!verifyJson) {
      console.error('[TEST] CRITICAL: AsyncStorage write failed verification!');
    } else {
      console.log('[TEST] AsyncStorage write verification successful');
    }
    
    alert('Test session data has been set. Code: 123456');
  } catch (error: any) {
    console.error('[TEST] Error setting test data:', error);
    alert('Error setting test data: ' + (error?.message || 'Unknown error'));
  }
};

export default function CoupleModeScreen() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [userId, setUserId] = useState<string>('');
  const router = useRouter();
  
  // Debug function to check storage
  const handleDebugStorage = async () => {
    try {
      console.log('[DEBUG] ***** DEBUG STORAGE REQUESTED *****');
      
      // Test AsyncStorage functionality first
      console.log('[DEBUG] Testing AsyncStorage basic functionality...');
      const storageWorks = await testAsyncStorage();
      console.log(`[DEBUG] AsyncStorage test result: ${storageWorks ? 'PASSED' : 'FAILED'}`);
      
      // Get all keys in AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      console.log('[DEBUG] All AsyncStorage keys:', keys);
      
      // Check for our specific keys
      await checkStorageStatus();
      
      // Show alert with results and options
      if (storageWorks) {
        if (confirm('AsyncStorage test PASSED. Debug info sent to console. Would you like to set test session data?')) {
          await setTestSessionData();
        }
      } else {
        alert('WARNING: AsyncStorage test FAILED. This explains why sessions are not being saved.');
      }
    } catch (error: any) {
      console.error('[DEBUG] Error in debug storage:', error);
      alert('Error debugging storage: ' + (error?.message || 'Unknown error'));
    }
  };
  
  // Debug logging on mount
  useEffect(() => {
    const debugAsyncStorage = async () => {
      console.log("=== Couple Mode Screen Mounted ===");
      await checkStorageStatus();
    };
    
    debugAsyncStorage();
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Ensure any stale session data is cleared when the screen unmounts
      clearCurrentSessionData().catch(error => {
        console.error('Error clearing session data on unmount:', error);
        // As a backup, try deep cleanup
        deepCleanupAllCoupleModeData().catch(deepError => {
          console.error('Error during emergency cleanup:', deepError);
        });
      });
    };
  }, []);
  
  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleExit();
      return true;
    });
    
    return () => backHandler.remove();
  }, []);
  
  // Load the food data when the component mounts
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get user ID
        const id = await getUserId();
        setUserId(id);
        
        // Debug log user ID
        console.log(`[DEBUG] Couple mode screen using userID: ${id}`);
        
        // Use loadRealFoodData to get distance information
        const data = await loadRealFoodData();
        
        if (data && data.length > 0) {
          console.log(`Loaded ${data.length} items for couple mode`);
          setFoodItems(data);
        } else {
          console.warn('Real food data is empty, falling back to regular loadFoodData');
          const fallbackData = await loadFoodData();
          setFoodItems(fallbackData);
        }
      } catch (err) {
        console.error('Error loading food data:', err);
        setError('Failed to load food data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  // Handle exit from couple mode with thorough cleanup
  const handleExit = async () => {
    try {
      console.log('Exiting couple mode screen...');
      // Force cleanup of any lingering session data
      await clearCurrentSessionData();
      
      // Check if cleanup was successful
      const currentSessionId = await getCurrentSessionId();
      if (currentSessionId) {
        console.log('WARNING: Session data still present after clearing, performing deep cleanup');
        await deepCleanupAllCoupleModeData();
      }
      
      // Navigate back
      router.back();
    } catch (error) {
      console.error('Error during couple mode exit:', error);
      // Try deep cleanup as last resort
      try {
        await deepCleanupAllCoupleModeData();
      } catch (finalError) {
        console.error('Critical error during deep cleanup:', finalError);
      }
      router.back();
    }
  };
  
  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#FF3B5C" />
          <Text style={styles.loadingText}>Loading couple mode...</Text>
        </View>
        
        {__DEV__ && (
          <TouchableOpacity 
            style={styles.debugButton} 
            onPress={handleDebugStorage}
          >
            <Text style={styles.debugText}>Debug Storage</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
        
        {__DEV__ && (
          <TouchableOpacity 
            style={styles.debugButton} 
            onPress={handleDebugStorage}
          >
            <Text style={styles.debugText}>Debug Storage</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <CoupleMode
        data={foodItems}
        onExit={handleExit}
        userId={userId}
      />
      
      {__DEV__ && (
        <TouchableOpacity 
          style={styles.debugButton} 
          onPress={handleDebugStorage}
        >
          <Text style={styles.debugText}>Debug Storage</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: RNStatusBar.currentHeight,
    backgroundColor: '#fff',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  retryButton: {
    backgroundColor: '#FF3B5C',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  debugButton: {
    position: 'absolute',
    right: 15,
    bottom: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    zIndex: 1000,
  },
  debugText: {
    color: 'white',
    fontSize: 12,
  },
}); 