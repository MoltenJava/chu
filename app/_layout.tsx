import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function useProtectedRoute(isReady: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) {
      console.log('Protected route not ready yet');
      return;
    }

    const checkSession = async () => {
      try {
        console.log('Checking session in protected route...');
        const { data: { session } } = await supabase.auth.getSession();
        const inAuthGroup = segments[0] === '(auth)';
        
        console.log('Session check result:', {
          hasSession: !!session,
          inAuthGroup,
          currentSegments: segments
        });

        if (!session && !inAuthGroup) {
          console.log('No session and not in auth group, redirecting to login...');
          router.replace('/(auth)/login');
        } else if (session && inAuthGroup) {
          console.log('Has session but in auth group, redirecting to tabs...');
          router.replace('/(tabs)');
        } else {
          console.log('No navigation needed:', {
            hasSession: !!session,
            inAuthGroup,
            currentSegments: segments
          });
        }
      } catch (error) {
        console.error('Error checking session:', error);
      }
    };

    checkSession();
  }, [isReady, segments]);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    console.log('Root layout mounted');
    setMounted(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      console.log('Fonts loaded, hiding splash screen');
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  console.log('Root layout render:', { loaded, mounted });

  // Only start checking auth after fonts are loaded and component is mounted
  useProtectedRoute(loaded && mounted);

  if (!loaded || !mounted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Slot />
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
