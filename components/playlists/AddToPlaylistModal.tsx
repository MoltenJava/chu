import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Playlist } from '../../types/playlists'; // Import defined types
import { getUserPlaylists, createPlaylist, addItemToPlaylist } from '../../utils/playlistService'; // Import implemented service
import * as CoupleContext from '../../context/CoupleContext'; // For user ID
import { Ionicons } from '@expo/vector-icons';

interface AddToPlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  menuItemId: string | null; // The item being added
}

const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({ visible, onClose, menuItemId }) => {
  const { user } = CoupleContext.useCoupleContext();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylists, setSelectedPlaylists] = useState<Set<string>>(new Set());
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const fetchUserPlaylists = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch user's playlists, excluding the default "All Saved Items"
      const fetchedPlaylists = await getUserPlaylists(user.id);
      setPlaylists(fetchedPlaylists.filter(p => p.name !== "All Saved Items"));
    } catch (error) {
      console.error("Error fetching playlists for modal:", error);
      Alert.alert("Error", "Could not load your playlists.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (visible && user) {
      fetchUserPlaylists();
      setSelectedPlaylists(new Set()); // Reset selection
      setNewPlaylistName(''); // Reset input
    }
  }, [visible, user, fetchUserPlaylists]);

  const handleTogglePlaylist = (playlistId: string) => {
    setSelectedPlaylists(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(playlistId)) {
        newSelection.delete(playlistId);
      } else {
        newSelection.add(playlistId);
      }
      return newSelection;
    });
  };

  const handleCreateAndAdd = async () => {
    if (!user || !menuItemId || !newPlaylistName.trim()) return;
    setAdding(true);
    try {
      console.log(`Creating playlist "${newPlaylistName}" and adding item ${menuItemId}`);
      // 1. Create the new playlist
      const newPlaylist = await createPlaylist(user.id, newPlaylistName.trim());
      // 2. Add the item to the new playlist
      const success = await addItemToPlaylist(user.id, newPlaylist.id, menuItemId);
      if (success) {
        Alert.alert("Success", `Added to new playlist "${newPlaylist.name}"!`);
        onClose(); // Close modal on success
      } else {
        Alert.alert("Error", "Failed to add item to the new playlist.");
      }
    } catch (error) {
      console.error("Error creating playlist and adding item:", error);
      Alert.alert("Error", "Could not create playlist or add item.");
    } finally {
      setAdding(false);
    }
  };

  const handleAddToSelected = async () => {
    if (!user || !menuItemId || selectedPlaylists.size === 0) return;
    setAdding(true);
    let successCount = 0;
    const playlistIds = Array.from(selectedPlaylists);
    console.log(`Adding item ${menuItemId} to playlists:`, playlistIds);

    try {
        // Use Promise.all to add to all selected playlists concurrently
        const results = await Promise.all(
            playlistIds.map(playlistId => 
                addItemToPlaylist(user.id, playlistId, menuItemId)
            )
        );
        successCount = results.filter(success => success).length;

        if (successCount > 0) {
            Alert.alert("Success", `Added item to ${successCount} playlist(s).`);
            onClose(); // Close modal if at least one addition was successful
        } else {
            Alert.alert("Error", "Failed to add item to the selected playlists.");
        }
    } catch (error) {
        console.error("Error adding item to selected playlists:", error);
        Alert.alert("Error", "An unexpected error occurred while adding the item.");
    } finally {
        setAdding(false);
    }
  };

  const renderPlaylistItem = ({ item }: { item: Playlist }) => (
    <TouchableOpacity
      style={[styles.playlistItem, selectedPlaylists.has(item.id) && styles.playlistItemSelected]}
      onPress={() => handleTogglePlaylist(item.id)}
      disabled={adding} // Disable while adding
    >
      <Text style={styles.playlistEmoji}>{item.emoji || ' L'}</Text> 
      <Text style={styles.playlistName}>{item.name}</Text>
      <View style={[styles.checkbox, selectedPlaylists.has(item.id) && styles.checkboxSelected]}>
          {selectedPlaylists.has(item.id) && <Ionicons name="checkmark" size={14} color="white" />}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
              <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                  <Text style={styles.title}>Add to Playlist</Text>

                  {loading ? (
                      <ActivityIndicator style={styles.loader} size="small" color="#FF6F61" />
                  ) : (
                      <FlatList
                          data={playlists}
                          renderItem={renderPlaylistItem}
                          keyExtractor={(item) => item.id}
                          style={styles.list}
                          ListEmptyComponent={<Text style={styles.emptyText}>No custom playlists yet. Create one below!</Text>}
                      />
                  )}

                  <View style={styles.newPlaylistContainer}>
                      <TextInput
                          style={styles.input}
                          placeholder="Create new playlist..."
                          value={newPlaylistName}
                          onChangeText={setNewPlaylistName}
                          editable={!adding} // Disable while adding
                      />
                      <TouchableOpacity
                          style={[styles.button, styles.createButton, (!newPlaylistName.trim() || adding) && styles.buttonDisabled]}
                          onPress={handleCreateAndAdd}
                          disabled={!newPlaylistName.trim() || adding}
                      >
                          {adding && !selectedPlaylists.size ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.buttonText}>Create & Add</Text>}
                      </TouchableOpacity>
                  </View>

                  <View style={styles.actionsContainer}>
                      <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={adding}>
                          <Text style={styles.buttonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                          style={[styles.button, styles.addButton, (selectedPlaylists.size === 0 || adding) && styles.buttonDisabled]}
                          onPress={handleAddToSelected}
                          disabled={selectedPlaylists.size === 0 || adding}
                       >
                          {adding && selectedPlaylists.size > 0 ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.buttonText}>Add to Selected</Text>}
                      </TouchableOpacity>
                  </View>
              </View>
          </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30, maxHeight: '75%' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333' },
  loader: { marginVertical: 20 },
  list: { maxHeight: 250, marginBottom: 15, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#eee' }, 
  playlistItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  playlistItemSelected: { backgroundColor: '#FFF0ED' },
  playlistEmoji: { fontSize: 16, marginRight: 10 },
  playlistName: { fontSize: 16, flex: 1, color: '#444' },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  checkboxSelected: { backgroundColor: '#FF6F61', borderColor: '#FF6F61' },
  emptyText: { textAlign: 'center', color: '#888', marginVertical: 20, fontStyle: 'italic' },
  newPlaylistContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 20 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginRight: 10, fontSize: 15 },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  button: { paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, alignItems: 'center', flex: 1, marginHorizontal: 5 },
  buttonDisabled: { opacity: 0.6 },
  createButton: { backgroundColor: '#4CAF50' }, // Green
  addButton: { backgroundColor: '#FF6F61' }, // Accent
  cancelButton: { backgroundColor: '#aaa' }, // Gray
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
});

export default AddToPlaylistModal; 