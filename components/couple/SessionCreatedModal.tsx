import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  Alert,
  Clipboard,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CoupleSession } from '@/types/couple'; // Use the updated type

// Reusing color palette from SwipeableCards for consistency
const colorTextPrimary = '#212121';
const colorTextSecondary = '#757575';
const colorAccent = '#FF6F61';
const colorWhite = '#FFFFFF';
const colorBackground = '#FAFAFA';
const colorBorder = '#E0E0E0';

interface SessionCreatedModalProps {
  visible: boolean;
  onClose: () => void;
  session: CoupleSession | null;
}

const SessionCreatedModal: React.FC<SessionCreatedModalProps> = ({ visible, onClose, session }) => {

  const handleShare = () => {
    if (!session) return;
    Share.share({
      message: `Join my Chewzee couple session! Use code: ${session.session_code}`,
      title: 'Join Chewzee Couple Session'
    }).catch(error => {
        console.error('Error sharing session code:', error);
        Alert.alert('Sharing Failed', 'Could not share the session code.');
    });
  };

  const handleCopy = () => {
    if (!session) return;
    Clipboard.setString(session.session_code);
    Alert.alert('Copied!', `Session code ${session.session_code} copied to clipboard.`);
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose} // Allow closing via back button on Android
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Session Created!</Text>
          <Text style={styles.subtitle}>Share this code with your partner:</Text>
          
          <TouchableOpacity onPress={handleCopy} activeOpacity={0.7} style={styles.codeContainer}>
            <Text style={styles.sessionCode}>{session?.session_code ?? '...'}</Text>
            <Ionicons name="copy-outline" size={24} color={colorTextSecondary} style={styles.copyIcon} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={22} color={colorWhite} style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Share Code</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
             <Ionicons name="rocket-outline" size={22} color={colorWhite} style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Get Swiping!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
    backgroundColor: colorBackground,
    borderRadius: 20,
    paddingVertical: 30,
    paddingHorizontal: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colorTextPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
   subtitle: {
    fontSize: 16,
    color: colorTextSecondary,
    marginBottom: 25,
    textAlign: 'center',
  },
  codeContainer: {
    backgroundColor: colorWhite,
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 15,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: colorBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '90%',
  },
  sessionCode: {
    fontSize: 40, 
    fontWeight: 'bold',
    color: colorAccent,
    textAlign: 'center',
    letterSpacing: 4, // Add spacing between digits
  },
  copyIcon: {
      marginLeft: 15,
  },
  shareButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50', // Green for share
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 15,
    minHeight: 50,
  },
  closeButton: {
    flexDirection: 'row',
    backgroundColor: colorAccent, // Use theme accent color
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 50,
  },
  buttonIcon: {
      marginRight: 10,
  },
  buttonText: {
    color: colorWhite,
    fontSize: 18,
    fontWeight: '600',
  },
});

export default SessionCreatedModal; 