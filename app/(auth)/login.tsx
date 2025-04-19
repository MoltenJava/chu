import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  SafeAreaView, 
  Alert, 
  Platform, 
  TextInput,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import SplitFlapText from '@/components/SpinFlap';
import { Ionicons } from '@expo/vector-icons';

// Define Colors (consistent with SwipeableCards)
const colorBackground = '#FAFAFA'; // Off-white
const colorTextPrimary = '#212121'; // Dark Gray
const colorTextSecondary = '#757575'; // Medium Gray
const colorAccent = '#FF6F61';     // Coral Pink
const colorWhite = '#FFFFFF';
const colorBorder = '#E0E0E0';     // Light Gray

export default function Login() {
  const router = useRouter();
  
  // State for Email Auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Add state to toggle between Sign In and Sign Up
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAppleSignIn = async () => {
    try {
      console.log('Starting Apple Sign In process...');
      const rawNonce = Array.from(await Crypto.getRandomBytesAsync(32))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
      
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );
      
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      
      if (!credential.identityToken) {
        throw new Error('No identity token from Apple');
      }
      
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });
      
      if (error) {
        throw error;
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', data.user!.id)
        .single();
      
      if (!profile?.onboarding_completed) {
        router.replace('/(auth)/create-profile');
      } else {
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      if (error.code !== 'ERR_CANCELED') {
        Alert.alert(
          'Sign In Error',
          `Error: ${error.message}\nCode: ${error.code || 'unknown'}`,
          [{ text: 'OK' }]
        );
      }
    }
  };

  // Email Sign In Handler
  const handleEmailSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      if (error) throw error;
      // Redirect logic (same as Apple sign in)
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', data.user!.id)
        .single();
      if (!profile?.onboarding_completed) {
        router.replace('/(auth)/create-profile');
      } else {
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Alert.alert('Sign In Error', error.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Email Sign Up Handler
  const handleEmailSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });
      if (error) throw error;
      // After sign up, user needs to confirm email typically,
      // but for testing, we might directly check profile and redirect.
      // For now, let's assume automatic confirmation or proceed to profile creation.
      // NOTE: Supabase might require email confirmation setup.
      Alert.alert('Sign Up Success', 'Please check your email for confirmation (if enabled), then sign in.');
      // Optionally clear fields or switch to sign-in mode
      // setIsSignUp(false);
      // Or attempt to redirect if profile needs creation (might fail if email not confirmed)
      // router.replace('/(auth)/create-profile');
    } catch (error: any) {
      Alert.alert('Sign Up Error', error.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Food options for the split flap display
  const foodOptions = [
    'kebabs',
    'hamburgers',
    'pancakes',
    'salads', 
    'donuts',
    'soup',
    'milkshakes',
    'burritos',
    'tiramisu',
    'everywhere'
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('@/assets/images/chewzee.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        
        <View style={styles.splitFlapContainer}>
          <SplitFlapText
            words={foodOptions}
            transitionInterval={4800}
            charDuration={1800}
            spinDuration={4000}
            fixedNumChars={10}
            alwaysFlipAllChars={true}
          />
        </View>

        {/* --- Email/Password Section --- */}
        <View style={styles.emailAuthContainer}>
            <View style={styles.inputContainer}>
                 <Ionicons name="mail-outline" size={20} color={colorTextSecondary} style={styles.inputIcon} />
                 <TextInput
                     style={styles.input}
                     placeholder="Email"
                     placeholderTextColor={colorTextSecondary}
                     value={email}
                     onChangeText={setEmail}
                     keyboardType="email-address"
                     autoCapitalize="none"
                     autoCorrect={false}
                     selectionColor={colorAccent}
                 />
            </View>

            <View style={styles.inputContainer}>
                 <Ionicons name="lock-closed-outline" size={20} color={colorTextSecondary} style={styles.inputIcon} />
                 <TextInput
                     style={styles.input}
                     placeholder="Password"
                     placeholderTextColor={colorTextSecondary}
                     value={password}
                     onChangeText={setPassword}
                     secureTextEntry
                     selectionColor={colorAccent}
                 />
            </View>

            {loading ? (
                <ActivityIndicator color={colorAccent} style={styles.activityIndicator} />
            ) : (
                <TouchableOpacity
                    style={styles.emailButton}
                    onPress={isSignUp ? handleEmailSignUp : handleEmailSignIn}
                >
                    <Text style={styles.emailButtonText}>
                        {isSignUp ? 'Sign Up' : 'Sign In'}
                    </Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.toggleButton}>
                <Text style={styles.toggleButtonText}>
                    {isSignUp ? 'Already have an account? ' : 'Need an account? '}
                    <Text style={styles.toggleButtonActionText}>
                        {isSignUp ? 'Sign In' : 'Sign Up'}
                    </Text>
                </Text>
            </TouchableOpacity>
        </View>

        {/* Simplified Divider */}
        <View style={styles.dividerContainer}>
            <Text style={styles.dividerText}>or</Text>
        </View>

        {/* --- Apple Sign In --- */}
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={16}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colorBackground,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 20,
  },
  logo: {
    width: '70%',
    maxWidth: 250,
    height: 100,
    marginBottom: 5,
    marginTop: Platform.OS === 'ios' ? 20 : 10,
  },
  splitFlapContainer: {
    marginBottom: 40,
    width: '100%',
    alignItems: 'center',
  },
  emailAuthContainer: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    marginTop: 0,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: colorWhite,
    borderRadius: 12,
    borderColor: colorBorder,
    borderWidth: 1,
    marginBottom: 20,
  },
  inputIcon: {
     paddingLeft: 15,
     paddingRight: 5,
  },
  input: {
    flex: 1,
    color: colorTextPrimary,
    paddingHorizontal: 10,
    paddingVertical: 15,
    fontSize: 16,
  },
  emailButton: {
    width: '100%',
    backgroundColor: colorAccent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 5,
  },
  emailButtonText: {
    color: colorWhite,
    fontSize: 16,
    fontWeight: 'bold',
  },
  activityIndicator: {
    height: 57,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    marginTop: 15,
  },
  toggleButtonText: {
    color: colorTextSecondary,
    fontSize: 14,
  },
  toggleButtonActionText: {
    color: colorAccent,
    fontWeight: '600',
    fontSize: 14,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
    maxWidth: 340,
    marginVertical: 25,
  },
  dividerText: {
    color: colorTextSecondary,
    marginHorizontal: 10,
    fontWeight: '600',
    fontSize: 14,
  },
  appleButton: {
    width: '100%',
    height: 55,
    maxWidth: 340,
  },
});
