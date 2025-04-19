import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  TouchableOpacity, 
  View, 
  Text,
  Animated as RNAnimated,
  ViewStyle
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// Define new color palette (subset needed here)
const colorBackground = '#FAFAFA'; // Off-white
const colorTextPrimary = '#212121'; // Dark Gray
const colorBorder = '#E0E0E0';     // Light Gray
const colorAccent = '#FF6F61';     // Coral Pink
const colorWhite = '#FFFFFF';
const colorShadow = '#BDBDBD';     // Medium Gray for shadows

interface WaiterButtonProps {
  onPress: (isActive: boolean) => void;
  isActive: boolean;
  style?: ViewStyle;
}

const WaiterButton: React.FC<WaiterButtonProps> = ({ 
  onPress, 
  isActive,
  style 
}) => {
  // Animation values
  const [animation] = useState(new RNAnimated.Value(isActive ? 1 : 0));
  
  // Debug values to track state
  const [lastToggleTime, setLastToggleTime] = useState<number>(0);
  const [pressCount, setPressCount] = useState<number>(0);
  
  // Update animation when isActive changes from parent
  useEffect(() => {
    RNAnimated.timing(animation, {
      toValue: isActive ? 1 : 0,
      duration: 300,
      useNativeDriver: false
    }).start();
  }, [isActive, animation]);
  
  // Handle press with debounce to prevent double-taps
  const handlePress = useCallback(() => {
    // Debug log for taps
    console.log('[WAITER-BUTTON-PRESS] Button pressed, current state:', isActive);
    
    // Increment press count for debugging
    setPressCount(prev => {
      const newCount = prev + 1;
      console.log(`[WAITER-BUTTON-PRESS] Press count: ${newCount}`);
      return newCount;
    });
    
    // Check if enough time has passed since last press (debounce)
    const now = Date.now();
    if (now - lastToggleTime < 500) {
      console.log('[WAITER-BUTTON-PRESS] Ignoring press, too soon after last press');
      return;
    }
    
    // Update last toggle time
    setLastToggleTime(now);
    
    // Provide haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Toggle waiter mode - IMPORTANT: pass the opposite of current state
    console.log('[WAITER-BUTTON-PRESS] Calling onPress with new state:', !isActive);
    onPress(!isActive);
    
  }, [isActive, onPress, lastToggleTime]);
  
  // Interpolate background color: white inactive, red active
  const backgroundColor = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [colorWhite, colorAccent] 
  });
  
  // Interpolate icon color: dark inactive, white active
  const iconColor = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [colorTextPrimary, colorWhite]
  });

  return (
    <TouchableOpacity 
      onPress={handlePress}
      activeOpacity={0.7}
      style={[styles.container, style]}
      testID="waiter-button"
    >
      <RNAnimated.View style={[
        styles.button,
        { 
          backgroundColor, // Animated background
          borderColor: colorBorder, // Use light gray border
          shadowColor: colorShadow, // Use medium gray shadow
        }
      ]}>
        {/* Apply animated color to icon via Text wrapper */}
        <RNAnimated.Text style={{ color: iconColor }}>
          <FontAwesome5 
            name="user-tie" 
            size={22} 
          />
        </RNAnimated.Text>
      </RNAnimated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, // Reset opacity
    shadowRadius: 3, // Reset radius
    elevation: 3, // Reset elevation
    borderWidth: 1, // Reset border width
  }
});

export default WaiterButton; 