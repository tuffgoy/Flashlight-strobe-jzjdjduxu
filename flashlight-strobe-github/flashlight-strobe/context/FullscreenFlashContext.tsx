/**
 * FullscreenFlashContext
 *
 * Provides an Animated.Value that controls a full-screen white flash overlay
 * rendered at the root layout level (above the tab bar / nav bar).
 *
 * The strobe screen sets the value directly via setValue(0|1) so there is
 * zero React render overhead during strobing — the animation runs entirely
 * on the native thread.
 *
 * isFullscreenActive controls whether the Modal in _layout.tsx is mounted.
 * It must be set to true before strobing starts in fullscreen mode, and false
 * when strobing stops.  Keeping the Modal unmounted when not needed prevents
 * the startup crash caused by a permanently-mounted transparent Modal.
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
  /** True only while the strobe is running in fullscreen screen-flash mode. */
  isFullscreenActive: boolean;
  /** Call with true to mount the overlay Modal; false to unmount it. */
  setFullscreenActive: (active: boolean) => void;
}

const FullscreenFlashContext = createContext<FullscreenFlashContextType | null>(null);

export function FullscreenFlashProvider({ children }: { children: React.ReactNode }) {
  const flashAnim = useRef(new Animated.Value(0)).current;
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);

  const setFullscreenActive = useCallback(
    (active: boolean) => {
      setIsFullscreenActive(active);
      if (!active) flashAnim.setValue(0);
    },
    [flashAnim],
  );

  return (
    <FullscreenFlashContext.Provider
      value={{ flashAnim, isFullscreenActive, setFullscreenActive }}
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
