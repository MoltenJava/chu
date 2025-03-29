import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';

export default function HomeScreen() {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      
      // Navigate to login page
      router.replace('/(auth)/login');
    } catch (e) {
      console.error('Error signing out:', e);
      Alert.alert('Error', 'Something went wrong while signing out.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <FontAwesome5 name="user-circle" size={60} color="#FF3B5C" style={styles.icon} />
        <Text style={styles.title}>Account</Text>
        
        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <FontAwesome5 name="sign-out-alt" size={20} color="white" style={styles.buttonIcon} />
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#333',
  },
  signOutButton: {
    backgroundColor: '#FF3B5C',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B5C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    width: 200,
  },
  buttonIcon: {
    marginRight: 10,
  },
  signOutButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
