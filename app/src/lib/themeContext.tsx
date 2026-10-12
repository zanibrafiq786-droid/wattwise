import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Colors, PALETTES, ThemeMode } from "./theme";

const THEME_STORAGE_KEY = "wattwise:theme-mode";

interface ThemeContextValue {
  mode: ThemeMode;
  colors: Colors;
  toggleTheme: () => void;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("espresso");

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === "espresso" || saved === "cream") setModeState(saved);
    });
  }, []);

  function setMode(m: ThemeMode) {
    setModeState(m);
    AsyncStorage.setItem(THEME_STORAGE_KEY, m).catch(() => {});
  }

  function toggleTheme() {
    setMode(mode === "espresso" ? "cream" : "espresso");
  }

  return (
    <ThemeContext.Provider value={{ mode, colors: PALETTES[mode], toggleTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useColors(): Colors {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useColors must be used inside ThemeProvider");
  return ctx.colors;
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeMode must be used inside ThemeProvider");
  return ctx;
}
