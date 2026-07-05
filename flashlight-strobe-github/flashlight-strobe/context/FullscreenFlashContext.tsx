/**
 * FullscreenFlashContext
 *
 * Provides an Animated.Value that controls a full-screen white flash overlay
 * rendered at the root layout level (above the tab bar / nav bar).
 *
 * The strobe screen sets this value directly via setValue(0|1) so there is
 * zero React render overhead during strobing — the animation runs entirely
 * on the native thread.
 */

import React, { createContext, useContext, useRef } from "react";
import { Animated } from "react-native";

interface FullscreenFlashContextType {
  flashAnim: Animated.Value;
}

const FullscreenFlashContext = createContext<FullscreenFlashContextType | null>(null);

export function FullscreenFlashProvider({ children }: { children: React.ReactNode }) {
  const flashAnim = useRef(new Animated.Value(0)).current;
  return (
    <FullscreenFlashContext.Provider value={{ flashAnim }}>
      {children}
    </FullscreenFlashContext.Provider>
  );
}

export function useFullscreenFlash(): FullscreenFlashContextType {
  const ctx = useContext(FullscreenFlashContext);
  if (!ctx) {
    throw new Error("useFullscreenFlash must be used within FullscreenFlashProvider");
  }
  return ctx;
}
