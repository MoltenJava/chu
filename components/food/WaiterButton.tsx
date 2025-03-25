import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  TouchableOpacity, 
  Animated, 
  Platform
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface WaiterButtonProps {
  onPress: (isActive: boolean) => void;
  isActive: boolean;
}

const WaiterButton: React.FC<WaiterButtonProps> = ({ 
  onPress,
  isActive
}) => {
  const [animation] = useState(new Animated.Value(0));
  const [pressAnimation] = useState(new Animated.Value(1));
  const mountedRef = useRef(true);
  
  // Animate glow when active - always run this effect regardless of conditions
  useEffect(() => {
    // Define all animations up front
    const startGlowAnimation = () => {
      animation.stopAnimation();
      Animated.loop(
        Animated.sequence([
          Animated.timing(animation, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: false,
          }),
          Animated.timing(animation, {
            toValue: 0.7,
            duration: 1200,
            useNativeDriver: false,
          }),
        ])
      ).start();
    };

    const stopGlowAnimation = () => {
      animation.stopAnimation();
      Animated.timing(animation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    };

    // Run the appropriate animation based on isActive
    if (isActive) {
      startGlowAnimation();
    } else {
      stopGlowAnimation();
    }

    // Clean up function
    return () => {
      animation.stopAnimation();
      mountedRef.current = false;
    };
  }, [isActive, animation]);
  
  // Button border style - static to avoid type errors
  const buttonBorderStyle = isActive ? {
    borderColor: '#4CAF50',
    borderWidth: 2,
  } : {
    borderColor: '#ffccd5',
    borderWidth: 1,
  };
  
  // Enhanced perimeter glow style - focused only on the outer edge with stronger effect
  const perimeterGlowStyle = {
    shadowOpacity: animation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.9],  // Increased from 0.8 for more visibility
    }),
    shadowColor: isActive ? '#4CAF50' : 'transparent',
    shadowRadius: animation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 16],  // Increased from 12 for wider glow effect
    }),
    shadowOffset: { width: 0, height: 0 },
  };
  
  // Button scale animation style
  const buttonScaleStyle = {
    transform: [{ scale: pressAnimation }]
  };
  
  // Simplified press handler - directly toggle by passing the opposite state
  const handlePress = () => {
    // Provide haptic feedback
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (error) {
      // Ignore haptic errors
    }
    
    // Animate button press
    Animated.sequence([
      Animated.timing(pressAnimation, {
        toValue: 0.92,
        duration: 100,
        useNativeDriver: false
      }),
      Animated.timing(pressAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: false
      })
    ]).start();
    
    // Just call onPress directly with the opposite of current state
    onPress(!isActive);
  };
  
  return (
    <Animated.View style={[styles.buttonWrapper, perimeterGlowStyle]}>
      <Animated.View style={buttonScaleStyle}>
        <TouchableOpacity
          style={[
            styles.button,
            isActive && styles.buttonActive,
            buttonBorderStyle
          ]}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <FontAwesome5
            name="user-tie" 
            size={24} 
            color={isActive ? "#FFFFFF" : "#FF3B5C"} 
          />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  buttonWrapper: {
    borderRadius: 15,
    elevation: 8,
    backgroundColor: 'transparent',
    padding: 8, // Increased padding to give more space for the glow effect
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffccd5',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  buttonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  }
});

export default WaiterButton; 