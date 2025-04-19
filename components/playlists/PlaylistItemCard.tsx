import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { PlaylistItemWithDetails } from '../../types/playlists'; // Use the specific type with details
import { Ionicons } from '@expo/vector-icons'; // Import icons

interface PlaylistItemCardProps {
  item: PlaylistItemWithDetails;
  onPress: () => void;
  onRemove?: (playlistItemId: string) => void; // For removing from this specific playlist
  onAddToOtherPlaylist?: (menuItemId: string) => void; // For copying to another playlist
}

const PlaylistItemCard: React.FC<PlaylistItemCardProps> = ({ 
    item, 
    onPress, 
    onRemove, 
    onAddToOtherPlaylist 
}) => {

  const handleRemove = () => {
      onRemove?.(item.id); // Pass the playlist_item id
  };

  const handleAddToOther = () => {
      onAddToOtherPlaylist?.(item.menu_item_id);
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      {/* Image */}
      {item.menu_item?.s3_url ? (
          <Image source={{ uri: item.menu_item.s3_url }} style={styles.image} />
      ) : (
          <View style={styles.imagePlaceholder}>
              <Ionicons name="restaurant-outline" size={24} color="#ccc" />
          </View>
      )}

      {/* Text Info */}
      <View style={styles.textContainer}>
        <Text style={styles.nameText} numberOfLines={2}>{item.menu_item?.name || 'Unknown Item'}</Text>
        <Text style={styles.restaurantText} numberOfLines={1}>{item.menu_item?.title || 'Unknown Restaurant'}</Text>
        {/* Optional: Display notes */} 
        {item.notes && <Text style={styles.notesText} numberOfLines={1}>Notes: {item.notes}</Text>}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
          {onAddToOtherPlaylist && (
              <TouchableOpacity style={styles.actionButton} onPress={handleAddToOther}>
                  {/* <Ionicons name="add-circle-outline" size={22} color="#007AFF" /> */}
                  <Text style={styles.actionText}>Copy</Text>
              </TouchableOpacity>
          )}
          {onRemove && (
              <TouchableOpacity style={styles.actionButton} onPress={handleRemove}>
                  {/* <Ionicons name="remove-circle-outline" size={22} color="#FF3B30" /> */}
                  <Text style={[styles.actionText, styles.removeText]}>Remove</Text>
              </TouchableOpacity>
          )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    marginVertical: 6,
    marginHorizontal: 10,
    elevation: 1,
    shadowColor: '#ccc',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    alignItems: 'center',
  },
  image: {
    width: 65,
    height: 65,
    borderRadius: 8,
    marginRight: 12,
  },
  imagePlaceholder: {
      width: 65,
      height: 65,
      borderRadius: 8,
      marginRight: 12,
      backgroundColor: '#f0f0f0',
      justifyContent: 'center',
      alignItems: 'center',
  },
  textContainer: {
    flex: 1, // Takes available space
    justifyContent: 'center',
    marginRight: 8, // Add some space before action buttons
  },
  nameText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  restaurantText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  notesText: {
      fontSize: 12,
      color: '#888',
      fontStyle: 'italic',
  },
  actionsContainer: {
      flexDirection: 'column', // Stack buttons vertically
      justifyContent: 'space-around', // Distribute space
      alignSelf: 'center',
  },
  actionButton: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 5,
      backgroundColor: '#f0f0f0',
      marginVertical: 3, // Add vertical space between buttons
      alignItems: 'center',
      minWidth: 60, // Ensure buttons have some width
  },
  actionText: {
      fontSize: 12,
      fontWeight: '500',
      color: '#007AFF', // Blue
  },
  removeText: {
      color: '#FF3B30', // Red
  },
});

export default PlaylistItemCard; 