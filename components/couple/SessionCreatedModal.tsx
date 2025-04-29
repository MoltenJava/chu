import React, { useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Clipboard,
  Dimensions,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CoupleSession } from '@/types/couple';
import { LinearGradient } from 'expo-linear-gradient';

// Color palette consistent with the improved CoupleModeOptionsModal
const colorBackground = '#FFFFFF';
const colorTextPrimary = '#222222';
const colorTextSecondary = '#666666';
const colorAccent = '#FF6F61';
const colorWhite = '#FFFFFF';
const colorModalOverlay = 'rgba(0, 0, 0, 0.6)';
const colorBorder = '#EEEEEE';

const { width } = Dimensions.get('window');

interface SessionCreatedModalProps {
  visible: boolean;
  onClose: () => void;
  session: CoupleSession | null;
}

const SessionCreatedModal: React.FC<SessionCreatedModalProps> = ({ 
  visible, 
  onClose, 
  session 
}) => {
  const handleCopyCode = useCallback(() => {
    if (session?.session_code) {
      Clipboard.setString(session.session_code);
      Alert.alert('Copied!', 'Partee code copied to clipboard.');
    } else {
      Alert.alert('Error', 'Could not copy code.');
    }
  }, [session]);

  const handleShareCode = useCallback(async () => {
    if (!session?.session_code) {
      Alert.alert('Error', 'No code available to share.');
      return;
    }
    try {
      const message = `Join my Chewzee partee! Use code: ${session.session_code}`;
      await Share.share({
        message: message,
        title: 'Share Partee Code',
      });
    } catch (error) {
      console.error('Error sharing session code:', error);
      Alert.alert('Sharing Failed', 'Could not share the partee code.');
    }
  }, [session]);

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
          <View style={styles.headerContainer}>
            <Text style={styles.modalTitle}>Partee Created!</Text>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colorTextSecondary} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.description}>
            Your partee is ready. Share the code with your friend to start matching!
          </Text>

          <View style={styles.codeContainer}>
            <Text style={styles.codeText}>{session?.session_code || '------'}</Text>
          </View>
          
          <Text style={styles.codeLabel}>Partee Code</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopyCode}
              activeOpacity={0.8}
            >
              <Ionicons name="copy-outline" size={20} color={colorAccent} />
              <Text style={styles.copyButtonText}>Copy</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShareCode}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FF8A80', '#FF6F61']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientButton}
              >
                <Ionicons name="share-social-outline" size={20} color={colorWhite} />
                <Text style={styles.shareButtonText}>Share</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.doneButton} 
            onPress={onClose}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#FF8A80', '#FF6F61']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </LinearGradient>
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
  headerContainer: {
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
    marginBottom: 24,
    lineHeight: 22,
  },
  codeContainer: {
    backgroundColor: colorBackground,
    paddingVertical: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colorBorder,
    marginBottom: 8,
    width: '100%',
  },
  codeText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: colorAccent,
    textAlign: 'center',
    letterSpacing: 8,
  },
  codeLabel: {
    fontSize: 15,
    color: colorTextSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 24,
    gap: 12,
  },
  copyButton: {
    height: 50,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: colorAccent,
    gap: 8,
  },
  shareButton: {
    height: 50,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
    overflow: 'hidden',
  },
  copyButtonText: {
    color: colorAccent,
    fontSize: 16,
    fontWeight: '600',
  },
  shareButtonText: {
    color: colorWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  doneButton: {
    height: 52,
    width: '100%',
    borderRadius: 30,
    overflow: 'hidden',
  },
  doneButtonText: {
    color: colorWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  gradientButton: {
    flexDirection: 'row',
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});

export default SessionCreatedModal; 