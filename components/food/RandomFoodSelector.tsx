import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Button,
} from "react-native";
import { Ionicons, FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { SupabaseMenuItem } from "@/types/supabase";
import * as Haptics from 'expo-haptics';
import * as Sentry from '@sentry/react-native';

/** ===== constants ===== */
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const CARD_W = 120;
const CARD_GAP = 10;
const SPACER = (SCREEN_W - CARD_W) / 2; // keeps centred
const COLOR_ACCENT = "#FF6F61";
const COLOR_WHITE = "#fff";

// Confetti piece component
const ConfettiPiece = ({ startPosition, colors }: { startPosition: number, colors: string[] }) => {
  const animatedY = useRef(new Animated.Value(-20)).current;
  const animatedX = useRef(new Animated.Value(0)).current;
  const animatedRotate = useRef(new Animated.Value(0)).current;
  const animatedScale = useRef(new Animated.Value(1)).current;
  const animatedOpacity = useRef(new Animated.Value(1)).current;
  
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  const size = 8 + Math.random() * 6; // random size between 8-14
  const shape = Math.random() > 0.5 ? styles.square : styles.circle;
  const xMove = -30 + Math.random() * 60; // random horizontal movement
  
  useEffect(() => {
    Animated.parallel([
      // Fall down
      Animated.timing(animatedY, {
        toValue: SCREEN_H,
        duration: 2000 + Math.random() * 1000, // random duration
        easing: Easing.bezier(0.25, 1, 0.5, 1),
        useNativeDriver: true,
      }),
      // Drift horizontally
      Animated.timing(animatedX, {
        toValue: xMove,
        duration: 2500,
        easing: Easing.bezier(0.25, 1, 0.5, 1),
        useNativeDriver: true,
      }),
      // Rotate
      Animated.timing(animatedRotate, {
        toValue: Math.random() > 0.5 ? 1 : -1, // random rotation direction
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      // Fade out near end
      Animated.timing(animatedOpacity, {
        toValue: 0,
        duration: 2500,
        delay: 1500,
        useNativeDriver: true,
      }),
      // Scale slightly
      Animated.timing(animatedScale, {
        toValue: 0.8,
        duration: 2500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  return (
    <Animated.View 
      style={[
        shape,
        {
          position: 'absolute',
          left: startPosition,
          width: size,
          height: size,
          backgroundColor: randomColor,
          opacity: animatedOpacity,
          transform: [
            { translateY: animatedY },
            { translateX: animatedX },
            { rotate: animatedRotate.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg']
              })
            },
            { scale: animatedScale }
          ]
        }
      ]}
    />
  );
};

// Simple confetti container
const ConfettiContainer = ({ count = 40 }) => {
  const positions = useMemo(() => {
    return Array(count).fill(0).map(() => Math.random() * SCREEN_W);
  }, [count]);
  
  const colors = ['#FFDD00', '#5CE1E6', '#FF8E82', '#A5D6FF', '#F9A8D4', '#6BD968', '#FFB800', '#FF5C8D'];
  
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {positions.map((position, index) => (
        <ConfettiPiece key={index} startPosition={position} colors={colors} />
      ))}
    </View>
  );
};

interface Props {
  visible: boolean;
  onClose: () => void;
  items: SupabaseMenuItem[];
  onSelectDelivery: (
    food: string,
    service: string,
    url?: string
  ) => void;
}

export default function RandomFoodSelector({
  visible,
  onClose,
  items,
  onSelectDelivery,
}: Props) {
  /* ------------ derived list (repeat x4 for long spin) ------------ */
  const reelData = useMemo(() => {
    if (!items.length) return [];
    
    // Calculate how many items needed to fill screen width + extra for animation
    const itemsPerScreen = Math.ceil(SCREEN_W / (CARD_W + CARD_GAP));
    
    // Ensure we have at least 3 full screens of items for smooth animation
    // If original array is small, we need more repetitions
    const minItemsNeeded = itemsPerScreen * 6;
    const repetitions = Math.max(8, Math.ceil(minItemsNeeded / items.length));
    
    // Create the repeated array
    return Array(repetitions).fill(items).flat();
  }, [items]);

  /* ------------ animation refs ------------ */
  const x = useRef(new Animated.Value(0)).current;
  const detailFade = useRef(new Animated.Value(0)).current;
  const btnSlide = useRef(new Animated.Value(40)).current;
  const tickerScale = useRef(new Animated.Value(1)).current;
  const tickerOpacity = useRef(new Animated.Value(0.7)).current;
  
  // Confetti state
  const [showConfetti, setShowConfetti] = useState(false);

  /* ------------ state ------------ */
  const [selected, setSelected] = useState<SupabaseMenuItem | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinComplete, setSpinComplete] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  // Add debugging useEffect for restaurant data
  useEffect(() => {
    if (selected && spinComplete) {
      console.log('[RANDOM-FOOD] Selected item:', 
        { 
          name: selected.menu_item, 
          title: selected.title,
          // log raw restaurant data for debugging
          restaurant_raw: selected.restaurant
        }
      );
    }
  }, [selected, spinComplete]);

  /* ------------ helpers ------------ */
  // Center of the screen where the selected item should land
  const centerPoint = SCREEN_W / 2;

  // Animate the ticker to draw attention
  useEffect(() => {
    if (isSpinning) {
      // Create a looping animation for the ticker
      Animated.loop(
        Animated.sequence([
          // Pulse effect
          Animated.parallel([
            Animated.timing(tickerScale, {
              toValue: 1.2,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(tickerOpacity, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(tickerScale, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(tickerOpacity, {
              toValue: 0.7,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    } else {
      // Reset animations when not spinning
      tickerScale.setValue(1);
      tickerOpacity.setValue(0.7);
    }
  }, [isSpinning]);

  const runSpin = () => {
    if (!items.length) return;

    // Start spinning
    setIsSpinning(true);
    setSpinComplete(false);
    setSelected(null);
    setSelectedIndex(null);
    setShowConfetti(false);
    
    // reset UI
    x.setValue(0);
    detailFade.setValue(0);
    btnSlide.setValue(40);

    // choose winning index (only from ORIGINAL array!)
    const winIdx = Math.floor(Math.random() * items.length);
    setSelectedIndex(winIdx);

    // How many *additional* cards pass by before we stop (3-5 full reels for longer spin)
    const loops = 3 + Math.floor(Math.random() * 2);

    // Calculate the final position so item lands exactly in center
    // Note: CARD_W/2 adjustment ensures the center of the card aligns with center of screen
    const finalTranslate = -1 * (
      (items.length * loops + winIdx) * (CARD_W + CARD_GAP) - 
      ((SCREEN_W - CARD_W) / 2)
    );

    // Single continuous animation with carefully controlled easing
    const spinAnimation = Animated.timing(x, {
      toValue: finalTranslate,
      duration: 3000, // Longer duration for more spinning
      // Use a cubic bezier to create fast start and gradual slowdown without bouncing
      easing: t => {
        // Custom easing: fast acceleration and then smooth deceleration
        return t < 0.6 
          ? Easing.in(Easing.cubic)(t / 0.6) 
          : Easing.out(Easing.cubic)((t - 0.6) / 0.4);
      },
      useNativeDriver: true,
    });
    
    spinAnimation.start(() => {
      // First update state to trigger render
      setSelected(items[winIdx]);
      setIsSpinning(false);
      setSpinComplete(true);
      
      // Trigger a single strong haptic feedback
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch (e) {
        console.log('Haptics not supported', e);
      }
      
      // Start confetti
      setShowConfetti(true);
      
      // Start animations for details and buttons
      Animated.parallel([
        Animated.timing(detailFade, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(btnSlide, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  // Position of the center frame relative to the window - adjusted to be perfectly centered
  const centerFrameLeftPosition = (SCREEN_W - (CARD_W + 6)) / 2; // Center the frame considering its width
  
  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setIsSpinning(false);
      setSpinComplete(false);
      setSelected(null);
      setShowConfetti(false);
    }
  }, [visible]);

  if (!visible) return null;

  /* ------------ render ------------ */
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.shell}>
          {/* Confetti */}
          {showConfetti && <ConfettiContainer />}
          
          {/* close - only show when not spinning */}
          {!isSpinning && (
            <TouchableOpacity style={styles.close} onPress={onClose}>
              <Ionicons name="close" size={28} color="#555" />
            </TouchableOpacity>
          )}

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Wheel of Chewzee!</Text>
            <Ionicons name="restaurant" size={24} color={COLOR_ACCENT} style={styles.titleIcon} />
          </View>

          {!isSpinning && !spinComplete && (
            <View style={styles.startContainer}>
              <View style={styles.iconContainer}>
                <Ionicons name="restaurant" size={100} color={COLOR_ACCENT} />
                <Ionicons name="dice" size={50} color="#555" style={styles.diceIcon} />
              </View>
              <Text style={styles.instructionText}>
                Ready to discover your next meal?
              </Text>
              <TouchableOpacity style={styles.rollButton} onPress={runSpin}>
                <Ionicons name="dice" size={24} color="#fff" />
                <Text style={styles.rollText}>SPIN THE WHEEL!</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* reel - only show when spinning */}
          {isSpinning && (
            <View style={styles.reelWindow}>
              <Animated.View
                style={{
                  flexDirection: "row",
                  transform: [{ translateX: x }],
                }}
              >
                {reelData.map((it, idx) => (
                  <Image
                    key={`${idx}-${it.id}`}
                    source={{ uri: it.s3_url }}
                    style={styles.reelCard}
                  />
                ))}
              </Animated.View>
              
              {/* Center indicator */}
              <Animated.View 
                style={[
                  styles.centerIndicator, 
                  { 
                    opacity: tickerOpacity,
                    transform: [{ scaleX: tickerScale }]
                  }
                ]}
              >
                <View style={styles.tickerLine} />
                <Animated.View 
                  style={[
                    styles.tickerTriangle,
                    { transform: [{ scale: tickerScale }] }
                  ]}
                />
              </Animated.View>
            </View>
          )}

          {/* Single selected food - only show after spin completes */}
          {spinComplete && selected && (
            <View style={styles.selectedFoodContainer}>
              <Image
                source={{ uri: selected.s3_url }}
                style={styles.selectedFood}
              />
              <View style={styles.selectedHighlight} />
            </View>
          )}

          {/* details */}
          {selected && spinComplete && (
            <Animated.View style={[styles.detailBox, { opacity: detailFade }]}>
              <Text style={styles.foodTxt}>{selected.menu_item || selected.title}</Text>
              <Text style={styles.restTxt}>
                {selected.title || 'No Restaurant'}
              </Text>
            </Animated.View>
          )}

          {/* buttons */}
          {selected && spinComplete && (
            <Animated.View style={{ transform: [{ translateY: btnSlide }] }}>
              {selected.uber_eats_url && (
                <CTA
                  icon={<FontAwesome5 name="uber" size={18} color="#000" />}
                  label="Uber Eats"
                  onPress={() =>
                    onSelectDelivery(
                      selected.title || "",
                      "Uber Eats",
                      selected.uber_eats_url
                    )
                  }
                />
              )}
              {selected.doordash_url && (
                <CTA
                  icon={<MaterialIcons name="delivery-dining" size={20} color="#E60000" />}
                  label="DoorDash"
                  onPress={() =>
                    onSelectDelivery(
                      selected.title || "",
                      "DoorDash",
                      selected.doordash_url
                    )
                  }
                />
              )}
              {selected.postmates_url && (
                <CTA
                  icon={<MaterialIcons name="local-shipping" size={20} color="#000" />}
                  label="Postmates"
                  onPress={() =>
                    onSelectDelivery(
                      selected.title || "",
                      "Postmates",
                      selected.postmates_url
                    )
                  }
                />
              )}
              {/* spin again */}
              <TouchableOpacity style={styles.spinAgain} onPress={runSpin}>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.spinTxt}>Roll Again</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const CTA = ({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.cta} onPress={onPress}>
    {icon}
    <Text style={styles.ctaTxt}>{label}</Text>
  </TouchableOpacity>
);

/* ====== styles ====== */
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  shell: {
    width: "100%",
    backgroundColor: COLOR_WHITE,
    borderRadius: 26,
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  close: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 6,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
  },
  titleIcon: {
    marginLeft: 8,
  },
  startContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  iconContainer: {
    position: "relative",
    width: 160,
    height: 160,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  diceIcon: {
    position: "absolute",
    right: 10,
    bottom: 10,
  },
  instructionText: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 25,
    color: "#555",
  },
  rollButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLOR_ACCENT,
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    borderWidth: 2,
    borderColor: "#FF8E82",
  },
  rollText: {
    color: COLOR_WHITE,
    marginLeft: 8,
    fontWeight: "800",
    fontSize: 18,
  },
  reelWindow: {
    height: CARD_W,
    overflow: "hidden",
    width: "100%",
  },
  reelCard: {
    width: CARD_W,
    height: CARD_W,
    borderRadius: 12,
    marginRight: CARD_GAP,
    backgroundColor: "#eee",
  },
  selectedFoodContainer: {
    position: "relative",
    marginVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedFood: {
    width: CARD_W + 20,
    height: CARD_W + 20,
    borderRadius: 12,
    backgroundColor: "#eee",
  },
  selectedHighlight: {
    width: CARD_W + 26,
    height: CARD_W + 26,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: COLOR_ACCENT,
    position: "absolute",
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
  },
  highlightContainer: {
    position: "absolute",
    top: 36,
    left: 0,
    right: 0,
    height: CARD_W,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    pointerEvents: "none",
  },
  highlight: {
    width: CARD_W + 6,
    height: CARD_W + 6,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: COLOR_ACCENT,
    position: "absolute",
    top: -3,
    left: -3,
  },
  detailBox: {
    marginTop: 26,
    alignItems: "center",
  },
  foodTxt: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  restTxt: {
    fontSize: 15,
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f2f2f2",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 24,
    marginTop: 12,
  },
  ctaTxt: {
    marginLeft: 8,
    fontWeight: "600",
  },
  spinAgain: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLOR_ACCENT,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 26,
    marginTop: 18,
  },
  spinTxt: {
    color: COLOR_WHITE,
    marginLeft: 8,
    fontWeight: "600",
  },
  centerIndicator: {
    position: "absolute",
    top: 0,
    left: "50%", 
    marginLeft: -1, // Center the 2px line
    height: "100%",
    zIndex: 10,
    pointerEvents: "none",
  },
  tickerLine: {
    width: 2,
    height: "100%",
    backgroundColor: COLOR_ACCENT,
  },
  tickerTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: COLOR_ACCENT,
    position: "absolute",
    bottom: 0,
    left: -7, // Center the triangle on the line
  },
  square: {
    borderRadius: 1
  },
  circle: {
    borderRadius: 50
  },
});
