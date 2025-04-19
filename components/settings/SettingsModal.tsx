import React, { useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

// Define Colors
const colorAccent = '#FF6F61';
const colorWhite = '#FFFFFF';
const colorTextPrimary = '#212121';
const colorTextSecondary = '#757575';
const colorBorder = '#E0E0E0';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[SettingsModal] Attempting logout...');
              onClose(); // Close settings modal first
              const { error } = await supabase.auth.signOut();
              if (error) {
                console.error('Error logging out:', error);
                Alert.alert('Logout Error', error.message);
              } else {
                console.log('[SettingsModal] Logout successful. Redirecting...');
                router.replace('/(auth)/login');
              }
            } catch (e) {
              console.error('Unexpected error during logout:', e);
              Alert.alert('Logout Error', 'An unexpected error occurred.');
            }
          },
        },
      ]
    );
  }, [onClose, router]);

  return (
    <Modal
      animationType="slide"
      transparent={true} // Make it appear over the SavedItemsModal
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose} // Close when tapping overlay
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Prevent closing when tapping inside the content */}
          <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
             <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Settings</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close" size={28} color={colorTextSecondary} />
                </TouchableOpacity>
             </View>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={22} color={colorWhite} style={styles.logoutIcon} />
              <Text style={styles.logoutButtonText}>Log Out</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </SafeAreaView>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    justifyContent: 'center', // Center vertically
    alignItems: 'center', // Center horizontally
    paddingHorizontal: 20, // Add padding to prevent touching edges
  },
  safeArea: {
     backgroundColor: 'transparent', 
     width: '100%', // Ensure SafeArea takes width for alignment
  },
  modalContent: {
    backgroundColor: '#F8F8F8', 
    borderRadius: 15, // Add border radius for centered appearance
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 25, // Adjusted padding
    width: '90%', // Make it slightly less than full width
    maxWidth: 400, // Add a max width
    alignItems: 'center',
    // Remove borderTopLeftRadius, borderTopRightRadius as it's fully rounded now
    shadowColor: "#000", // Optional: Add shadow for depth
    shadowOffset: {
        width: 0,
        height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
   modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 25, 
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colorTextPrimary,
  },
  closeButton: {
    padding: 5,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: colorAccent,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 180, // Give button some minimum width
    shadowColor: colorAccent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  logoutIcon: {
      marginRight: 10,
  },
  logoutButtonText: {
    color: colorWhite,
    fontSize: 17,
    fontWeight: '600',
  },
});

export default SettingsModal; 