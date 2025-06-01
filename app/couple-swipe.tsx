import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useFoodItems } from '../hooks/useFoodItems';
import { useSession } from '../hooks/useSession';

export default function CoupleSwipeRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { session, isLoading: sessionLoading } = useSession(sessionId);
  const { foodItems, isLoading: foodItemsLoading } = useFoodItems();

  if (sessionLoading || foodItemsLoading || !session) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF3B5C" />
      </View>
    );
  }

} 