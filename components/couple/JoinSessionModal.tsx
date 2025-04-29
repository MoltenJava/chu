import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { joinSession } from '../../utils/coupleModeService';
import { useAuth } from '../../hooks/useAuth';
import { CoupleSession } from '@/types/couple';
import { LinearGradient } from 'expo-linear-gradient';

// Color palette consistent with other modals
const colorBackground = '#FFFFFF';
const colorTextPrimary = '#222222';
const colorTextSecondary = '#666666';
const colorAccent = '#FF6F61'; 
const colorWhite = '#FFFFFF';
const colorBorder = '#EEEEEE';
const colorModalOverlay = 'rgba(0, 0, 0, 0.6)';

const { width } = Dimensions.get('window');

interface JoinSessionModalProps {
  visible: boolean;
  onClose: () => void;
  onSessionJoined: (session: CoupleSession) => void;
}

export const JoinSessionModal: React.FC<JoinSessionModalProps> = ({
  visible,
  onClose,
  onSessionJoined
}) => {
  const [sessionCode, setSessionCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const handleJoinSession = useCallback(async () => {
    if (!sessionCode || sessionCode.length !== 6) {
      setError('Please enter a valid 6-character code.');
      return;
    }
    if (!user) {
      setError('You must be logged in to join a partee.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const session = await joinSession(sessionCode.toUpperCase(), user.id);
      onSessionJoined(session);
      setSessionCode('');
      setError(null);
    } catch (err: any) {
      console.error('Error joining session:', err);
      setError(err.message || 'Failed to join the partee. Please check the code and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [sessionCode, user, onSessionJoined]);

  React.useEffect(() => {
    if (!visible) {
      setError(null);
      setSessionCode('');
    }
  }, [visible]);
  React.useEffect(() => { setError(null); }, [sessionCode]);

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
            <Text style={styles.modalTitle}>Join Partee</Text>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colorTextSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            Enter the 6-character Partee Code:
          </Text>

          <TextInput
            style={styles.input}
            placeholder="123456"
            placeholderTextColor={colorTextSecondary}
            value={sessionCode}
            onChangeText={(text) => setSessionCode(text.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isLoading}
            selectionColor={colorAccent}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={styles.joinButton}
            onPress={handleJoinSession}
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
                <ActivityIndicator color={colorWhite} />
              ) : (
                <Text style={styles.joinButtonText}>Join Partee</Text>
              )}
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
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1.5,
    borderColor: colorBorder,
    borderRadius: 15,
    padding: 16,
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 8,
    width: '100%',
    fontWeight: '600',
    color: colorTextPrimary,
  },
  errorText: {
    color: '#F44336',
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 14,
  },
  joinButton: {
    height: 52,
    width: '100%',
    borderRadius: 30,
    overflow: 'hidden',
    marginTop: 10,
  },
  gradientButton: {
    flexDirection: 'row',
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonText: {
    color: colorWhite,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default JoinSessionModal; 