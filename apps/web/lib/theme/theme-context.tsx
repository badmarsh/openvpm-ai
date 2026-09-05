"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { THEME_PRESETS, type ThemePreset } from "./presets";
import { parseTweakcnCss, type ParsedThemeSet } from "./theme-parser";

type ThemeMode = "light" | "dark";

interface ThemeContextType {
  activeThemeId: string;
  mode: ThemeMode;
  presets: ThemePreset[];
  customThemeCss: string;
  setTheme: (id: string) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  importCustomCss: (css: string) => boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_THEME_KEY = "openvpm_gui_theme";
const STORAGE_MODE_KEY = "openvpm_gui_mode";
const STORAGE_CUSTOM_CSS_KEY = "openvpm_gui_custom_css";

export function GuiThemeProvider({ children }: { children: React.ReactNode }) {
  const [activeThemeId, setActiveThemeId] = useState<string>("supabase");
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [customThemeCss, setCustomThemeCss] = useState<string>("");
  const [parsedCustomTheme, setParsedCustomTheme] = useState<ParsedThemeSet | null>(null);

  // Load initial settings from localStorage on client mount
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
      const savedMode = localStorage.getItem(STORAGE_MODE_KEY) as ThemeMode | null;
      const savedCustom = localStorage.getItem(STORAGE_CUSTOM_CSS_KEY);

      if (savedTheme) {
        setActiveThemeId(savedTheme);
      }
      if (savedMode === "light" || savedMode === "dark") {
        setModeState(savedMode);
      }
      if (savedCustom) {
        setCustomThemeCss(savedCustom);
        setParsedCustomTheme(parseTweakcnCss(savedCustom));
      }
    } catch {
      // localStorage may be disabled
    }
  }, []);

  // Apply theme to document.documentElement whenever theme or mode changes
  useEffect(() => {
    const root = document.documentElement;

    // Toggle dark class
    if (mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Determine current variable set
    let vars: Record<string, string> = {};

    if (activeThemeId === "custom" && parsedCustomTheme) {
      vars = mode === "dark" ? parsedCustomTheme.dark : parsedCustomTheme.light;
      if (Object.keys(vars).length === 0) {
        vars = parsedCustomTheme.light;
      }
    } else {
      const preset = THEME_PRESETS.find((p) => p.id === activeThemeId) || THEME_PRESETS[0]!;
      vars = mode === "dark" ? preset.dark : preset.light;
    }

    // Apply each variable
    for (const [key, val] of Object.entries(vars)) {
      root.style.setProperty(key, val);
    }
  }, [activeThemeId, mode, parsedCustomTheme]);

  function setTheme(id: string) {
    setActiveThemeId(id);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, id);
    } catch {}
  }

  function setMode(newMode: ThemeMode) {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_MODE_KEY, newMode);
    } catch {}
  }

  function toggleMode() {
    setMode(mode === "dark" ? "light" : "dark");
  }

  function importCustomCss(css: string): boolean {
    try {
      const parsed = parseTweakcnCss(css);
      if (
        Object.keys(parsed.light).length === 0 &&
        Object.keys(parsed.dark).length === 0
      ) {
        return false;
      }
      setParsedCustomTheme(parsed);
      setCustomThemeCss(css);
      setActiveThemeId("custom");
      try {
        localStorage.setItem(STORAGE_THEME_KEY, "custom");
        localStorage.setItem(STORAGE_CUSTOM_CSS_KEY, css);
      } catch {}
      return true;
    } catch {
      return false;
    }
  }

  return (
    <ThemeContext.Provider
      value={{
        activeThemeId,
        mode,
        presets: THEME_PRESETS,
        customThemeCss,
        setTheme,
        setMode,
        toggleMode,
        importCustomCss,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useGuiTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useGuiTheme must be used within GuiThemeProvider");
  }
  return ctx;
}
