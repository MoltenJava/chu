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

// Define new color palette (subset needed here) - Updated to match Chewzee branding
const colorBackground = '#FAFAFA'; // Off-white
const colorTextPrimary = '#212121'; // Dark Gray
const colorBorder = '#E0E0E0';     // Light Gray
const colorAccent = '#FF3B5C';     // Updated to Chewzee brand color (was #FF6F61)
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
  
  // Add state to prevent rapid taps
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Update animation when isActive changes from parent
  useEffect(() => {
    console.log(`[WAITER-BUTTON] isActive changed to: ${isActive}, animating to: ${isActive ? 1 : 0}`);
    RNAnimated.timing(animation, {
      toValue: isActive ? 1 : 0,
      duration: 200, // Faster animation for better UX
      useNativeDriver: false
    }).start(() => {
      // Reset processing state after animation completes
      setIsProcessing(false);
    });
  }, [isActive, animation]);
  
  // Handle press with improved debounce logic
  const handlePress = useCallback(() => {
    // Prevent processing if already in progress
    if (isProcessing) {
      console.log('[WAITER-BUTTON-PRESS] Already processing, ignoring press');
      return;
    }
    
    console.log('[WAITER-BUTTON-PRESS] Button pressed, current state:', isActive);
    
    // Set processing state to prevent rapid taps
    setIsProcessing(true);
    
    // Provide haptic feedback immediately
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Call onPress with the desired new state (opposite of current)
    console.log('[WAITER-BUTTON-PRESS] Calling onPress with new state:', !isActive);
    onPress(!isActive);
    
    // Reset processing state after a delay (fallback in case animation doesn't complete)
    setTimeout(() => {
      setIsProcessing(false);
    }, 600);
    
  }, [isActive, onPress, isProcessing]);
  
  // Interpolate background color with more vibrant active state
  const backgroundColor = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [colorWhite, colorAccent] // Chewzee brand color when active
  });
  
  // Interpolate border color for better visual feedback
  const borderColor = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [colorBorder, colorAccent] // Active state gets colored border
  });
  
  // Interpolate icon color: dark inactive, white active
  const iconColor = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [colorTextPrimary, colorWhite]
  });
  
  // Add a subtle scale animation for press feedback
  const scaleAnimation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05] // Slightly larger when active
  });

  return (
    <TouchableOpacity 
      onPress={handlePress}
      activeOpacity={0.7}
      style={[styles.container, style]}
      testID="waiter-button"
      disabled={isProcessing} // Disable during processing
    >
      <RNAnimated.View style={[
        styles.button,
        { 
          backgroundColor,
          borderColor,
          transform: [{ scale: scaleAnimation }],
          shadowColor: colorShadow,
          // Add stronger shadow when active
          shadowOpacity: isActive ? 0.3 : 0.2,
          elevation: isActive ? 5 : 3,
        }
      ]}>
        {/* Apply animated color to icon via Text wrapper */}
        <RNAnimated.Text style={{ color: iconColor }}>
          <FontAwesome5 
            name="user-tie" 
            size={22} 
          />
        </RNAnimated.Text>
        
        {/* Add a subtle indicator when active */}
        {isActive && (
          <View style={styles.activeIndicator} />
        )}
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
    shadowOpacity: 0.2, 
    shadowRadius: 3, 
    elevation: 3, 
    borderWidth: 1, 
  },
  activeIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colorAccent,
    borderWidth: 1,
    borderColor: colorWhite,
  }
});

export default WaiterButton; 