import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native'; // Import useNavigation
import { Playlist } from '../../types/playlists'; // Import defined type
import { getUserPlaylists } from '../../utils/playlistService'; // Import implemented service
import * as CoupleContext from '../../context/CoupleContext'; // Import context for user
import PlaylistCard from './PlaylistCard'; // Import the card component
import { Ionicons } from '@expo/vector-icons'; // For create button icon

// Define types for the navigation prop for this stack
// Note: Since this is presented modally, navigation might behave differently
// We might need a more specific type from the root Stack navigator eventually
type PlaylistModalNavigationProp = {
  navigate: (
      screen: 'playlistDetail', 
      params: { playlistId: string; playlistName: string } // Define params
  ) => void;
  // Add other routes if needed, e.g., navigate('createPlaylist')
};

const PlaylistListScreen = () => { // Remove navigation from props
  const { user } = CoupleContext.useCoupleContext(); // Get user from context
  // Type casting might be needed depending on where this is rendered
  const navigation = useNavigation<PlaylistModalNavigationProp>(); 
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlaylists = useCallback(async () => {
    if (!user) {
      setError("User not found. Please log in.");
      setLoading(false);
      return;
    }
    console.log('[PlaylistListScreen] Fetching playlists for user:', user.id);
    setLoading(true);
    setError(null);
    try {
      const fetchedPlaylists = await getUserPlaylists(user.id);
      setPlaylists(fetchedPlaylists);
    } catch (err) {
      console.error('[PlaylistListScreen] Error fetching playlists:', err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      Alert.alert("Error", "Could not load your playlists. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Use useFocusEffect to refetch data when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) { // Only fetch if user is logged in
          fetchPlaylists();
      }
    }, [fetchPlaylists, user]) // Add user dependency
  );

  const handleNavigateToDetail = (playlist: Playlist) => {
    // Navigate to the detail screen WITHIN the modal stack
    navigation.navigate('playlistDetail', { 
        playlistId: playlist.id, 
        playlistName: playlist.name 
    });
  };
  
  const handleNavigateToCreate = () => {
      // TODO: Navigate to a dedicated CreatePlaylistScreen or show a modal
      console.log("Navigate to create playlist...");
      Alert.alert("Create Playlist", "Navigation to create playlist screen not implemented yet.");
      // Example: navigation.navigate('createPlaylist'); 
  };

  // Added check for user non-existence after loading
  if (!user && !loading) {
      return <View style={styles.centered}><Text style={styles.errorText}>Please log in to view your playlists.</Text></View>;
  }

  const renderPlaylist = ({ item }: { item: Playlist }) => (
    <PlaylistCard 
      playlist={item} 
      onPress={() => handleNavigateToDetail(item)} 
    />
  );

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#FF6F61" /><Text style={styles.loadingText}>Loading Playlists...</Text></View>;
  }

  if (error) {
    return <View style={styles.centered}><Text style={styles.errorText}>Error: {error}</Text><TouchableOpacity onPress={fetchPlaylists}><Text style={styles.retryText}>Tap to retry</Text></TouchableOpacity></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* The header is now provided by the Stack navigator in app/_layout.tsx */}
      {/* We can add buttons to THIS header using navigation.setOptions */}
      {/* Example: Add create button to header */}
      {/* React.useLayoutEffect(() => {
        navigation.setOptions({
          headerRight: () => (
            <TouchableOpacity onPress={handleNavigateToCreate} style={{ marginRight: 15 }}>
              <Ionicons name="add-circle-outline" size={26} color="#FF6F61" />
            </TouchableOpacity>
          ),
        });
      }, [navigation, handleNavigateToCreate]); */} 
      
      <FlatList
        data={playlists}
        renderItem={renderPlaylist}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
            !loading ? (
                <View style={styles.centered}>
                    <Text style={styles.emptyText}>No playlists yet!</Text>
                    <Text style={styles.emptySubText}>Swipe right on foods or tap '+' to create one.</Text>
                </View>
            ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  listContent: { 
      paddingTop: 10,
      paddingBottom: 10, 
      flexGrow: 1, 
  },
  loadingText: {
      marginTop: 10,
      fontSize: 16,
      color: '#757575',
  },
  errorText: {
      fontSize: 16,
      color: '#D32F2F',
      textAlign: 'center',
      marginBottom: 10,
  },
  retryText: {
      fontSize: 16,
      color: '#007AFF',
      marginTop: 10,
  },
  emptyText: {
      fontSize: 18,
      color: '#757575', 
      marginBottom: 5,
      textAlign: 'center',
  },
  emptySubText: {
      fontSize: 14,
      color: '#BDBDBD',
      textAlign: 'center',
  },
});

export default PlaylistListScreen; 