import React, { createContext, useState, useContext, ReactNode, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import { CoupleSession } from '../types/couple'; // Assuming this is the correct path for CoupleSession type
import { useAuth } from '../hooks/useAuth'; // Import your existing useAuth hook

// Define the shape of the context data
interface CoupleContextType {
  user: User | null;
  coupleSession: CoupleSession | null;
  setCoupleSession: (session: CoupleSession | null) => void;
  isLoadingAuth: boolean; // Pass auth loading state through
}

// Create the context with a default value (usually null or undefined)
// We assert a default type temporarily, the Provider will supply the real value.
const CoupleContext = createContext<CoupleContextType>(null!);

// Create the Provider component
interface CoupleProviderProps {
  children: ReactNode;
}

export const CoupleProvider: React.FC<CoupleProviderProps> = ({ children }) => {
  const [coupleSession, setCoupleSession] = useState<CoupleSession | null>(null);
  const { user, loading: isLoadingAuth } = useAuth(); // Get user and loading state from your auth hook

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user,
    coupleSession,
    setCoupleSession,
    isLoadingAuth,
  }), [user, coupleSession, isLoadingAuth]);

  return (
    <CoupleContext.Provider value={value}>
      {children}
    </CoupleContext.Provider>
  );
};

// Create a custom hook for easier consumption
export const useCoupleContext = () => {
  const context = useContext(CoupleContext);
  if (context === undefined || context === null) { // Check for null as well
    throw new Error('useCoupleContext must be used within a CoupleProvider');
  }
  return context;
}; 