"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface HeaderAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

interface HeaderConfig {
  title: string;
  description?: string;
  date?: string | Date;
  onDateChange?: (date: Date) => void;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  primaryAction?: HeaderAction;
  secondaryAction?: HeaderAction;
  children?: React.ReactNode;
}

interface HeaderContextType {
  config: HeaderConfig;
  setHeaderConfig: (config: HeaderConfig) => void;
  resetHeaderConfig: () => void;
}

const defaultHeaderConfig: HeaderConfig = {
  title: "Dashboard",
};

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<HeaderConfig>(defaultHeaderConfig);

  const setHeaderConfig = useCallback((newConfig: HeaderConfig) => {
    setConfig(newConfig);
  }, []);

  const resetHeaderConfig = useCallback(() => {
    setConfig(defaultHeaderConfig);
  }, []);

  return (
    <HeaderContext.Provider
      value={{ config, setHeaderConfig, resetHeaderConfig }}
    >
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error("useHeader must be used within a HeaderProvider");
  }
  return context;
}
