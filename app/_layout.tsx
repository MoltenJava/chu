import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot, Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, Button, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';
import { CoupleProvider } from '../context/CoupleContext';
import * as Sentry from '@sentry/react-native';
import { getUserLocation, isWithinServiceArea, DEFAULT_USER_LOCATION, Coordinates } from '../utils/locationService';
import { LocationProvider } from '../context/LocationContext';

Sentry.init({
  dsn: 'https://fd0366e88927fe54043f44328298353c@o4509237975318528.ingest.us.sentry.io/4509237975515136',

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

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

        // --- Set Sentry User Context ---
        if (session?.user) {
          Sentry.setUser({ id: session.user.id, email: session.user.email });
        } else {
          Sentry.setUser(null); // Clear user if no session
        }
        // --- End Sentry User Context ---

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

export default Sentry.wrap(function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [mounted, setMounted] = useState(false);

  // Location state
  const [actualUserLocation, setActualUserLocation] = useState<Coordinates | null>(null);
  const [currentUserLocationForApp, setCurrentUserLocationForApp] = useState<Coordinates | null>(null);
  const [isLocationChecked, setIsLocationChecked] = useState(false);
  const [isUserInRange, setIsUserInRange] = useState(false);
  const [simulatedLocationActive, setSimulatedLocationActive] = useState(false);

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

  // Location check effect
  useEffect(() => {
    if (loaded && mounted) {
      const checkLocation = async () => {
        console.log('Starting location check...');
        const location = await getUserLocation();
        setActualUserLocation(location); // Store the true location
        
        // const isInRange = isWithinServiceArea(location); // Original line
        // setIsUserInRange(isInRange); // Original line

        // --- TEMPORARY MODIFICATION FOR TESTING ---
        console.log('[TEMP TEST] Forcing out of range scenario. Actual location was:', location);
        setIsUserInRange(false); 
        // --- END TEMPORARY MODIFICATION ---
        
        // This logic determines what currentUserLocationForApp is initially set to.
        // If we are truly in range (even if we force the UI to say out of range),
        // set it to the actual location. Otherwise, it's also actual (and will be overridden on button click).
        if (isWithinServiceArea(location)) { 
          setCurrentUserLocationForApp(location);
        } else {
          setCurrentUserLocationForApp(location); 
        }
        setIsLocationChecked(true);
        // console.log('Location check complete. In range:', isInRange, 'Actual Location:', location); // Original log
        console.log('Location check complete. In range:', false, '[FORCED FOR TEST] Actual Location:', location);

      };
      checkLocation();
    }
  }, [loaded, mounted]);

  console.log('Root layout render:', { loaded, mounted, isLocationChecked, isUserInRange, simulatedLocationActive });

  useProtectedRoute(loaded && mounted && (isUserInRange || simulatedLocationActive));

  if (!loaded || !mounted) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isLocationChecked) {
    return (
      <View style={styles.centered}>
        <Text style={styles.infoText}>Checking your location...</Text>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const handleOutOfRangeExplore = async () => {
    console.log("User is out of range. Actual location for logging:", actualUserLocation);

    if (actualUserLocation) {
      try {
        // Get current session to find user_id
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        const { error: insertError } = await supabase
          .from('out_of_range_requests')
          .insert({
            latitude: actualUserLocation.latitude,
            longitude: actualUserLocation.longitude,
            user_id: userId, // Will be null if user is not logged in
            // email and name can be added here if collected
          });

        if (insertError) {
          console.error('Error logging out-of-range request to Supabase:', insertError);
          Sentry.captureException(insertError, { extra: { message: 'Failed to insert out_of_range_request' } });
          // Optionally, inform the user or retry, but for now, we'll proceed with simulation
        } else {
          console.log('Out-of-range location logged successfully. User ID:', userId || 'anonymous');
        }
      } catch (e: any) {
        console.error('Exception while logging out-of-range request:', e);
        Sentry.captureException(e, { extra: { message: 'Exception in handleOutOfRangeExplore Supabase insert' } });
      }
    } else {
      console.warn('Cannot log out-of-range request: actualUserLocation is null.');
    }
    
    setCurrentUserLocationForApp(DEFAULT_USER_LOCATION); // Simulate being in Westwood
    setSimulatedLocationActive(true); // Activate simulation mode
    setIsUserInRange(true); // This will now make the main app render
    console.log('Simulating location for exploration. App will use:', DEFAULT_USER_LOCATION);
  };

  if (!isUserInRange && !simulatedLocationActive) {
    return (
      <View style={styles.centered}>
        <Image source={require('../assets/images/chewzee.png')} style={styles.logoImage} />
        <Text style={styles.playfulTitleText}>Almost There!</Text>
        <Text style={styles.playfulInfoText}>
          Chewzee isn't quite in your neighborhood yet!
        </Text>
        <Text style={styles.playfulSubInfoText}>
          Tap the button to let us know you're hungry for us, 
          and we'll work on rolling into your area soon. 
          You can still explore the app in the meantime!
        </Text>
        <TouchableOpacity style={styles.funButton} onPress={handleOutOfRangeExplore}>
          <Text style={styles.funButtonText}>Count Me In & Explore!</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // If in range or simulation is active, render the app
  // TODO: Pass currentUserLocationForApp down through context if needed by other parts like useMenuItems

  return (
    <LocationProvider 
      actualUserLocation={actualUserLocation}
      currentUserLocationForApp={currentUserLocationForApp}
      simulatedLocationActive={simulatedLocationActive}
    >
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
    </LocationProvider>
  );
});

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25, // Increased padding
    backgroundColor: '#FFF9F2', // Lighter, warmer off-white
  },
  logoImage: { // Style for the logo
    width: 150, // Adjust as needed
    height: 150, // Adjust as needed
    resizeMode: 'contain',
    marginBottom: 25, // Space below logo
  },
  playfulTitleText: {
    fontSize: 32, // Larger title
    fontWeight: 'bold',
    color: '#FF6347', // Tomato color - a bit more playful than orange
    marginBottom: 20,
    textAlign: 'center',
  },
  playfulInfoText: {
    fontSize: 18,
    color: '#4A4A4A', // Darker gray for better readability
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 26, // Improved line height
  },
  playfulSubInfoText: {
    fontSize: 15,
    color: '#606060', // Slightly lighter gray
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  funButton: {
    backgroundColor: '#E95420', // Chewzee orange
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30, // More rounded
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  funButtonText: {
    color: '#FFFFFF', // White text
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Keep existing styles for loading state if they are separate
  infoText: { // This style is used by the 'Checking your location...' text
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
});