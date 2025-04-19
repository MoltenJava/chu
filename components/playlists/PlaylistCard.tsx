import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Playlist } from '../../types/playlists'; // Import defined type

interface PlaylistCardProps {
  playlist: Playlist;
  onPress: () => void;
}

const PlaylistCard: React.FC<PlaylistCardProps> = ({ playlist, onPress }) => {
  return (
    <TouchableOpacity style={styles.playlistItem} onPress={onPress}>
      <Text style={styles.playlistEmoji}>{playlist.emoji || '🍽️'}</Text>
      <View style={styles.playlistTextContainer}>
        <Text style={styles.playlistName}>{playlist.name}</Text>
        {playlist.description && <Text style={styles.playlistDescription}>{playlist.description}</Text>}
      </View>
      {/* Optional: Add item count, arrow icon etc. */}
      {/* <Text style={styles.itemCount}>10 items</Text> */}
      {/* <Text style={styles.arrow}>{">"}</Text> */}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    marginVertical: 5,
    marginHorizontal: 10,
    borderRadius: 10,
    elevation: 1,
    shadowColor: '#BDBDBD',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  playlistEmoji: {
    fontSize: 24,
    marginRight: 15,
  },
  playlistTextContainer: {
    flex: 1,
  },
  playlistName: {
    fontSize: 18,
    fontWeight: '500',
    color: '#212121',
  },
  playlistDescription: {
    fontSize: 14,
    color: '#757575',
    marginTop: 2,
  },
  itemCount: {
      fontSize: 14,
      color: '#757575',
      marginHorizontal: 10,
  },
  arrow: {
      fontSize: 18,
      color: '#BDBDBD',
  }
});

export default PlaylistCard; 