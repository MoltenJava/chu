import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
// Removed Ionicons import as close button is removed

// Define new color palette (using colors consistent with other modals)
const colorBackground = '#FFFFFF'; // White modal background
const colorTextPrimary = '#212121'; // Dark Gray (adjust if needed)
const colorTextSecondary = '#666666'; // Standard secondary text color
const colorBorder = '#E0E0E0';     // Light Gray
const colorAccent = '#FF6F61';     // Coral Pink
const colorWhite = '#FFFFFF';
const colorShadow = '#BDBDBD';     // Medium Gray for shadows
const colorModalOverlay = 'rgba(0, 0, 0, 0.5)'; // Semi-transparent overlay
const colorCancelBackground = '#f2f2f2'; // Background for cancel button

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
      onRequestClose={isLoading ? undefined : onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Close button removed for consistency */}
          
          <Text style={styles.title}>Couple Mode</Text>
          <Text style={styles.description}>
            Start a new session to swipe with your partner, or join theirs using a code.
          </Text>

          {/* Use View for button spacing */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, isLoading && styles.buttonDisabled]}
              onPress={onCreate}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colorWhite} />
              ) : (
                <Text style={[styles.buttonText, styles.primaryButtonText]}>
                  Create Session
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, isLoading && styles.buttonDisabled]}
              onPress={() => {
                onJoin();
              }}
              disabled={isLoading}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                Join Session
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.cancelButton, isLoading && styles.buttonDisabled]}
              onPress={isLoading ? undefined : onClose}
              disabled={isLoading}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: { // Updated to match other modals
    width: '80%',
    maxWidth: 400,
    backgroundColor: colorBackground,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center', // Keep content centered
    shadowColor: colorShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  // closeButton style removed
  title: { // Updated to match other modals
    fontSize: 24,
    fontWeight: 'bold',
    color: colorTextPrimary, // Ensure primary text color is used if needed
    marginBottom: 12,
    textAlign: 'center',
  },
  description: { // Updated to match other modals
    fontSize: 16,
    color: colorTextSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22, // Kept for readability
  },
  buttonContainer: { // Added container for consistent spacing
    width: '100%', // Ensure buttons take full width of container
    gap: 12, // Spacing from other modals
  },
  button: {
    width: '100%',
    paddingVertical: 16, // Match other modals padding
    borderRadius: 8, // Match other modals radius
    alignItems: 'center',
    // Removed marginBottom, using gap in container now
  },
  primaryButton: { // Create button style
    backgroundColor: colorAccent,
    minHeight: 50,
    justifyContent: 'center',
  },
  secondaryButton: { // Join button style (White bg, accent border)
    backgroundColor: colorWhite,
    borderWidth: 1.5, // Slightly thicker border for visibility
    borderColor: colorAccent,
  },
  cancelButton: { // Cancel button style (matches other modals)
    backgroundColor: colorCancelBackground,
  },
  buttonText: { // Base button text style
    fontSize: 16,
    fontWeight: 'bold', // Match other modals
  },
  primaryButtonText: { // Text for Create button
    color: colorWhite,
  },
  secondaryButtonText: { // Text for Join button
    color: colorAccent,
  },
  cancelButtonText: { // Text for Cancel button (matches others)
    color: colorTextSecondary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default CoupleModeOptionsModal; 