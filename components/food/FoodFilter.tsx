import React, { useState, useCallback, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Animated,
  Dimensions
} from 'react-native';
import { 
  MaterialCommunityIcons, 
  FontAwesome5, 
  Ionicons, 
  MaterialIcons,
  Entypo
} from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Define rustic Palm Springs colors
const rustWheat = '#E5D3B3';       // Light tan/wheat color
const rustWood = '#A67C52';        // Medium wood tone
const rustBark = '#715031';        // Darker wood/bark
const rustCharcoal = '#3A3A3A';    // Charcoal gray for buttons
const rustEmber = '#BF5942';       // Ember/burnt orange accent
const rustSand = '#DDC9A3';        // Lighter sand color
const rustShadow = '#292522';      // Dark shadow color for text

interface FilterOption {
  id: string;
  label: string;
  type: string;
  icon: string;
  color: string;
  selected: boolean;
}

interface FoodFilterProps {
  onFilterChange: (selectedFilters: string[]) => void;
  initialSelectedFilters?: string[];
  onClose?: () => void;
}

const FoodFilter: React.FC<FoodFilterProps> = ({ 
  onFilterChange,
  initialSelectedFilters = [],
  onClose
}) => {
  const [filterOptions, setFilterOptions] = useState<FilterOption[]>([
    {
      id: '0',
      label: 'All',
      type: 'all',
      icon: 'restaurant-menu',
      color: rustEmber,
      selected: initialSelectedFilters.length === 0
    },
    {
      id: '1',
      label: 'Spicy',
      type: 'spicy',
      icon: 'fire',
      color: rustEmber,
      selected: initialSelectedFilters.includes('spicy')
    },
    {
      id: '2',
      label: 'Vegan',
      type: 'vegan',
      icon: 'leaf',
      color: rustEmber,
      selected: initialSelectedFilters.includes('vegan')
    },
    {
      id: '3',
      label: 'Dessert',
      type: 'dessert',
      icon: 'ice-cream',
      color: rustEmber,
      selected: initialSelectedFilters.includes('dessert')
    },
    {
      id: '4',
      label: 'Healthy',
      type: 'healthy',
      icon: 'heartbeat',
      color: rustEmber,
      selected: initialSelectedFilters.includes('healthy')
    },
    {
      id: '5',
      label: 'Breakfast',
      type: 'breakfast',
      icon: 'coffee',
      color: rustEmber,
      selected: initialSelectedFilters.includes('breakfast')
    },
    {
      id: '6',
      label: 'Lunch',
      type: 'lunch',
      icon: 'hamburger',
      color: rustEmber,
      selected: initialSelectedFilters.includes('lunch')
    },
    {
      id: '7',
      label: 'Dinner',
      type: 'dinner',
      icon: 'utensils',
      color: rustEmber,
      selected: initialSelectedFilters.includes('dinner')
    },
    {
      id: '8',
      label: 'Comfort',
      type: 'comfort',
      icon: 'home',
      color: rustEmber,
      selected: initialSelectedFilters.includes('comfort')
    },
    {
      id: '9',
      label: 'Seafood',
      type: 'seafood',
      icon: 'fish',
      color: rustEmber,
      selected: initialSelectedFilters.includes('seafood')
    },
    {
      id: '10',
      label: 'Fast Food',
      type: 'fast-food',
      icon: 'hamburger',
      color: rustEmber,
      selected: initialSelectedFilters.includes('fast-food')
    }
  ]);

  // Update filter options when initialSelectedFilters changes
  useEffect(() => {
    if (initialSelectedFilters.length > 0) {
      const updatedOptions = [...filterOptions];
      updatedOptions[0].selected = false; // Deselect "All"
      
      // Since we only allow one filter at a time, find the first matching filter
      const selectedFilter = initialSelectedFilters[0];
      
      // Update selected state based on initialSelectedFilters - only one can be selected
      updatedOptions.forEach((option, index) => {
        if (index > 0) { // Skip "All" option
          option.selected = option.type === selectedFilter;
        }
      });
      
      setFilterOptions(updatedOptions);
    }
  }, [initialSelectedFilters]);

  // Scale animation value for each filter
  const scaleAnimations = filterOptions.map(() => new Animated.Value(1));

  const toggleFilter = useCallback((index: number) => {
    try {
      // Create a copy of filter options to work with
      const updatedOptions = [...filterOptions];
      
      // Deselect all options first (radio button style - only one can be selected)
      updatedOptions.forEach(option => {
        option.selected = false;
      });
      
      // Handle special "All" case - index 0
      if (index === 0) {
        // Select only "All"
        updatedOptions[0].selected = true;
      } else {
        // If the option was already selected and clicked again, select "All" instead
        if (filterOptions[index].selected) {
          updatedOptions[0].selected = true;
        } else {
          // Otherwise select just this option
          updatedOptions[index].selected = true;
        }
      }
      
      // Update state with new options
      setFilterOptions(updatedOptions);
      
      // Notify parent component of the selected filter
      let selectedFilter: string[] = [];
      
      // If anything other than "All" is selected, add it to the array
      updatedOptions.forEach((option, i) => {
        if (i > 0 && option.selected) {
          selectedFilter = [option.type];
        }
      });
      
      // Send the selected filter (empty array for "All")
      onFilterChange(selectedFilter);
      
      // Animate the button after state update
      Animated.sequence([
        Animated.timing(scaleAnimations[index], {
          toValue: 1.2,
          duration: 100,
          useNativeDriver: true
        }),
        Animated.timing(scaleAnimations[index], {
          toValue: 1,
          duration: 100,
          useNativeDriver: true
        })
      ]).start();
    } catch (error) {
      console.error("Error toggling filter:", error);
    }
  }, [filterOptions, scaleAnimations]);

  const getIconComponent = (iconName: string, color: string, index: number) => {
    // Different icon sets based on icon name
    if (['fire', 'leaf', 'coffee', 'hamburger', 'utensils', 'home', 'fish'].includes(iconName)) {
      return <FontAwesome5 name={iconName} size={20} color={color} />;
    } else if (iconName === 'ice-cream') {
      return <Ionicons name="ice-cream" size={20} color={color} />;
    } else if (iconName === 'heartbeat') {
      return <FontAwesome5 name="heartbeat" size={20} color={color} />;
    } else if (iconName === 'restaurant-menu') {
      return <MaterialIcons name="restaurant-menu" size={20} color={color} />;
    } else if (iconName === 'grid') {
      return <Entypo name="grid" size={20} color={color} />;
    }
    
    // Default icon
    return <MaterialIcons name="fastfood" size={20} color={color} />;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What are you craving?</Text>
      <ScrollView 
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {filterOptions.map((option, index) => (
          <TouchableOpacity 
            key={option.id}
            onPress={() => toggleFilter(index)}
            activeOpacity={0.7}
          >
            <Animated.View 
              style={[
                styles.filterButton,
                {
                  backgroundColor: option.selected ? rustEmber : rustCharcoal,
                  transform: [{ scale: scaleAnimations[index] }]
                }
              ]}
            >
              {getIconComponent(option.icon, 'white', index)}
            </Animated.View>
            <Text style={[
              styles.filterLabel,
              {color: option.selected ? rustEmber : rustBark}
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: rustShadow,
    textAlign: 'center',
  },
  scrollContent: {
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  filterButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
    shadowColor: rustShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  filterLabel: {
    fontSize: 12,
    marginTop: 5,
    fontWeight: '500',
    textAlign: 'center',
  }
});

export default FoodFilter; 