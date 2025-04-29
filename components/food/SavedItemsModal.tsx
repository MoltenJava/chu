import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
  SafeAreaView,
  Linking,
  SectionList,
  Alert,
  Animated,
  Easing,
  Dimensions
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { SupabaseMenuItem } from '@/types/supabase';
import { CoupleSession } from '@/types/couple';
import RandomFoodSelector from './RandomFoodSelector';

interface SavedItemsModalProps {
  visible: boolean;
  onClose: () => void;
  savedItems: SupabaseMenuItem[];
  onWaiterMode: (restaurant: string) => void;
  activeRestaurant: string | null;
  coupleSession?: CoupleSession | null;
  sessionMatchIds?: Set<string>;
  onOpenSettings: () => void;
}

interface RestaurantSection {
  title: string;
  data: SupabaseMenuItem[];
}

const SavedItemsModal: React.FC<SavedItemsModalProps> = ({
  visible,
  onClose,
  savedItems,
  onWaiterMode,
  activeRestaurant,
  coupleSession,
  sessionMatchIds = new Set(),
  onOpenSettings,
}) => {
  // Add state for random food selector modal
  const [randomSelectorVisible, setRandomSelectorVisible] = useState(false);

  const handleDeliveryPress = (foodName: string, serviceName: string, url?: string) => {
    if (url) {
      Alert.alert(
        "Open Delivery Service",
        `Would you like to order ${foodName} from ${serviceName}?`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Open", 
            onPress: () => {
              Linking.openURL(url).catch(err => {
                console.error('Error opening URL:', err);
                Alert.alert('Error', 'Could not open the delivery service website');
              });
            }
          }
        ]
      );
    } else {
      Alert.alert("Service Unavailable", `${serviceName} ordering is not available for this item.`);
    }
  };

  const handleSettingsPress = () => {
    console.log('Settings button pressed - requesting open');
    onOpenSettings();
  };

  // Add handler for dice button
  const handleRandomButtonPress = () => {
    if (savedItems.length === 0) {
      Alert.alert("No Saved Dishes", "Save some dishes first to use the random picker!");
      return;
    }
    setRandomSelectorVisible(true);
  };

  const sections = useMemo(() => {
    const restaurantMap = new Map<string, SupabaseMenuItem[]>();
    
    savedItems.forEach(item => {
      const restaurant = item.title || 'Unknown Restaurant';
      if (!restaurantMap.has(restaurant)) {
        restaurantMap.set(restaurant, []);
      }
      restaurantMap.get(restaurant)?.push(item);
    });

    const sectionsArray: RestaurantSection[] = Array.from(restaurantMap.entries()).map(([title, data]) => {
      const sortedData = coupleSession?.id
        ? [...data].sort((a, b) => {
            const aId = a._id || a.id;
            const bId = b._id || b.id;
            const aIsMatch = sessionMatchIds.has(aId);
            const bIsMatch = sessionMatchIds.has(bId);
            
            if (aIsMatch && !bIsMatch) return -1;
            if (!aIsMatch && bIsMatch) return 1;
            
            return 0;
          })
        : data;

      return {
        title,
        data: sortedData,
      };
    });
    
    sectionsArray.sort((a, b) => a.title.localeCompare(b.title));

    return sectionsArray;
  }, [savedItems, coupleSession, sessionMatchIds]);

  const renderSectionHeader = ({ section }: { section: RestaurantSection }) => {
    const isActive = activeRestaurant === section.title;
    return (
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.itemCount}>{section.data.length} items</Text>
        </View>
        <TouchableOpacity 
          style={styles.waiterButton}
          onPress={() => {
            onClose();
            onWaiterMode(section.title);
          }}
        >
          <View style={[
            styles.waiterButtonInnerBase,
            isActive ? styles.waiterButtonInnerActive : styles.waiterButtonInnerInactive
          ]}>
            <FontAwesome5 
              name="user-tie" 
              size={20} 
              color={isActive ? colorWhite : colorBlack}
            />
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderItem = ({ item }: { item: SupabaseMenuItem }) => {
    const itemId = item._id || item.id;
    const isMatch = coupleSession?.id && sessionMatchIds.has(itemId);
    
    return (
      <View style={[styles.savedItemCard, isMatch && styles.matchedItemCard]}>
        <Image source={{ uri: item.s3_url }} style={styles.savedItemImage} />
        <View style={styles.savedItemInfo}>
          {isMatch && (
            <View style={styles.matchIndicator}>
              <Ionicons name="heart" size={16} color={styles.matchIndicatorText.color} /> 
              <Text style={styles.matchIndicatorText}>Match</Text>
            </View>
          )}
          <Text style={styles.savedItemName} numberOfLines={2}>{item.menu_item || item.title}</Text>
          <Text style={styles.restaurantName}>{item.title}</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.priceText}>{item.price_level || '$$'}</Text>
          </View>
          <View style={styles.deliveryOptionsContainer}>
            {item.uber_eats_url && (
              <TouchableOpacity
                style={styles.deliveryButton}
                onPress={() => handleDeliveryPress(item.title || '', 'Uber Eats', item.uber_eats_url)}
              >
                <FontAwesome5 name="uber" size={18} color="#000" />
              </TouchableOpacity>
            )}
            {item.doordash_url && (
              <TouchableOpacity
                style={styles.deliveryButton}
                onPress={() => handleDeliveryPress(item.title || '', 'DoorDash', item.doordash_url)}
              >
                <MaterialIcons name="delivery-dining" size={18} color="#FF3008" />
              </TouchableOpacity>
            )}
            {item.postmates_url && (
              <TouchableOpacity
                style={styles.deliveryButton}
                onPress={() => handleDeliveryPress(item.title || '', 'Postmates', item.postmates_url)}
              >
                <MaterialIcons name="local-shipping" size={18} color="#000" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {coupleSession?.id ? 'Saved & Matches' : 'Your Saved Dishes'}
            </Text>
            <View style={styles.headerButtonsContainer}>
              {/* Dice button for random food selector */}
              <TouchableOpacity onPress={handleRandomButtonPress} style={styles.headerButton}>
                <Ionicons name="dice" size={24} color="#FF6F61" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSettingsPress} style={styles.headerButton}>
                <Ionicons name="settings-outline" size={26} color="#555" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                <Ionicons name="close" size={30} color="#555" />
              </TouchableOpacity>
            </View>
          </View>

          {sections.length === 0 ? (
            <View style={styles.emptyListContainer}>
              <Ionicons name="restaurant-outline" size={70} color="#ccc" />
              <Text style={styles.emptyListText}>No saved dishes yet!</Text>
              <Text style={styles.emptyListSubtext}>
                Swipe right on dishes you like to save them here
              </Text>
            </View>
          ) : (
            <SectionList
              sections={sections}
              renderSectionHeader={renderSectionHeader}
              renderItem={renderItem}
              keyExtractor={(item, index) => (item._id || item.id) + index}
              stickySectionHeadersEnabled={true}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}

          {/* Random Food Selector Modal */}
          <RandomFoodSelector 
            visible={randomSelectorVisible}
            onClose={() => setRandomSelectorVisible(false)}
            items={savedItems}
            onSelectDelivery={handleDeliveryPress}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const colorAccent = '#FF6F61';
const colorWhite = '#FFFFFF';
const colorBlack = '#000000';
const colorBorder = '#E0E0E0';
const colorLightGray = '#f0f0f0';
const colorTextSecondary = '#666';

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  headerButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 10,
  },
  listContent: {
    paddingBottom: 20,
    paddingHorizontal: 0,
  },
  savedItemCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 0,
    padding: 15,
    marginVertical: 0,
    marginHorizontal: 20,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 1.5,
    elevation: 2,
    overflow: 'visible',
    alignItems: 'center',
  },
  matchedItemCard: { 
    backgroundColor: '#FFF0ED',
    borderColor: colorAccent,
    borderWidth: 1.5,
  },
  savedItemImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    marginRight: 12,
  },
  savedItemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  savedItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  priceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF6F61',
  },
  deliveryOptionsContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  deliveryButton: {
    marginRight: 12,
    padding: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 0,
    marginHorizontal: 20,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyListText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#888',
    marginTop: 15,
    textAlign: 'center',
  },
  emptyListSubtext: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 8,
    textAlign: 'center',
  },
  matchIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colorAccent,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 1,
  },
  matchIndicatorText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  sectionHeader: {
    backgroundColor: '#f7f7f7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colorBorder,
    borderTopWidth: 1,
    borderTopColor: colorBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#444',
  },
  itemCount: {
    fontSize: 13,
    color: '#777',
    marginTop: 2,
  },
  waiterButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  waiterButtonInnerBase: {
    width: '100%',
    height: '100%',
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: colorBlack,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  waiterButtonInnerInactive: {
    backgroundColor: colorWhite,
    borderColor: colorBlack,
  },
  waiterButtonInnerActive: {
    backgroundColor: colorBlack,
    borderColor: colorBlack,
  },
});

export default SavedItemsModal; 