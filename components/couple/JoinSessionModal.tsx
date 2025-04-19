import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { joinSession } from '../../utils/coupleModeService';
import { useAuth } from '../../hooks/useAuth';

// Define accent color if not already available from imports
const colorAccent = '#FF6F61'; 

interface JoinSessionModalProps {
  visible: boolean;
  onClose: () => void;
  onSessionJoined: (session: any) => void;
}

export const JoinSessionModal: React.FC<JoinSessionModalProps> = ({
  visible,
  onClose,
  onSessionJoined
}) => {
  const [sessionCode, setSessionCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleJoinSession = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to join a session');
      console.error('[JoinSessionModal] User object is null');
      return;
    }

    if (!user.id) {
      Alert.alert('Error', 'User ID is missing. Cannot join session.');
      console.error('[JoinSessionModal] User object exists, but user.id is missing or null', user);
      return;
    }

    if (!sessionCode.trim()) {
      Alert.alert('Error', 'Please enter a session code');
      return;
    }

    try {
      setLoading(true);
      console.log(`[JoinSessionModal] Attempting to join with code: ${sessionCode.trim()}, userId: ${user.id}`);
      const session = await joinSession(sessionCode.trim(), user.id);
      onSessionJoined(session);
      onClose();
    } catch (error) {
      console.error('Error joining session:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to join session. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Join Session</Text>
          <Text style={styles.description}>
            Enter the session code shared by your partner to join their couple mode session.
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder="Enter session code"
            value={sessionCode}
            onChangeText={setSessionCode}
            autoCapitalize="none"
            maxLength={6}
            keyboardType="numeric"
            textContentType="oneTimeCode"
          />
          
          {loading ? (
            <ActivityIndicator size="large" color={colorAccent} />
          ) : (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.joinButton]}
                onPress={handleJoinSession}
              >
                <Text style={styles.joinButtonText}>Join Session</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
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
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 2,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  joinButton: {
    backgroundColor: colorAccent,
  },
  joinButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#f2f2f2',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 