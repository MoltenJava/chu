import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot, Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';
import { CoupleProvider } from '../context/CoupleContext';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

type AppSegment = '(auth)' | '(tabs)';
type AuthScreen = 'login' | 'create-profile';
type TabScreen = 'index' | 'food' | 'explore' | 'rate-photos' | 'couple-mode';

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
        console.log('Checking session in protected route...', { segments });
        const { data: { session } } = await supabase.auth.getSession();
        const inAuthGroup = segments[0] === '(auth)';
        const currentScreen = segments[segments.length - 1];
        
        console.log('Session check details:', {
          hasSession: !!session,
          inAuthGroup,
          currentSegments: segments,
          currentScreen,
          userId: session?.user?.id
        });

        if (!session && !inAuthGroup) {
          console.log('No session, redirecting to login...');
          router.replace('/(auth)/login');
        } else if (session) {
          // Check if user has completed profile
          console.log('Checking profile completion...');
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', session.user.id)
            .single();

          console.log('Profile check result:', { profile, error: profileError });

          if (!profile?.onboarding_completed && currentScreen !== 'create-profile') {
            console.log('Profile not completed, redirecting to profile creation...');
            router.replace('/(auth)/create-profile');
          } else if (profile?.onboarding_completed && inAuthGroup) {
            console.log('Profile completed and in auth group, should automatically navigate to (tabs)');
          }
        }
      } catch (error) {
        console.error('Error in protected route:', error);
      }
    };

    checkSession();
  }, [isReady, segments, router]);
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
    <CoupleProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="food" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen 
              name="playlistList" 
              options={{ 
                presentation: 'modal',
                headerShown: true, 
                title: 'My Playlists' 
              }}
            />
            <Stack.Screen 
              name="playlistDetail" 
              options={{ 
                presentation: 'modal',
                headerShown: true, 
                title: 'Playlist'
              }}
            />
          </Stack>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
      </GestureHandlerRootView>
    </CoupleProvider>
  );
}
