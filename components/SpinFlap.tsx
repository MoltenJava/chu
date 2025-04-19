import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';

// Define character sets for different types of flips
const ALPHA_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NUM_CHARS = "0123456789";
const SCRAMBLE_CHARS = ALPHA_CHARS + NUM_CHARS;

// --- MODIFIED: Add 'complete' to AnimationState type ---
type AnimationState = 'idle' | 'scrambling' | 'complete';

interface FlipCharProps {
  currentChar: string;
  targetChar: string;
  animationState: AnimationState; // Use updated type
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
  
  // Generate scramble sequence ONLY when state becomes scrambling
  useEffect(() => {
    if (animationState === 'scrambling' && !(isEmptySpace && !forceFlip)) {
        // --- Generation logic moved here --- 
        const numSteps = 16;
        const chars = [currentChar]; 
        const randomPhase = Math.floor(numSteps * 0.3);
        for (let i = 0; i < randomPhase; i++) {
          chars.push(SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]);
        }
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
        const settlingPhase = numSteps - randomPhase - transitionPhase - 1;
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
        for (let i = 0; i < settlingPhase; i++) {
          if (i % 2 === 0 || Math.random() < i / settlingPhase * 0.8) {
            chars.push(targetChar);
          } else {
            chars.push(nearbyChars[Math.floor(Math.random() * nearbyChars.length)]);
          }
        }
        chars.push(targetChar);
        chars.push(targetChar);
        setIntermediateChars(chars);
        // --- End of generation logic ---
    } else {
        // Clear intermediate chars if not scrambling
        setIntermediateChars([]);
    }
  }, [currentChar, targetChar, animationState, isEmptySpace, forceFlip]); // Keep dependencies

  // Run the animation effect based on state and intermediateChars
  useEffect(() => {
    // Clear any ongoing animations first
    if (animationRef.current) {
      clearTimeout(animationRef.current);
      animationRef.current = null;
    }
    flipRotation.setValue(0); // Reset rotation visually

    // Handle states
    switch (animationState) {
      case 'idle':
        setDisplayChar(currentChar); // Show the stable current character
        break;

      case 'complete':
        setDisplayChar(targetChar); // Show the final target character (no animation)
        break;

      case 'scrambling':
        // Skip animation for empty spaces unless forced
        if (isEmptySpace && !forceFlip) {
          setDisplayChar(currentChar); // Show space immediately
          return;
        }

        // Ensure intermediate characters are generated before starting
        if (intermediateChars.length === 0) {
           setDisplayChar(currentChar);
           return; 
        }
        
        // --- Animation Logic --- 
        let currentStep = 0;
        const totalSteps = intermediateChars.length;

        const runStep = () => {
          // --- Revised Stop Conditions ---
          if (currentStep >= totalSteps) {
            setDisplayChar(targetChar);
            return;
          }

          if (animationState !== 'scrambling') {
             if (animationState === 'complete') {
                setDisplayChar(targetChar);
             }
             return;
          }
          // --- End of Stop Conditions ---

          // If we reach here, state is 'scrambling' and currentStep < totalSteps.
          // Proceed with the animation step...
          setDisplayChar(intermediateChars[currentStep]);

          // Calculate timing adjustments (same as before)
          const isSettlingPhase = currentStep > totalSteps * 0.7;
          const stepDuration = duration / totalSteps;
          const settlingProgress = isSettlingPhase ? (currentStep - totalSteps * 0.7) / (totalSteps * 0.3) : 0;
          const adjustedDuration = isSettlingPhase
            ? stepDuration * (1 + settlingProgress * 1.5)
            : stepDuration;
          const easingFunction = isSettlingPhase
            ? Easing.out(Easing.quad)
            : Easing.out(Easing.cubic);

          // Animate the flip
          Animated.timing(flipRotation, {
            toValue: 1,
            duration: adjustedDuration,
            easing: easingFunction,
            useNativeDriver: true
          }).start(() => {
            if (animationState !== 'scrambling') {
                 if (animationState === 'complete') setDisplayChar(targetChar);
                 return;
            }

            flipRotation.setValue(0);
            currentStep++;

            // Schedule next step ONLY if state is still 'scrambling' and steps remain
            if (currentStep < totalSteps) {
                 // Calculate gapTime based on isSettlingPhase (need this value from before)
                 const currentIsSettlingPhase = currentStep -1 > totalSteps * 0.7; // Check based on the step that just finished
                 const currentSettlingProgress = currentIsSettlingPhase ? ((currentStep -1) - totalSteps * 0.7) / (totalSteps * 0.3) : 0;
                 const gapTime = currentIsSettlingPhase
                    ? 10 + currentSettlingProgress * 60
                    : 10;
                 animationRef.current = setTimeout(runStep, gapTime);
            } else {
                  setDisplayChar(targetChar);
            }
          });
        };
        
        // Start after initial delay
        animationRef.current = setTimeout(runStep, delay);
        break;
    }

    // Cleanup function
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
    };
  // Dependencies: intermediateChars is important now because generation is in another effect
  }, [currentChar, targetChar, animationState, delay, duration, flipRotation, intermediateChars, isEmptySpace, forceFlip]);
  
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
    
    const nextWord = words[nextIndex].toUpperCase();
    const nextChars = centerWord(nextWord);
    
    // 1. Set TARGET characters
    setTargetChars(nextChars);

    // 2. Set state to SCRAMBLING (triggers FlipChar animation)
    setAnimationState('scrambling');
    lastTransitionTimeRef.current = Date.now(); // Update last transition time

    // Clear previous main cycle timer if any
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // 3. Schedule end of visual scramble animation
    timeoutRef.current = setTimeout(() => {
      // 4. Set state to COMPLETE - FlipChar will show targetChar now
      setAnimationState('complete');

      // 5. Schedule the logical update and the *next* transition start
      // Use a short delay to allow 'complete' state to render
      const logicalUpdateDelay = 50; 
      timeoutRef.current = setTimeout(() => {
         // 6. Update CURRENT characters to match target
         setCurrentChars(nextChars);
         // 7. Update word index (state and ref)
         setCurrentWordIndex(nextIndex);
         currentWordIndexRef.current = nextIndex;
         // 8. Set state back to IDLE
         setAnimationState('idle');

         // 9. Schedule the actual next transition
         const nextInterval = transitionInterval; // Use the full interval from now
         timeoutRef.current = setTimeout(startNextWordTransition, Math.max(nextInterval, 500));

      }, logicalUpdateDelay);

    }, spinDuration); // spinDuration marks end of allowed scramble time

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
    
    lastTransitionTimeRef.current = Date.now();
    timeoutRef.current = setTimeout(() => {
      startNextWordTransition();
    }, transitionInterval);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [words, fixedNumChars, transitionInterval]);
  
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
    backgroundColor: '#FF6F61',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 3,
      },
    }),
    position: 'relative',
  },
  charContainer: {
    width: 22,
    height: 30,
    margin: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#212121',
    borderRadius: 2,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.1)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0, 0, 0, 0.4)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.5)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.5,
        shadowRadius: 1,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  flipChar: {
    fontSize: 20,
    color: 'white',
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    letterSpacing: -0.5,
  },
  emptyChar: {
    opacity: 0,
  },
  separator: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    top: '50%',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  }
});

export default SplitFlapText;