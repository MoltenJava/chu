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
import { FilterOption, FoodType } from '../../types/food';

const { width } = Dimensions.get('window');

interface FoodFilterProps {
  onFilterChange: (selectedFilters: FoodType[]) => void;
  initialSelectedFilters?: FoodType[];
}

const FoodFilter: React.FC<FoodFilterProps> = ({ 
  onFilterChange,
  initialSelectedFilters = [] 
}) => {
  const [filterOptions, setFilterOptions] = useState<FilterOption[]>([
    {
      id: '0',
      label: 'All',
      type: 'all',
      icon: 'restaurant-menu',
      color: '#FF3B5C',
      selected: initialSelectedFilters.length === 0
    },
    {
      id: '1',
      label: 'Spicy',
      type: 'spicy',
      icon: 'fire',
      color: '#FF5252',
      selected: initialSelectedFilters.includes('spicy')
    },
    {
      id: '2',
      label: 'Vegan',
      type: 'vegan',
      icon: 'leaf',
      color: '#4CAF50',
      selected: initialSelectedFilters.includes('vegan')
    },
    {
      id: '3',
      label: 'Dessert',
      type: 'dessert',
      icon: 'ice-cream',
      color: '#FF80AB',
      selected: initialSelectedFilters.includes('dessert')
    },
    {
      id: '4',
      label: 'Healthy',
      type: 'healthy',
      icon: 'heartbeat',
      color: '#2196F3',
      selected: initialSelectedFilters.includes('healthy')
    },
    {
      id: '5',
      label: 'Breakfast',
      type: 'breakfast',
      icon: 'coffee',
      color: '#FFA000',
      selected: initialSelectedFilters.includes('breakfast')
    },
    {
      id: '6',
      label: 'Lunch',
      type: 'lunch',
      icon: 'hamburger',
      color: '#795548',
      selected: initialSelectedFilters.includes('lunch')
    },
    {
      id: '7',
      label: 'Dinner',
      type: 'dinner',
      icon: 'utensils',
      color: '#607D8B',
      selected: initialSelectedFilters.includes('dinner')
    },
    {
      id: '8',
      label: 'Comfort',
      type: 'comfort',
      icon: 'home',
      color: '#9C27B0',
      selected: initialSelectedFilters.includes('comfort')
    },
    {
      id: '9',
      label: 'Seafood',
      type: 'seafood',
      icon: 'fish',
      color: '#00BCD4',
      selected: initialSelectedFilters.includes('seafood')
    },
    {
      id: '10',
      label: 'Fast Food',
      type: 'fast-food',
      icon: 'hamburger',
      color: '#F44336',
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
      let selectedFilter: FoodType[] = [];
      
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
                  backgroundColor: option.selected ? option.color : '#F0F0F0',
                  transform: [{ scale: scaleAnimations[index] }]
                }
              ]}
            >
              {getIconComponent(option.icon, option.selected ? '#FFFFFF' : option.color, index)}
            </Animated.View>
            <Text style={[
              styles.filterLabel,
              {color: option.selected ? option.color : '#555'}
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
    color: '#333',
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
    shadowColor: '#000',
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