import { StyleSheet, ActivityIndicator } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useState } from 'react';
import Constants from 'expo-constants';

const APPLE_SERVICE_ID = 'com.jaz.chewzee.service';

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithApple = async () => {
    try {
      console.log('Starting Apple sign in...');
      setIsLoading(true);
      setError(null);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('Got Apple credentials:', {
        email: credential.email,
        fullName: credential.fullName,
        hasToken: !!credential.identityToken,
        identityToken: credential.identityToken?.substring(0, 50) + '...',
      });

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      console.log('Attempting Supabase sign in with ID token...');
      // Sign in with Supabase using the Apple ID token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: APPLE_SERVICE_ID // Use the Service ID as the nonce/audience
      });

      console.log('Supabase sign in result:', { 
        data: { 
          session: data?.session ? 'exists' : null,
          user: data?.user?.id || null 
        }, 
        error 
      });

      if (error) throw error;

      // Check if we have a session after sign in
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session after sign in:', session ? 'exists' : null);

      if (!session) {
        throw new Error('No session after successful sign in');
      }

      console.log('Sign in successful, navigating to tabs...');
      // If successful, navigate to the main app
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Error signing in with Apple:', error);
      setError(error.message || 'Failed to sign in with Apple');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Welcome to Chewz</ThemedText>
      {error && <ThemedText style={styles.error}>{error}</ThemedText>}
      {isLoading ? (
        <ActivityIndicator size="large" />
      ) : (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={5}
          style={styles.button}
          onPress={signInWithApple}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 30,
  },
  button: {
    width: 200,
    height: 44,
  },
  error: {
    color: '#ff4444',
    marginBottom: 20,
    textAlign: 'center',
  },
}); 