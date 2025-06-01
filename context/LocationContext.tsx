import React, { createContext, useContext, ReactNode } from 'react';
import { Coordinates } from '../utils/locationService'; // Assuming Coordinates is exported from locationService

export interface LocationContextValue {
  actualUserLocation: Coordinates | null; // The true location from GPS
  currentUserLocationForApp: Coordinates | null; // Location to be used by the app (either actual or simulated)
  simulatedLocationActive: boolean; // True if the app is using a simulated location
}

const LocationContext = createContext<LocationContextValue | undefined>(
  undefined
);

interface LocationProviderProps {
  children: ReactNode;
  actualUserLocation: Coordinates | null;
  currentUserLocationForApp: Coordinates | null;
  simulatedLocationActive: boolean;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ 
  children,
  actualUserLocation,
  currentUserLocationForApp,
  simulatedLocationActive 
}) => {
  return (
    <LocationContext.Provider 
      value={{
        actualUserLocation,
        currentUserLocationForApp,
        simulatedLocationActive
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocationContext = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
}; 