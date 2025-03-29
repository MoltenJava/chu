import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';

// Define character sets for different types of flips
const ALPHA_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NUM_CHARS = "0123456789";
const SCRAMBLE_CHARS = ALPHA_CHARS + NUM_CHARS;

interface FlipCharProps {
  currentChar: string;
  targetChar: string;
  animationState: 'idle' | 'scrambling' | 'complete';
  delay: number;
  duration?: number;
  style?: any;
  forceFlip?: boolean;
}

const FlipChar: React.FC<FlipCharProps> = ({
  currentChar,
  targetChar,
  animationState,
  delay,
  duration = 1400,
  style = {},
  forceFlip = false
}) => {
  // Animation values
  const flipRotation = useRef(new Animated.Value(0)).current;
  const [displayChar, setDisplayChar] = useState(currentChar);
  const [intermediateChars, setIntermediateChars] = useState<string[]>([]);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const isEmptySpace = currentChar === ' ' && targetChar === ' ' && !forceFlip;
  
  // Generate scramble sequence when animation starts
  useEffect(() => {
    if (animationState !== 'scrambling' || (isEmptySpace && !forceFlip)) {
      return;
    }
    
    // Generate random intermediate characters
    const numSteps = 16;
    const chars = [currentChar]; // Start with current character
    
    // Phase 1: Completely random (first ~30% of animation)
    const randomPhase = Math.floor(numSteps * 0.3);
    for (let i = 0; i < randomPhase; i++) {
      chars.push(SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]);
    }
    
    // Phase 2: Gradually increasing probability of target (middle ~40% of animation)
    const transitionPhase = Math.floor(numSteps * 0.4);
    for (let i = 0; i < transitionPhase; i++) {
      const progress = i / transitionPhase;
      const useTargetChar = Math.random() < progress * 0.6;
      
      if (useTargetChar) {
        chars.push(targetChar);
      } else {
        chars.push(SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]);
      }
    }
    
    // Phase 3: "Settling" pattern (last ~30% of animation)
    const settlingPhase = numSteps - randomPhase - transitionPhase - 1;
    
    // Get characters "near" the target in the alphabet
    const targetIndex = SCRAMBLE_CHARS.indexOf(targetChar);
    let nearbyChars = [];
    
    if (targetIndex >= 0) {
      for (let offset = -2; offset <= 2; offset++) {
        if (offset === 0) continue;
        const nearbyIndex = (targetIndex + offset + SCRAMBLE_CHARS.length) % SCRAMBLE_CHARS.length;
        nearbyChars.push(SCRAMBLE_CHARS[nearbyIndex]);
      }
    } else {
      nearbyChars = [
        SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)],
        SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)],
      ];
    }
    
    // Create oscillating pattern between target and nearby chars
    for (let i = 0; i < settlingPhase; i++) {
      if (i % 2 === 0 || Math.random() < i / settlingPhase * 0.8) {
        chars.push(targetChar);
      } else {
        chars.push(nearbyChars[Math.floor(Math.random() * nearbyChars.length)]);
      }
    }
    
    // Always end with the target character
    chars.push(targetChar);
    chars.push(targetChar);
    
    setIntermediateChars(chars);
  }, [currentChar, targetChar, animationState, isEmptySpace, forceFlip]);
  
  // Run the animation when animationState changes
  useEffect(() => {
    // Clear any ongoing animations
    if (animationRef.current) {
      clearTimeout(animationRef.current);
      animationRef.current = null;
    }
    
    // Reset rotation
    flipRotation.setValue(0);
    
    // Handle different animation states
    switch (animationState) {
      case 'idle':
        // Just show the current character
        setDisplayChar(currentChar);
        break;
        
      case 'complete':
        // Show the target character
        setDisplayChar(targetChar);
        break;
        
      case 'scrambling':
        // Skip animation for empty spaces unless forced
        if (isEmptySpace && !forceFlip) {
          setDisplayChar(currentChar);
          return;
        }
        
        // If no intermediate chars yet, show current char
        if (intermediateChars.length === 0) {
          setDisplayChar(currentChar);
          return;
        }
        
        // Start the animation sequence
        let currentStep = 0;
        const totalSteps = intermediateChars.length;
        
        const runStep = () => {
          if (currentStep >= totalSteps) {
            setDisplayChar(targetChar);
            return;
          }
          
          // Update the displayed character
          setDisplayChar(intermediateChars[currentStep]);
          
          // Calculate timing adjustments
          const isSettlingPhase = currentStep > totalSteps * 0.7;
          const stepDuration = duration / totalSteps;
          const adjustedDuration = isSettlingPhase 
            ? stepDuration * (1 + (currentStep / totalSteps) * 0.5)
            : stepDuration;
          
          const easingFunction = isSettlingPhase
            ? Easing.out(Easing.bounce)
            : Easing.out(Easing.cubic);
          
          // Animate the flip
          Animated.timing(flipRotation, {
            toValue: 1,
            duration: adjustedDuration,
            easing: easingFunction,
            useNativeDriver: true
          }).start(() => {
            flipRotation.setValue(0);
            currentStep++;
            
            if (currentStep < totalSteps) {
              // Gap gradually increases during settling phase
              const gapTime = isSettlingPhase
                ? 10 + (currentStep / totalSteps) * 40
                : 10;
                
              animationRef.current = setTimeout(runStep, gapTime);
            }
          });
        };
        
        // Start after delay
        animationRef.current = setTimeout(runStep, delay);
        break;
    }
    
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [
    currentChar, 
    targetChar, 
    animationState, 
    delay, 
    duration, 
    flipRotation, 
    intermediateChars, 
    isEmptySpace, 
    forceFlip
  ]);
  
  // Create the rotation transform
  const flipStyle = {
    transform: [
      {
        // Add slight overshoot for mechanical feel
        rotateX: flipRotation.interpolate({
          inputRange: [0, 0.4, 0.5, 0.6, 1],
          outputRange: ['0deg', '70deg', '90deg', '110deg', '0deg']
        })
      }
    ],
    // More pronounced scaling for physical feel
    scaleY: flipRotation.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 0.85, 1]
    }),
    // More pronounced fade during flip
    opacity: flipRotation.interpolate({
      inputRange: [0, 0.25, 0.5, 0.75, 1],
      outputRange: [1, 0.4, 0.2, 0.4, 1]
    }),
    // Subtle horizontal movement for mechanical imperfection
    translateX: flipRotation.interpolate({
      inputRange: [0, 0.25, 0.75, 1],
      outputRange: [0, -0.5, 0.5, 0]
    })
  };
  
  return (
    <View style={[styles.charContainer, style]}>
      <Animated.Text 
        style={[
          styles.flipChar,
          isEmptySpace && !forceFlip && styles.emptyChar,
          flipStyle
        ]}
      >
        {displayChar}
      </Animated.Text>
      
      <View style={styles.separator} />
    </View>
  );
};

// Three-state animation approach
type AnimationState = 'idle' | 'scrambling' | 'complete';

interface SplitFlapTextProps {
  words: string[];
  transitionInterval?: number;
  charDuration?: number;
  spinDuration?: number;
  style?: any;
  charStyle?: any;
  staticText?: string;
  fixedNumChars?: number;
  alwaysFlipAllChars?: boolean;
}

const SplitFlapText: React.FC<SplitFlapTextProps> = ({
  words = ['EVERYWHERE', 'SUSHI', 'BURGERS', 'PIZZA', 'TACOS'],
  transitionInterval = 4000,
  charDuration = 1400,
  spinDuration = 2500,
  style = {},
  charStyle = {},
  staticText,
  fixedNumChars = 10,
  alwaysFlipAllChars = true
}) => {
  // Track current and next words
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentChars, setCurrentChars] = useState<string[]>([]);
  const [targetChars, setTargetChars] = useState<string[]>([]);
  
  // Animation state is explicitly managed
  const [animationState, setAnimationState] = useState<AnimationState>('idle');
  
  // Refs for timers and state tracking
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxLength = useRef(0);
  const cycleCountRef = useRef(0);
  const lastTransitionTimeRef = useRef(Date.now());
  const isAnimatingRef = useRef(false);
  const currentWordIndexRef = useRef(0);
  
  // Helper to center a word in the display
  const centerWord = (word: string) => {
    const chars = word.toUpperCase().split('');
    const padding = Math.floor((maxLength.current - chars.length) / 2);
    const result = Array(maxLength.current).fill(' ');
    
    chars.forEach((char, i) => {
      if (padding + i < maxLength.current) {
        result[padding + i] = char;
      }
    });
    
    return result;
  };
  
  // Start transition to the next word
  const startNextWordTransition = () => {
    // Track cycling for debugging
    cycleCountRef.current += 1;
    const cycleCount = cycleCountRef.current;
    
    // Record transition time
    lastTransitionTimeRef.current = Date.now();
    
    // Use REF value instead of state directly
    const nextIndex = (currentWordIndexRef.current + 1) % words.length;
    
    console.log(`[Cycle ${cycleCount}] Transitioning from word ${currentWordIndexRef.current} (${words[currentWordIndexRef.current]}) to ${nextIndex} (${words[nextIndex]})`);
    
    // Calculate target characters
    const nextWord = words[nextIndex].toUpperCase();
    const nextChars = centerWord(nextWord);
    
    // Set the target but keep displaying current chars
    setTargetChars(nextChars);
    
    // Start the scrambling animation
    setAnimationState('scrambling');
    
    // After animation completes
    const timer = setTimeout(() => {
      console.log(`[Cycle ${cycleCount}] Animation complete, updating to show word ${nextIndex}`);
      
      // Update displayed word AND the ref
      setCurrentWordIndex(nextIndex);
      currentWordIndexRef.current = nextIndex;  // <-- THIS IS KEY
      setCurrentChars(nextChars);
      
      // Reset animation state
      setAnimationState('idle');
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Schedule next transition
      const nextDelay = transitionInterval - spinDuration;
      console.log(`[Cycle ${cycleCount}] Scheduling next transition in ${nextDelay}ms`);
      
      timeoutRef.current = setTimeout(() => {
        console.log(`[Cycle ${cycleCount}] Starting next transition sequence`);
        // The startNextWordTransition function will get the latest currentWordIndex
        startNextWordTransition();
      }, Math.max(nextDelay, 500)); // Ensure a minimum delay
    }, spinDuration);
    
    // Store the timer for cleanup
    timeoutRef.current = timer;
  };
  
  // Initialize on mount
  useEffect(() => {
    maxLength.current = fixedNumChars || Math.max(...words.map(word => word.length));
    
    // Start with the first word
    const firstWord = words[0].toUpperCase();
    const centeredChars = centerWord(firstWord);
    setCurrentChars(centeredChars);
    setTargetChars(centeredChars);
    setCurrentWordIndex(0);
    currentWordIndexRef.current = 0;  // <-- ADD THIS LINE
    
    // Start the rotation timer
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    console.log('Component mounted, scheduling first transition');
    timeoutRef.current = setTimeout(() => {
      startNextWordTransition();
    }, transitionInterval);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [words, fixedNumChars]);
  
  // Failsafe watchdog timer to recover from stalls
  useEffect(() => {
    const watchdogTimer = setTimeout(() => {
      const timeSinceLastTransition = Date.now() - lastTransitionTimeRef.current;
      
      // If it's been too long since the last transition (over 1.5x the expected time)
      if (timeSinceLastTransition > transitionInterval * 1.5) {
        console.log(`Watchdog: Detected potential stall (${timeSinceLastTransition}ms since last transition)`);
        
        // Force a fresh start with the next word
        const nextIndex = (currentWordIndex + 1) % words.length;
        console.log(`Watchdog: Forcing transition to word ${nextIndex}`);
        
        // Clear any existing timeouts
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        // Reset state and force move to next word
        setAnimationState('idle');
        setCurrentWordIndex(nextIndex);
        currentWordIndexRef.current = nextIndex;
        setCurrentChars(centerWord(words[nextIndex].toUpperCase()));
        
        // Schedule a fresh transition
        console.log('Watchdog: Scheduling recovery transition');
        lastTransitionTimeRef.current = Date.now(); // Reset the timer
        timeoutRef.current = setTimeout(startNextWordTransition, 1000);
      }
    }, transitionInterval); // Check once per expected cycle
    
    return () => {
      clearTimeout(watchdogTimer);
    };
  });
  
  return (
    <View style={[styles.container, style]}>
      {staticText && (
        <Text style={styles.staticText}>{staticText}</Text>
      )}
      
      <View style={styles.flipBoard}>
        {currentChars.map((char, index) => {
          // Position-based delay with edge variance
          const baseDelay = 80 + index * 60 + Math.random() * 100;
          
          // Add more randomness for characters at the edges
          const centerIndex = Math.floor(currentChars.length / 2);
          const distanceFromCenter = Math.abs(index - centerIndex);
          const centerRatio = centerIndex > 0 ? distanceFromCenter / centerIndex : 0;
          const edgeRandomness = centerRatio * 150 * Math.random();
          
          const delay = baseDelay + edgeRandomness;
          
          // Generate a stable key that doesn't depend on the index
          // This helps React properly track and update each character
          const charKey = `char-${index}-${currentWordIndex}-${cycleCountRef.current}`;
          
          return (
            <FlipChar
              key={charKey}
              currentChar={char}
              targetChar={targetChars[index]}
              animationState={animationState}
              delay={delay}
              duration={charDuration}
              style={charStyle}
              forceFlip={alwaysFlipAllChars}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginVertical: 20,
  },
  staticText: {
    fontSize: 22,
    color: 'white',
    fontWeight: '500',
    marginBottom: 10,
    textAlign: 'center',
  },
  flipBoard: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(156, 0, 0, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 4,
    // Add shadow for depth
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
    position: 'relative',
  },
  charContainer: {
    width: 28,
    height: 38,
    margin: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a0000',
    borderRadius: 2,
    overflow: 'hidden',
    // Enhanced bevel effect for more mechanical appearance
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.25)',
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(255,255,255,0.15)',
    borderRightWidth: 1.5,
    borderRightColor: 'rgba(0,0,0,0.4)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(0,0,0,0.3)',
    // Add inner shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.5,
        shadowRadius: 1,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  flipChar: {
    fontSize: 26,
    color: 'white',
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    // Enhanced text shadow for dimensional appearance
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
    letterSpacing: -0.5,
  },
  emptyChar: {
    opacity: 0,
  },
  separator: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    top: '50%',
    // Add subtle highlight below separator
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  }
});

export default SplitFlapText;