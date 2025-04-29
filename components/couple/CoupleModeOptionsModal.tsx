import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, Dimensions } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Define new color palette
const colorBackground = '#FFFFFF';
const colorTextPrimary = '#222222';
const colorTextSecondary = '#666666';
const colorAccent = '#FF6F61';
const colorWhite = '#FFFFFF';
const colorShadow = '#BDBDBD';
const colorModalOverlay = 'rgba(0, 0, 0, 0.6)';

const { width } = Dimensions.get('window');

interface CoupleModeOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: () => void;
  onJoin: () => void;
  isLoading?: boolean;
}

export const CoupleModeOptionsModal: React.FC<CoupleModeOptionsModalProps> = ({
  visible,
  onClose,
  onCreate,
  onJoin,
  isLoading = false,
}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <TouchableOpacity 
          style={styles.overlay} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <View style={styles.modalView}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Start a Partee</Text>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colorTextSecondary} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.description}>
            Find dishes together! Create a new partee or join one using a code.
          </Text>
          
          <TouchableOpacity
            style={styles.createButton}
            onPress={onCreate}
            disabled={isLoading}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#FF8A80', '#FF6F61']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colorWhite} />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={20} color={colorWhite} />
                  <Text style={styles.createButtonText}>Create Partee</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.joinButton}
            onPress={onJoin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <MaterialIcons name="group-add" size={20} color={colorAccent} />
            <Text style={styles.joinButtonText}>Join Partee</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colorModalOverlay,
  },
  modalView: {
    width: width * 0.85,
    maxWidth: 360,
    backgroundColor: colorBackground,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colorTextPrimary,
  },
  closeButton: {
    padding: 4,
  },
  description: {
    fontSize: 16,
    color: colorTextSecondary,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  createButton: {
    height: 52,
    width: '100%',
    borderRadius: 30,
    marginBottom: 16,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
  },
  createButtonText: {
    color: colorWhite,
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  joinButton: {
    height: 52,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: colorAccent,
  },
  joinButtonText: {
    color: colorAccent,
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
});

export default CoupleModeOptionsModal; 