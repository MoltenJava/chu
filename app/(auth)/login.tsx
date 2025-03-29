import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  SafeAreaView, 
  Alert, 
  Platform 
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import SplitFlapText from '@/components/SpinFlap';

export default function Login() {
  const router = useRouter();

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
          source={require('@/assets/images/icon-white-on-red.png')}
          style={styles.icon}
          resizeMode="contain"
        />
        
        {/* Use the imported SpinFlap component */}
        <SplitFlapText 
          words={foodOptions}
          staticText="the menu for"
          transitionInterval={5000}
          charDuration={1800}
          fixedNumChars={10}       // Ensures consistent width and proper centering
          alwaysFlipAllChars={true} // Makes every character flip like Grand Central
        />
        
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={30}
          style={styles.appleButton}
          onPress={handleAppleSignIn}
        />
        
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
  appleButton: {
    width: '100%',
    height: 50,
    maxWidth: 300,
    marginTop: 20,
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
