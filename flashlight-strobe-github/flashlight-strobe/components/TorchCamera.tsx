/**
 * TorchCamera — controls the device rear LED torch via expo-camera.
 *
 * Uses CameraView's `enableTorch` prop from expo-camera (New Architecture
 * compatible, already a workspace dependency) instead of the unmaintained
 * react-native-torch@1.2.0 package which is old-arch only and caused:
 *
 *   [Reanimated] Reanimated requires new architecture to be enabled.
 *   [Worklets]   Worklets require new architecture to be enabled.
 *
 * IMPLEMENTATION NOTES
 * ─────────────────────
 * • CameraView is rendered at 1 × 1 px positioned just off-screen so the
 *   native camera session stays alive (required for torch control) without
 *   showing any camera viewfinder to the user.
 *
 * • The component is only mounted when `enabled` is true (i.e. flash mode
 *   includes the torch). Unmounting it clears the camera-in-use indicator
 *   (iOS green dot / Android privacy indicator) when the LED isn't needed.
 *
 * • enableTorch is driven by useState so React batches rapid strobe
 *   on/off calls into single native commits rather than bridging every tick.
 *
 * • On web (no native camera) the component returns null immediately.
 */

import { CameraView } from "expo-camera";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Platform, StyleSheet } from "react-native";

export interface TorchCameraHandle {
  setTorch: (on: boolean) => void;
}

interface TorchCameraProps {
  /**
   * Set to false when torch is not needed (screen-only flash mode).
   * The CameraView is unmounted entirely so no camera session is active.
   * Default: true.
   */
  enabled?: boolean;
  /** Kept for API compatibility with callers that pass permission state. */
  permissionGranted?: boolean;
}

export const TorchCamera = forwardRef<TorchCameraHandle, TorchCameraProps>(
  function TorchCamera({ enabled = true }, ref) {
    const [torchOn, setTorchOn] = useState(false);
    const enabledRef = useRef(enabled);
    enabledRef.current = enabled;

    useImperativeHandle(
      ref,
      () => ({
        setTorch: (on: boolean) => {
          if (Platform.OS === "web") return;
          // Honour enabled flag: torch is always off in screen-only mode.
          setTorchOn(on && enabledRef.current);
        },
      }),
      [],
    );

    // When enabled flips to false at runtime, cut the torch immediately.
    useEffect(() => {
      if (!enabled) setTorchOn(false);
    }, [enabled]);

    // Web has no native torch.
    if (Platform.OS === "web") return null;

    // Unmount when torch mode is inactive — clears the camera indicator.
    if (!enabled) return null;

    return (
      <CameraView
        style={styles.hidden}
        facing="back"
        enableTorch={torchOn}
      />
    );
  },
);

const styles = StyleSheet.create({
  hidden: {
    // 1 × 1 px just off-screen.  Non-zero dimensions keep the native camera
    // session alive (needed for torch control) without any visible preview.
    position: "absolute",
    width: 1,
    height: 1,
    top: -2,
    left: -2,
  },
});
