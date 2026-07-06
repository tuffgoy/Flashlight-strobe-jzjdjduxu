/**
 * TorchCamera — controls the device torch without showing any camera preview.
 *
 * The CameraView MUST have a non-zero size (≥ 1×1) and be laid out in the
 * view hierarchy for Android to initialise the camera sensor and activate
 * the torch LED.  We place it 9 999 px above the visible area so it is
 * completely hidden while still being "real" to the hardware.
 *
 * Permission is owned by the parent (single source of truth) and passed
 * as a prop so we never have two concurrent useCameraPermissions() hooks.
 *
 * `enabled` prop: pass false when the current flash mode does not require
 * the torch (e.g. screen-only mode).  This prevents the camera sensor from
 * activating unnecessarily, avoiding the camera-in-use indicator in the
 * Android notification bar when torch is not needed.
 *
 * Torch fix: use useReducer with a sequence counter instead of useState.
 * The counter ensures each dispatch produces a new state object, which
 * forces a re-render even when the boolean value hasn't changed — defeating
 * React 18 automatic batching and React Compiler auto-memoization that
 * were causing rapid toggle calls to be coalesced (torch stuck on).
 */

import { CameraView } from "expo-camera";
import React, { useImperativeHandle, useReducer } from "react";
import { Platform, StyleSheet } from "react-native";

export interface TorchCameraHandle {
  setTorch: (on: boolean) => void;
}

interface TorchCameraProps {
  permissionGranted: boolean;
  /** Set to false to prevent camera activation when torch is not needed. Defaults to true. */
  enabled?: boolean;
}

type TorchState = { on: boolean; seq: number };

function torchReducer(prev: TorchState, on: boolean): TorchState {
  return { on, seq: prev.seq + 1 };
}

export const TorchCamera = React.forwardRef<TorchCameraHandle, TorchCameraProps>(
  function TorchCamera({ permissionGranted, enabled = true }, ref) {
    "use no memo";
    const [{ on: torchOn }, dispatch] = useReducer(torchReducer, { on: false, seq: 0 });

    useImperativeHandle(
      ref,
      () => ({ setTorch: (on: boolean) => dispatch(on) }),
      [],
    );

    // Web has no hardware torch — parent handles screen-flash overlay.
    // Only render when permission is granted AND torch is actually needed.
    if (Platform.OS === "web" || !permissionGranted || !enabled) return null;

    return (
      <CameraView
        style={styles.offScreen}
        enableTorch={torchOn}
        facing="back"
      />
    );
  }
);

const styles = StyleSheet.create({
  offScreen: {
    position: "absolute",
    width: 1,
    height: 1,
    top: -9999,   // well above the viewport — hardware still initialises
    left: 0,
    opacity: 0,
  },
});
