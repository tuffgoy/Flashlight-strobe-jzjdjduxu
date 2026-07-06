/**
 * FullscreenFlashContext
 *
 * Provides the shared state for the full-screen flash overlay rendered at root
 * layout level (above the tab bar / nav bar).
 *
 * - flashAnim: Animated.Value (0=off, 1=on) — set directly via setValue so
 *   there is zero React render overhead during strobing.
 * - isFullscreenActive: boolean — true only while actively strobing in fullscreen
 *   mode.  The Modal in _layout.tsx only mounts when this is true to prevent
 *   the startup crash caused by a permanently-mounted transparent Modal.
 * - flashColor: the current screen flash color (hex string), shared between
 *   the safearea overlay (index.tsx) and the fullscreen Modal (_layout.tsx).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Animated } from "react-native";

interface FullscreenFlashContextType {
  flashAnim: Animated.Value;
  isFullscreenActive: boolean;
  setFullscreenActive: (active: boolean) => void;
  /** Current screen flash color, hex string. Default: "#ffffff" */
  flashColor: string;
  setFlashColor: (color: string) => void;
}

const FullscreenFlashContext = createContext<FullscreenFlashContextType | null>(null);

export function FullscreenFlashProvider({ children }: { children: React.ReactNode }) {
  const flashAnim = useRef(new Animated.Value(0)).current;
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);
  const [flashColor, setFlashColor] = useState("#ffffff");

  const setFullscreenActive = useCallback(
    (active: boolean) => {
      setIsFullscreenActive(active);
      if (!active) flashAnim.setValue(0);
    },
    [flashAnim],
  );

  return (
    <FullscreenFlashContext.Provider
      value={{ flashAnim, isFullscreenActive, setFullscreenActive, flashColor, setFlashColor }}
    >
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
