import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupabaseMenuItem } from '@/types/supabase';

interface CameraSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  savedItems: SupabaseMenuItem[];
  onSelectItem: (item: SupabaseMenuItem) => void;
}

const CameraSelectionModal: React.FC<CameraSelectionModalProps> = ({
  visible,
  onClose,
  savedItems,
  onSelectItem,
}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.cameraSelectionModalContent}>
          <View style={styles.cameraModalHeader}>
            <Text style={styles.cameraModalTitle}>Take a Photo</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#555" />
            </TouchableOpacity>
          </View>

          {savedItems.length === 0 ? (
            <View style={styles.emptyListContainer}>
              <Text style={styles.emptyListText}>Save some dishes first!</Text>
            </View>
          ) : (
            <FlatList
              data={savedItems}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.cameraSelectionItem}
                  onPress={() => {
                    onSelectItem(item);
                    onClose();
                    Alert.alert(
                      'Camera Opening',
                      `Taking a photo of ${item.title}...`,
                      [{ text: 'OK' }]
                    );
                  }}
                >
                  <Image source={{ uri: item.s3_url }} style={styles.cameraSelectionImage} />
                  <View style={styles.cameraSelectionInfo}>
                    <Text style={styles.cameraSelectionName}>{item.title}</Text>
                    <Text style={styles.cameraSelectionRestaurant}>{item.title}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraSelectionModalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  cameraModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cameraModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  emptyListContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  cameraSelectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cameraSelectionImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  cameraSelectionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  cameraSelectionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  cameraSelectionRestaurant: {
    fontSize: 14,
    color: '#666',
  },
});

export default CameraSelectionModal; 