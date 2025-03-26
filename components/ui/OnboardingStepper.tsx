import { View, StyleSheet, Animated } from 'react-native';
import React from 'react';

type OnboardingStepperProps = {
  currentStep: number;
  totalSteps: number;
};

export function OnboardingStepper({ currentStep, totalSteps }: OnboardingStepperProps) {
  return (
    <View style={styles.container}>
      <View style={styles.stepsContainer}>
        {Array.from({ length: totalSteps }).map((_, index) => (
          <View 
            key={index}
            style={[
              styles.step,
              index <= currentStep ? styles.stepActive : styles.stepInactive,
              index === 0 && styles.stepFirst,
              index === totalSteps - 1 && styles.stepLast,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  stepsContainer: {
    flexDirection: 'row',
    height: 4,
    backgroundColor: '#FFF',
    borderRadius: 2,
    overflow: 'hidden',
  },
  step: {
    flex: 1,
    marginHorizontal: 2,
  },
  stepActive: {
    backgroundColor: '#FF4088',
  },
  stepInactive: {
    backgroundColor: '#FFC0CB',
  },
  stepFirst: {
    marginLeft: 0,
  },
  stepLast: {
    marginRight: 0,
  },
}); 