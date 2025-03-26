import { View, Text, StyleSheet, TouchableOpacity, Image, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

export default function Login() {
  const router = useRouter();

  const handleAppleSignIn = async () => {
    try {
      console.log('Starting Apple Sign In process...');
      
      // Generate random nonce
      const rawNonce = Array.from(await Crypto.getRandomBytesAsync(32))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
      console.log('Generated raw nonce');
      
      // Hash the nonce
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );
      console.log('Hashed nonce generated');

      console.log('Requesting Apple authentication...');
      // Request Apple authentication
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      console.log('Apple authentication response received:', {
        hasIdentityToken: !!credential.identityToken,
        hasEmail: !!credential.email,
        hasFullName: !!(credential.fullName?.givenName || credential.fullName?.familyName),
      });

      if (!credential.identityToken) {
        throw new Error('No identity token from Apple');
      }

      console.log('Attempting Supabase sign in...');
      // Sign in with Supabase using the Apple token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });

      if (error) {
        console.error('Supabase sign in error:', {
          message: error.message,
          status: error.status,
          name: error.name,
        });
        throw error;
      }

      console.log('Supabase sign in successful:', {
        hasSession: !!data.session,
        hasUser: !!data.user,
        userId: data.user?.id,
      });

      // Check profile status immediately after successful sign in
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', data.user!.id)
        .single();

      console.log('Immediate profile check:', { profile });

      if (!profile?.onboarding_completed) {
        console.log('Redirecting to profile creation...');
        router.replace('/(auth)/create-profile');
      } else {
        console.log('Profile already completed, redirecting to main app...');
        router.replace('/(tabs)');
      }

    } catch (error: any) {
      console.error('Detailed error in Apple Sign In:', {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack,
      });

      if (error.code !== 'ERR_CANCELED') {
        Alert.alert(
          'Sign In Error',
          `Error: ${error.message}\nCode: ${error.code || 'unknown'}`,
          [{ text: 'OK' }]
        );
      }
    }
  };

  const resetProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_completed: false })
        .eq('id', session.user.id);

      if (error) throw error;
      Alert.alert('Success', 'Profile reset. Please sign out and sign in again to test profile creation.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <Image
          source={require('@/assets/images/icon-white-on-red.png')}
          style={styles.icon}
          resizeMode="contain"
        />
        
        {/* Tagline */}
        <Text style={styles.tagline}>The menu for everywhere</Text>

        {/* Apple Sign In Button */}
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={30}
          style={styles.appleButton}
          onPress={handleAppleSignIn}
        />

        {/* Debug Button */}
        <TouchableOpacity
          style={styles.debugButton}
          onPress={resetProfile}
        >
          <Text style={styles.debugButtonText}>Reset Profile (Debug)</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#d9232a',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  icon: {
    width: 240,
    height: 240,
    marginBottom: 0,
  },
  tagline: {
    fontSize: 20,
    color: 'white',
    marginTop: 8,
    marginBottom: 48,
    fontWeight: '500',
    textAlign: 'center',
  },
  appleButton: {
    width: '100%',
    height: 50,
    maxWidth: 300,
  },
  debugButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  debugButtonText: {
    color: 'white',
    fontSize: 14,
  },
}); 