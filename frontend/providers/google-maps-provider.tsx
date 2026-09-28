"use client";

import React, { createContext, useContext } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

const LIBRARIES: ("places")[] = ["places"];

const GoogleMapsContext = createContext<{ isLoaded: boolean; error: string | null }>({ isLoaded: false, error: null });

export function GoogleMapsProvider({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) return <GoogleMapsContext.Provider value={{ isLoaded: false, error: "Location search is not configured. Enter an address manually or ask your administrator to enable Google Maps." }}>{children}</GoogleMapsContext.Provider>;
  return <LoadedGoogleMapsProvider>{children}</LoadedGoogleMapsProvider>;
}
function LoadedGoogleMapsProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES
  });

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, error: loadError ? "Google Maps could not load. Check your connection and Maps configuration." : null }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

export const useGoogleMaps = () => useContext(GoogleMapsContext);
