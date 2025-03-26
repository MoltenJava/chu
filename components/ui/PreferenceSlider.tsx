import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';

type PreferenceSliderProps = {
  value: number;
  onValueChange: (value: number) => void;
  leftLabel: string;
  rightLabel: string;
  gradientColors?: [string, string];
};

export function PreferenceSlider({
  value,
  onValueChange,
  leftLabel,
  rightLabel,
  gradientColors = ['#4ECDC4', '#FF6B6B'],
}: PreferenceSliderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={[styles.label, { color: gradientColors[0] }]}>{leftLabel}</Text>
        <Text style={styles.value}>{Math.round(value)}%</Text>
        <Text style={[styles.label, { color: gradientColors[1] }]}>{rightLabel}</Text>
      </View>
      <Slider
        style={styles.slider}
        value={value}
        onValueChange={onValueChange}
        minimumValue={0}
        maximumValue={100}
        step={1}
        minimumTrackTintColor={gradientColors[1]}
        maximumTrackTintColor={gradientColors[0]}
        thumbTintColor="#FFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 12,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
  },
  slider: {
    height: 40,
  },
}); 