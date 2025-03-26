import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, SafeAreaView, Animated, Dimensions, Keyboard, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ProfileFormData } from '@/types/profile';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { PreferenceSlider } from '@/components/ui/PreferenceSlider';
import { OnboardingStepper } from '@/components/ui/OnboardingStepper';

const SCREEN_WIDTH = Dimensions.get('window').width;

const DIETARY_RESTRICTIONS = [
  { id: 'vegetarian', label: 'Vegetarian', icon: '🥬' },
  { id: 'vegan', label: 'Vegan', icon: '🌱' },
  { id: 'gluten-free', label: 'Gluten-Free', icon: '🌾' },
  { id: 'dairy-free', label: 'Dairy-Free', icon: '🥛' },
  { id: 'halal', label: 'Halal', icon: '🌙' },
  { id: 'kosher', label: 'Kosher', icon: '✡️' },
  { id: 'nut-free', label: 'Nut-Free', icon: '🥜' },
] as const;

export default function CreateProfile() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const slideAnim = useState(() => new Animated.Value(0))[0];
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    birthdate: '',
    preferences: {
      spiceTolerance: 50,
      sweetSavory: 50,
      adventurousness: 50,
      healthPreference: 50,
      dietaryRestrictions: [],
    },
  });

  const handleNext = () => {
    if (currentStep < 2) {
      Animated.timing(slideAnim, {
        toValue: -(currentStep + 1) * SCREEN_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentStep(currentStep + 1);
      });
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      Animated.timing(slideAnim, {
        toValue: -(currentStep - 1) * SCREEN_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentStep(currentStep - 1);
      });
    }
  };

  const handleSubmit = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Convert birthdate string to proper date format
      const [month, day, year] = formData.birthdate.split('/');
      const formattedBirthdate = `${year}-${month}-${day}`;

      const profileData = {
        id: user.id,
        name: formData.name,
        birthdate: formattedBirthdate,
        preferences: formData.preferences,
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      };

      console.log('Upserting profile with data:', profileData);

      const { data, error } = await supabase
        .from('profiles')
        .upsert(profileData)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Profile upserted successfully:', data);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    }
  };

  const toggleDietaryRestriction = (restriction: string) => {
    setFormData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        dietaryRestrictions: prev.preferences.dietaryRestrictions.includes(restriction)
          ? prev.preferences.dietaryRestrictions.filter(r => r !== restriction)
          : [...prev.preferences.dietaryRestrictions, restriction],
      },
    }));
  };

  const formatDate = (text: string) => {
    // Remove any non-numeric characters
    const numbers = text.replace(/\D/g, '');
    
    // Add slashes after month and day
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) return numbers.slice(0, 2) + '/' + numbers.slice(2);
    return numbers.slice(0, 2) + '/' + numbers.slice(2, 4) + '/' + numbers.slice(4, 8);
  };

  const handleBirthdateChange = (text: string) => {
    const formatted = formatDate(text);
    setFormData(prev => ({ ...prev, birthdate: formatted }));
    
    // Automatically dismiss keyboard when date is fully entered
    if (formatted.length === 10) {
      Keyboard.dismiss();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Image
          source={require('@/assets/images/logo white on red (full).png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <OnboardingStepper currentStep={currentStep} totalSteps={3} />

      <Animated.View 
        style={[
          styles.pagesContainer,
          { transform: [{ translateX: slideAnim }] }
        ]}
      >
        {/* Page 1: Basic Info */}
        <View style={styles.page}>
          <Text style={styles.title}>Let's get to know you</Text>
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                placeholder="Enter your name"
                placeholderTextColor="rgba(255,255,255,0.5)"
                selectionColor="white"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Birthdate</Text>
              <TextInput
                style={styles.input}
                value={formData.birthdate}
                onChangeText={handleBirthdateChange}
                placeholder="MM/DD/YYYY"
                placeholderTextColor="rgba(255,255,255,0.5)"
                keyboardType="number-pad"
                maxLength={10}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                selectionColor="white"
              />
            </View>
          </View>
        </View>

        {/* Page 2: Taste Preferences */}
        <View style={styles.page}>
          <Text style={styles.title}>Your taste preferences</Text>
          <View style={styles.formContainer}>
            <PreferenceSlider
              value={formData.preferences.spiceTolerance}
              onValueChange={(value) => setFormData(prev => ({
                ...prev,
                preferences: { ...prev.preferences, spiceTolerance: value }
              }))}
              leftLabel="Mild"
              rightLabel="Spicy"
              gradientColors={['#FED7D7', '#F56565']}
            />
            <PreferenceSlider
              value={formData.preferences.sweetSavory}
              onValueChange={(value) => setFormData(prev => ({
                ...prev,
                preferences: { ...prev.preferences, sweetSavory: value }
              }))}
              leftLabel="Sweet"
              rightLabel="Savory"
              gradientColors={['#FEEBC8', '#ED8936']}
            />
            <PreferenceSlider
              value={formData.preferences.adventurousness}
              onValueChange={(value) => setFormData(prev => ({
                ...prev,
                preferences: { ...prev.preferences, adventurousness: value }
              }))}
              leftLabel="Traditional"
              rightLabel="Adventurous"
              gradientColors={['#BEE3F8', '#4299E1']}
            />
            <PreferenceSlider
              value={formData.preferences.healthPreference}
              onValueChange={(value) => setFormData(prev => ({
                ...prev,
                preferences: { ...prev.preferences, healthPreference: value }
              }))}
              leftLabel="Indulgent"
              rightLabel="Healthy"
              gradientColors={['#FED7E2', '#38B2AC']}
            />
          </View>
        </View>

        {/* Page 3: Dietary Restrictions */}
        <View style={styles.page}>
          <Text style={styles.title}>Any dietary restrictions?</Text>
          <View style={styles.formContainer}>
            <View style={styles.dietaryGrid}>
              {DIETARY_RESTRICTIONS.map((restriction) => (
                <TouchableOpacity
                  key={restriction.id}
                  style={[
                    styles.dietaryButton,
                    formData.preferences.dietaryRestrictions.includes(restriction.id) && styles.dietaryButtonSelected,
                  ]}
                  onPress={() => toggleDietaryRestriction(restriction.id)}
                >
                  <Text style={styles.dietaryIcon}>{restriction.icon}</Text>
                  <Text style={[
                    styles.dietaryLabel,
                    formData.preferences.dietaryRestrictions.includes(restriction.id) && styles.dietaryLabelSelected
                  ]}>
                    {restriction.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Animated.View>

      <View style={styles.footer}>
        {currentStep > 0 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
          >
            <IconSymbol name="chevron.left" size={24} color="white" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>
            {currentStep === 2 ? 'Complete' : 'Next'}
          </Text>
          <IconSymbol 
            name="chevron.right" 
            size={24} 
            color="white" 
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#d9232a',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  logo: {
    width: 120,
    height: 48,
  },
  pagesContainer: {
    flex: 1,
    flexDirection: 'row',
    width: SCREEN_WIDTH * 3,
  },
  page: {
    width: SCREEN_WIDTH,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    marginBottom: 24,
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 16,
    padding: 24,
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    opacity: 0.9,
  },
  input: {
    height: 56,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    color: 'white',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  dietaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  dietaryButton: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  dietaryButtonSelected: {
    backgroundColor: 'white',
    borderColor: 'white',
  },
  dietaryIcon: {
    fontSize: 24,
  },
  dietaryLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
    opacity: 0.9,
  },
  dietaryLabelSelected: {
    color: '#d9232a',
    opacity: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  nextButton: {
    flex: 1,
    height: 56,
    backgroundColor: 'white',
    borderRadius: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  nextButtonText: {
    color: '#d9232a',
    fontSize: 18,
    fontWeight: '600',
  },
}); 