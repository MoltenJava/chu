import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert,
  Share, Platform, Modal, FlatList, ScrollView
} from 'react-native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FoodItem, SwipeDirection, PhotoRating } from '../../types/food';
import { loadFoodData } from '../../data/realFoodData';
import {
  savePhotoRating, filterRatedItems, clearPhotoRatings,
  loadPhotoRatings, exportRatingsToJSON, importRatingsFromJSON
} from '../../utils/photoRatingService';
import { Stack } from 'expo-router';
import { FoodCard } from '../../components/food/FoodCard';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

export default function RatePhotosScreen() {
  const [foodData, setFoodData] = useState<FoodItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [ratedPhotos, setRatedPhotos] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const ratingHistory = useRef<{foodId: string, rating: 'good' | 'bad' | 'meh' | null}[]>([]);
  
  // State for ratings display
  const [showRatingsModal, setShowRatingsModal] = useState(false);
  const [ratingStats, setRatingStats] = useState({ good: 0, bad: 0, meh: 0 });
  
  // Function to load food data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load all food data
      const allFood = await loadFoodData();
      
      // Filter out already rated items
      const unratedFood = await filterRatedItems(allFood);
      
      setFoodData(unratedFood);
      setTotalPhotos(allFood.length);
      setRatedPhotos(allFood.length - unratedFood.length);
      setCurrentIndex(0);
      setCanUndo(false);
      ratingHistory.current = [];
      
      // Update rating stats
      updateRatingStats();
    } catch (error) {
      console.error('Error loading food data:', error);
      Alert.alert('Error', 'Failed to load food data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Update rating statistics
  const updateRatingStats = useCallback(async () => {
    try {
      const ratings = await loadPhotoRatings();
      const stats = {
        good: 0,
        bad: 0,
        meh: 0
      };
      
      // Count ratings by type
      Object.values(ratings).forEach((rating) => {
        if (rating && stats[rating] !== undefined) {
          stats[rating]++;
        }
      });
      
      setRatingStats(stats);
    } catch (error) {
      console.error('Error loading rating stats:', error);
    }
  }, []);
  
  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Add the undo functionality
  const handleUndo = useCallback(async () => {
    if (ratingHistory.current.length === 0) {
      setCanUndo(false);
      return;
    }
    
    // Get the last rating
    const lastRating = ratingHistory.current.pop();
    
    if (!lastRating) return;
    
    try {
      // Remove the rating
      await savePhotoRating(lastRating.foodId, null);
      
      // Decrease the rated photos count
      setRatedPhotos(prev => Math.max(0, prev - 1));
      
      // Move back to the previous card
      setCurrentIndex(prev => Math.max(0, prev - 1));
      
      // Disable undo if there's no more history
      if (ratingHistory.current.length === 0) {
        setCanUndo(false);
      }
      
      // Update rating stats
      updateRatingStats();
    } catch (error) {
      console.error('Error undoing rating:', error);
      Alert.alert('Error', 'Failed to undo rating. Please try again.');
    }
  }, [updateRatingStats]);
  
  // Handle swipe events - update to save rating history
  const handleSwipe = useCallback(async (food: FoodItem, direction: SwipeDirection) => {
    let rating = null;
    
    // Map swipe direction to rating
    switch (direction) {
      case 'right':
        // Right swipe means "good"
        rating = 'good';
        break;
      case 'left':
        // Left swipe means "bad"
        rating = 'bad';
        break;
      case 'up':
        // Up swipe means "meh"
        rating = 'meh';
        break;
      default:
        return; // Don't save for 'none'
    }
    
    // Save the rating
    await savePhotoRating(food.id, rating as 'good' | 'bad' | 'meh');
    
    // Save to history for undo
    ratingHistory.current.push({
      foodId: food.id,
      rating: rating as 'good' | 'bad' | 'meh'
    });
    
    // Enable undo
    setCanUndo(true);
    
    // Update counters
    setRatedPhotos(prev => prev + 1);
    
    // Move to next photo
    setCurrentIndex(prev => prev + 1);
    
    // Update rating stats
    updateRatingStats();
    
    // If we've gone through all photos, reload the data
    if (currentIndex >= foodData.length - 1) {
      loadData();
    }
  }, [currentIndex, foodData.length, loadData, updateRatingStats]);
  
  // Reset all ratings
  const handleResetRatings = useCallback(async () => {
    Alert.alert(
      'Reset Ratings',
      'Are you sure you want to reset all photo ratings? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: async () => {
            await clearPhotoRatings();
            loadData();
          }
        },
      ]
    );
  }, [loadData]);
  
  // Export ratings to a JSON file
  const handleExportRatings = useCallback(async () => {
    try {
      const fileName = `food_ratings_${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      // Get ratings and export to JSON
      const jsonData = await exportRatingsToJSON();
      
      // Write to file
      await FileSystem.writeAsStringAsync(fileUri, jsonData, {
        encoding: FileSystem.EncodingType.UTF8
      });
      
      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Food Ratings',
          UTI: 'public.json'
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error exporting ratings:', error);
      Alert.alert('Error', 'Failed to export ratings. Please try again.');
    }
  }, []);
  
  // Import ratings from a JSON file
  const handleImportRatings = useCallback(async () => {
    try {
      // Pick a JSON file
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });
      
      if (!result.assets || result.assets.length === 0 || result.canceled) {
        return; // User cancelled or no file selected
      }
      
      const selectedFile = result.assets[0];
      
      // Read the file content
      const fileContent = await FileSystem.readAsStringAsync(selectedFile.uri);
      
      // Show confirmation dialog
      Alert.alert(
        'Import Ratings',
        'Do you want to merge these ratings with your existing ones, or replace all your ratings?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Merge',
            onPress: async () => {
              // Import and merge with existing ratings
              await importRatingsFromJSON(fileContent, false);
              Alert.alert('Success', 'Ratings imported and merged successfully');
              loadData();
            }
          },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: async () => {
              // Import and replace existing ratings
              await importRatingsFromJSON(fileContent, true);
              Alert.alert('Success', 'Ratings imported and replaced successfully');
              loadData();
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error importing ratings:', error);
      Alert.alert('Error', 'Failed to import ratings. Please try again.');
    }
  }, [loadData]);
  
  // Open ratings summary modal
  const handleShowRatings = useCallback(() => {
    updateRatingStats();
    setShowRatingsModal(true);
  }, [updateRatingStats]);
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <Stack.Screen 
          options={{
            title: 'Rate Photos',
            headerLeft: () => (
              <TouchableOpacity 
                onPress={handleUndo} 
                disabled={!canUndo}
                style={[styles.headerButton, !canUndo && styles.headerButtonDisabled]}
              >
                <Ionicons name="arrow-back-circle" size={28} color={canUndo ? "#FF3B5C" : "#CCCCCC"} />
              </TouchableOpacity>
            ),
            headerRight: () => (
              <View style={styles.headerButtonsContainer}>
                <TouchableOpacity 
                  onPress={handleShowRatings} 
                  style={styles.headerRightButton}
                >
                  <MaterialIcons name="data-usage" size={24} color="#FF3B5C" />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleResetRatings} 
                  style={styles.headerRightButton}
                >
                  <Ionicons name="refresh" size={24} color="#FF3B5C" />
                </TouchableOpacity>
              </View>
            ),
          }} 
        />
        
        {isLoading ? (
          <ActivityIndicator size="large" color="#FF3B5C" />
        ) : foodData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="check-circle" size={60} color="#01DF8B" />
            <Text style={styles.emptyText}>All photos have been rated!</Text>
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleExportRatings}
              >
                <Ionicons name="share-outline" size={18} color="white" />
                <Text style={styles.actionButtonText}>Export Ratings</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleImportRatings}
              >
                <Ionicons name="download-outline" size={18} color="white" />
                <Text style={styles.actionButtonText}>Import Ratings</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, styles.dangerButton]}
                onPress={handleResetRatings}
              >
                <Ionicons name="refresh" size={18} color="white" />
                <Text style={styles.actionButtonText}>Reset All</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.statsContainer}>
              <Text style={styles.statsText}>
                Rated: {ratedPhotos} / {totalPhotos} photos ({Math.round((ratedPhotos / totalPhotos) * 100)}%)
              </Text>
            </View>
            
            {foodData.length > currentIndex && (
              <View style={styles.currentItemInfo}>
                <Text style={styles.currentItemName} numberOfLines={2}>
                  {foodData[currentIndex].name}
                </Text>
                <Text style={styles.currentItemRestaurant}>
                  {foodData[currentIndex].restaurant} • {foodData[currentIndex].price}
                </Text>
              </View>
            )}
            
            <View style={styles.instructionsButtons}>
              <View style={styles.swipeButton}>
                <Ionicons name="arrow-back" size={24} color="#FF3B5C" />
                <Text style={styles.swipeButtonText}>Bad</Text>
              </View>
              <View style={styles.swipeButton}>
                <Ionicons name="arrow-up" size={24} color="#FFA500" />
                <Text style={styles.swipeButtonText}>Meh</Text>
              </View>
              <View style={styles.swipeButton}>
                <Ionicons name="arrow-forward" size={24} color="#01DF8B" />
                <Text style={styles.swipeButtonText}>Good</Text>
              </View>
            </View>
            
            <View style={styles.cardContainer}>
              {foodData.map((food, index) => {
                const isFirst = index === currentIndex;
                
                // Render more cards for smoother transitions but keep them hidden until needed
                // This prevents the "changing image" effect by having cards already rendered
                if (index < currentIndex || index >= currentIndex + 10) return null;
                
                return (
                  <FoodCard
                    key={`food-${food.id}`} // Keep stable key to prevent re-rendering
                    food={food}
                    onSwipe={handleSwipe}
                    isFirst={isFirst}
                    index={index - currentIndex}
                  />
                );
              })}
            </View>
            
            {/* Add Undo Button */}
            <View style={styles.undoButtonContainer}>
              <TouchableOpacity
                style={[styles.undoButton, !canUndo && styles.undoButtonDisabled]}
                onPress={handleUndo}
                disabled={!canUndo}
              >
                <Ionicons name="arrow-undo" size={18} color="white" />
                <Text style={styles.undoButtonText}>Undo Last Rating</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        
        {/* Ratings Summary Modal */}
        <Modal
          visible={showRatingsModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowRatingsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Ratings Summary</Text>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setShowRatingsModal(false)}
                >
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody}>
                <View style={styles.statsSection}>
                  <Text style={styles.sectionTitle}>Statistics</Text>
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, styles.goodStat]}>{ratingStats.good}</Text>
                      <Text style={styles.statLabel}>Good</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, styles.mehStat]}>{ratingStats.meh}</Text>
                      <Text style={styles.statLabel}>Meh</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, styles.badStat]}>{ratingStats.bad}</Text>
                      <Text style={styles.statLabel}>Bad</Text>
                    </View>
                  </View>
                  <View style={styles.statPieContainer}>
                    <View style={[
                      styles.statPiePiece, 
                      styles.goodPiece, 
                      { flex: ratingStats.good || 1 }
                    ]} />
                    <View style={[
                      styles.statPiePiece, 
                      styles.mehPiece, 
                      { flex: ratingStats.meh || 1 }
                    ]} />
                    <View style={[
                      styles.statPiePiece, 
                      styles.badPiece, 
                      { flex: ratingStats.bad || 1 }
                    ]} />
                  </View>
                </View>
                
                <View style={styles.actionsSection}>
                  <Text style={styles.sectionTitle}>Export/Import Ratings</Text>
                  <Text style={styles.sectionDescription}>
                    Export your ratings to share with others, or import ratings from other users to combine results.
                  </Text>
                  
                  <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => {
                        setShowRatingsModal(false);
                        setTimeout(() => {
                          handleExportRatings();
                        }, 500); // Delay to allow modal to close
                      }}
                    >
                      <Ionicons name="share-outline" size={18} color="white" />
                      <Text style={styles.actionButtonText}>Export Ratings</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => {
                        setShowRatingsModal(false);
                        setTimeout(() => {
                          handleImportRatings();
                        }, 500); // Delay to allow modal to close
                      }}
                    >
                      <Ionicons name="download-outline" size={18} color="white" />
                      <Text style={styles.actionButtonText}>Import Ratings</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.instructionsSection}>
                  <Text style={styles.sectionTitle}>How to Combine Results</Text>
                  <Text style={styles.instructionText}>
                    1. Have each user export their ratings using the Export button.
                  </Text>
                  <Text style={styles.instructionText}>
                    2. Collect all the exported JSON files in one place.
                  </Text>
                  <Text style={styles.instructionText}>
                    3. On the device where you want to combine results, use the Import button to load each JSON file.
                  </Text>
                  <Text style={styles.instructionText}>
                    4. Choose "Merge" when importing each file to combine the ratings.
                  </Text>
                  <Text style={styles.instructionText}>
                    5. After importing all files, you can export the combined results.
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statsContainer: {
    padding: 12,
    alignItems: 'center',
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#777',
  },
  currentItemInfo: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 12,
    borderRadius: 12,
    width: '92%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  currentItemName: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#222',
  },
  currentItemRestaurant: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  instructionsButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 5,
  },
  swipeButton: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  swipeButtonText: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '600',
    color: '#333',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 30,
    textAlign: 'center',
  },
  resetButton: {
    padding: 8,
  },
  resetAllButton: {
    backgroundColor: '#FF3B5C',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
  },
  resetAllButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  undoButtonContainer: {
    position: 'absolute',
    bottom: 85,
    width: '100%',
    alignItems: 'center',
    padding: 10,
    zIndex: 100,
  },
  undoButton: {
    backgroundColor: '#FF3B5C',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  undoButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  undoButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  headerButton: {
    padding: 8,
    marginLeft: 4,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRightButton: {
    padding: 8,
    marginLeft: 4,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
    maxHeight: '70%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  statsSection: {
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  goodStat: {
    color: '#01DF8B',
  },
  mehStat: {
    color: '#FFA500',
  },
  badStat: {
    color: '#FF3B5C',
  },
  statPieContainer: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 8,
  },
  statPiePiece: {
    height: '100%',
  },
  goodPiece: {
    backgroundColor: '#01DF8B',
  },
  mehPiece: {
    backgroundColor: '#FFA500',
  },
  badPiece: {
    backgroundColor: '#FF3B5C',
  },
  actionsSection: {
    marginBottom: 24,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  actionButton: {
    backgroundColor: '#FF3B5C',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    margin: 8,
  },
  dangerButton: {
    backgroundColor: '#FF3B5C',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  instructionsSection: {
    marginBottom: 20,
  },
  instructionText: {
    fontSize: 14,
    color: '#444',
    marginBottom: 12,
    lineHeight: 20,
  },
}); 