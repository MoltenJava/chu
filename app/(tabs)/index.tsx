import { Redirect } from 'expo-router';
import React from 'react';

// This component will immediately redirect to the default tab ('food')
// It effectively acts as the entry point for the (tabs) group
// and ensures the user doesn't land on a blank or incorrect index screen.

export default function TabIndex() {
  return <Redirect href="/(tabs)/food" />;
}
