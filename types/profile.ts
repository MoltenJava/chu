export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  preferences: {
    spiceTolerance: number;
    sweetSavory: number;
    adventurousness: number;
    healthPreference: number;
    dietaryRestrictions: string[];
  };
  onboarding_completed: boolean;
  birthdate: string;
};

export type ProfileFormData = {
  name: string;
  birthdate: string;
  preferences: {
    spiceTolerance: number;
    sweetSavory: number;
    adventurousness: number;
    healthPreference: number;
    dietaryRestrictions: string[];
  };
}; 