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
  Easing,
  Dimensions,
  Pressable,
  ActivityIndicator
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { SupabaseMenuItem } from '@/types/supabase';
import { CoupleSession } from '@/types/couple';
import RandomFoodSelector from './RandomFoodSelector';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

interface SavedItemsModalProps {
  visible: boolean;
  onClose: () => void;
  savedItems: SupabaseMenuItem[];
  onWaiterMode: (restaurant: string) => void;
  activeRestaurant: string | null;
  coupleSession?: CoupleSession | null;
  sessionMatchIds?: Set<string>;
  onLogoutRequest: () => void;
  onClearAll: () => void;
  isLoading: boolean;
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
  onLogoutRequest,
  onClearAll,
  isLoading,
}) => {
  const [randomSelectorVisible, setRandomSelectorVisible] = useState(false);
  const [isSettingsDropdownVisible, setIsSettingsDropdownVisible] = useState(false);

  const dropdownAnim = useSharedValue(0);

  useEffect(() => {
    dropdownAnim.value = withSpring(isSettingsDropdownVisible ? 1 : 0, {
      damping: 12,
      stiffness: 100,
    });
  }, [isSettingsDropdownVisible]);

  const dropdownAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(dropdownAnim.value, [0, 1], [0.8, 1], Extrapolate.CLAMP);
    const translateY = interpolate(dropdownAnim.value, [0, 1], [-20, 0], Extrapolate.CLAMP);
    const opacity = dropdownAnim.value;

    return {
      opacity,
      transform: [{ scale }, { translateY }],
    };
  });

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
    setIsSettingsDropdownVisible(prev => !prev);
  };

  const handleLogoutPress = () => {
    setIsSettingsDropdownVisible(false);
    onLogoutRequest();
  };

  const handleRandomButtonPress = () => {
    if (savedItems.length === 0) {
      Alert.alert("No Saved Dishes", "Save some dishes first to use the random picker!");
      return;
    }
    setRandomSelectorVisible(true);
  };

  const handleClearAllPress = () => {
    setIsSettingsDropdownVisible(false);
    onClearAll();
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

  const renderModalContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colorAccent} />
        </View>
      );
    }

    if (sections.length === 0) {
      return (
        <View style={styles.emptyListContainer}>
          <Ionicons name="restaurant-outline" size={70} color="#ccc" />
          <Text style={styles.emptyListText}>No saved dishes yet!</Text>
          <Text style={styles.emptyListSubtext}>
            Swipe right on dishes you like to save them here
          </Text>
        </View>
      );
    }

    return (
      <SectionList
        sections={sections}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        keyExtractor={(item, index) => (item._id || item.id) + index}
        stickySectionHeadersEnabled={true}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        style={{ flex: 1 }}
      />
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
        <Pressable 
          style={{flex: 1}} 
          onPress={() => setIsSettingsDropdownVisible(false)}
          disabled={!isSettingsDropdownVisible}
        >
          <View style={styles.modalContent} >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {coupleSession?.id ? 'Saved & Matches' : 'Your Saved Dishes'}
              </Text>
              <View style={styles.headerButtonsContainer}>
                <TouchableOpacity onPress={handleRandomButtonPress} style={styles.modalHeaderButtonContainer}>
                  <View style={styles.modalHeaderButtonInner}>
                    <Ionicons name="dice" size={22} color={colorAccent} /> 
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={handleSettingsPress} style={styles.modalHeaderButtonContainer}>
                  <View style={styles.modalHeaderButtonInner}>
                    <Ionicons name="settings-outline" size={24} color={colorTextSecondary} />
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={onClose} style={styles.modalHeaderButtonContainer}>
                  <View style={styles.modalHeaderButtonInner}>
                    <Ionicons name="close" size={28} color={colorTextSecondary} />
                  </View>
                </TouchableOpacity>
              </View>
              
              {isSettingsDropdownVisible && (
                <Animated.View style={[styles.settingsDropdown, dropdownAnimatedStyle]}>
                  <TouchableOpacity onPress={handleClearAllPress} style={styles.dropdownItem}>
                    <Ionicons name="trash-bin-outline" size={20} color={colorAccent} style={styles.dropdownIcon} />
                    <Text style={[styles.dropdownText, styles.dropdownTextDestructive]}>Clear All Items</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.dropdownSeparator} />
                  
                  <TouchableOpacity onPress={handleLogoutPress} style={styles.dropdownItem}>
                    <Ionicons name="log-out-outline" size={20} color={colorTextSecondary} style={styles.dropdownIcon} />
                    <Text style={styles.dropdownText}>Logout</Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>

            {renderModalContent()}

            <RandomFoodSelector 
              visible={randomSelectorVisible}
              onClose={() => setRandomSelectorVisible(false)}
              items={savedItems}
              onSelectDelivery={handleDeliveryPress}
            />
          </View>
        </Pressable>
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
const colorShadow = '#BDBDBD';

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
    borderBottomColor: colorLightGray,
    backgroundColor: '#fff',
    position: 'relative',
    zIndex: 10,
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
  modalHeaderButtonContainer: {
    width: 40, 
    height: 40, 
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  modalHeaderButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colorWhite,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colorBorder,
    shadowColor: colorShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
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
  settingsDropdown: {
    position: 'absolute',
    top: 55,
    right: 15,
    backgroundColor: colorWhite,
    borderRadius: 8,
    paddingVertical: 5,
    shadowColor: colorShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 1000,
    minWidth: 150,
    borderWidth: 1,
    borderColor: colorBorder,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  dropdownIcon: {
    marginRight: 10,
  },
  dropdownText: {
    fontSize: 16,
    color: colorTextSecondary, 
  },
  dropdownTextDestructive: {
    color: colorAccent, 
  },
  dropdownSeparator: {
    height: 1,
    backgroundColor: colorBorder,
    marginVertical: 5,
    marginHorizontal: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SavedItemsModal; 