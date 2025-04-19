import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'; // Import useRoute
import { PlaylistItemWithDetails } from '../../types/playlists'; // Use the specific type
import { getPlaylistItems, clearPlaylist, removeItemFromPlaylist } from '../../utils/playlistService'; // Import implemented services
import PlaylistItemCard from './PlaylistItemCard'; // Import the item card component
import * as CoupleContext from '../../context/CoupleContext'; // Import the context

// Define types for the navigation/route props for this stack
type PlaylistDetailRouteParams = { playlistId: string; playlistName: string };
type PlaylistDetailNavigationProp = {
  setOptions: (options: { title?: string }) => void;
  // Add other navigation methods if needed (e.g., goBack)
};

const PlaylistDetailScreen = () => { // Remove props
  // Use hooks to get route params and navigation
  const route = useRoute();
  const navigation = useNavigation<PlaylistDetailNavigationProp>(); 
  const { playlistId, playlistName } = route.params as PlaylistDetailRouteParams;
  const { user } = CoupleContext.useCoupleContext(); // Use the correct hook
  const [items, setItems] = useState<PlaylistItemWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDefaultPlaylist = playlistName === "All Saved Items"; // Check if it's the default

  const fetchItems = useCallback(async () => {
    console.log(`[PlaylistDetailScreen] Fetching items for playlist: ${playlistId}`);
    setLoading(true);
    setError(null);
    try {
      const fetchedItems = await getPlaylistItems(playlistId);
      setItems(fetchedItems);
    } catch (err) {
      console.error('[PlaylistDetailScreen] Error fetching items:', err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      Alert.alert("Error", "Could not load playlist items. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [playlistId]);

  // Fetch items when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
        if (user) { // Only fetch if user is available
            fetchItems();
        }
    }, [fetchItems, user]) // Add user dependency
  );

  // Set header title dynamically
  React.useLayoutEffect(() => {
    navigation.setOptions({ title: playlistName });
  }, [navigation, playlistName]);

  const handleClearPlaylist = async () => {
    if (!user) { // Added check for user existence
        Alert.alert("Error", "You must be logged in to clear a playlist.");
        return;
    } 

      Alert.alert(
          "Clear Playlist",
          `Are you sure you want to remove all items from "${playlistName}"? This cannot be undone.`,
          [
              { text: "Cancel", style: "cancel" },
              {
                  text: "Clear All",
                  style: "destructive",
                  onPress: async () => {
                      console.log(`Clearing playlist: ${playlistId}`);
                      setLoading(true); // Show loading indicator
                      try {
                          const success = await clearPlaylist(playlistId, user.id);
                          if (success) {
                              setItems([]); // Optimistically update UI
                          } else {
                              Alert.alert("Error", "Could not clear the playlist.");
                          }
                      } catch (err) {
                          console.error("Error clearing playlist:", err);
                          Alert.alert("Error", "An unexpected error occurred while clearing the playlist.");
                      } finally {
                          setLoading(false);
                      }
                  }
              }
          ]
      );
  };

  const handleRemoveItem = async (playlistItemId: string) => {
    if (!user) { // Added check for user existence
        Alert.alert("Error", "You must be logged in to remove an item.");
        return;
    } 

    console.log(`Removing item ${playlistItemId} from playlist ${playlistId}`);
    // Optimistically remove from UI
    setItems(prevItems => prevItems.filter(item => item.id !== playlistItemId));

    try {
      const success = await removeItemFromPlaylist(playlistItemId, user.id);
      if (!success) {
          // Removal failed, revert UI change (refetch or add back)
          Alert.alert("Error", "Could not remove the item. It may have already been removed.");
          fetchItems(); // Refetch to get actual state
      }
    } catch (err) {
        console.error("Error removing item:", err);
        Alert.alert("Error", "An unexpected error occurred while removing the item.");
        fetchItems(); // Refetch to get actual state
    }
  };

  const handleCopyItem = (menuItemId: string) => {
      console.log(`Triggering AddToPlaylistModal for menu item: ${menuItemId}`);
      // TODO: Implement showing the AddToPlaylistModal here
      // Pass the menuItemId to the modal
      Alert.alert("Copy Item", "Functionality to copy item to another playlist not implemented yet.");
  };
  
  const handleItemPress = (item: PlaylistItemWithDetails) => {
      console.log("Item pressed:", item.menu_item?.name);
      // TODO: Navigate to a detailed food item view? Or expand inline?
      Alert.alert("View Item", "Navigation to detailed item view not implemented yet.");
  };

  const renderItem = ({ item }: { item: PlaylistItemWithDetails }) => (
    <PlaylistItemCard
      item={item}
      onPress={() => handleItemPress(item)}
      onRemove={handleRemoveItem} // Pass handler
      onAddToOtherPlaylist={handleCopyItem} // Pass handler
    />
  );

  // Added check for user non-existence after loading
  if (!user && !loading) {
      return <View style={styles.centered}><Text style={styles.errorText}>Please log in to view your playlists.</Text></View>;
  }

  if (loading && items.length === 0) { // Show full loading indicator only on initial load
    return <View style={styles.centered}><ActivityIndicator size="large" color="#FF6F61" /><Text style={styles.loadingText}>Loading Items...</Text></View>;
  }

  if (error && items.length === 0) { // Show full error only if no items are loaded
    return <View style={styles.centered}><Text style={styles.errorText}>Error: {error}</Text><TouchableOpacity onPress={fetchItems}><Text style={styles.retryText}>Tap to retry</Text></TouchableOpacity></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
       {isDefaultPlaylist && (
          <TouchableOpacity style={styles.clearButton} onPress={handleClearPlaylist} disabled={loading || !user}>
              <Text style={styles.clearButtonText}>Clear All Saved Items</Text>
          </TouchableOpacity>
       )}
       {/* Show a smaller loading indicator during refresh/background operations */} 
       {loading && items.length > 0 && (
           <ActivityIndicator style={styles.inlineLoader} size="small" color="#FF6F61" />
       )}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
            !loading ? ( // Only show empty message if not loading
                <View style={styles.centered}><Text style={styles.emptyText}>This playlist is empty.</Text></View>
            ) : null
        }
        contentContainerStyle={items.length === 0 ? styles.centeredContent : styles.listContent}
        // Add pull-to-refresh maybe?
        // onRefresh={fetchItems}
        // refreshing={loading} 
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  centeredContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' }, // For empty list centering
  listContent: { paddingBottom: 10 },
  loadingText: { marginTop: 10, fontSize: 16, color: '#757575' },
  errorText: { fontSize: 16, color: '#D32F2F', textAlign: 'center', marginBottom: 10 },
  retryText: { fontSize: 16, color: '#007AFF', marginTop: 10 },
  emptyText: { fontSize: 18, color: '#757575', textAlign: 'center' },
  clearButton: { 
      backgroundColor: '#FFEDED', 
      padding: 12, 
      marginVertical: 8,
      marginHorizontal: 10, 
      borderRadius: 8, 
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#FFCDD2',
  },
  clearButtonText: { color: '#FF3B30', fontWeight: '500' },
  inlineLoader: {
      marginVertical: 10,
  }
});

export default PlaylistDetailScreen; 