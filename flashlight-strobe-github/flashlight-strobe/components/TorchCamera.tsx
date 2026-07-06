/**
 * TorchCamera — controls the device torch LED.
 *
 * Uses react-native-torch which wraps Android's CameraManager.setTorchMode()
 * and iOS's AVCaptureDevice.torchMode directly.
 *
 * WHY NOT expo-camera's CameraView?
 *   CameraView creates a full camera session (even 1×1 offscreen).  On Android
 *   12+ any active camera session triggers the privacy indicator (orange dot in
 *   the status bar).  CameraManager.setTorchMode() is a hardware-level call
 *   that requires NO camera session and NO camera permission on Android, so the
 *   indicator never appears.
 *
 * This component is a pure-logic forwardRef with no rendered output — it
 * simply calls the native torch API imperatively via the ref handle.
 *
 * Props:
 *  - enabled: pass false to suppress all torch calls (e.g. screen-only mode).
 *    Defaults to true.
 *  - permissionGranted: kept for API compatibility; on Android it is ignored
 *    because CameraManager.setTorchMode() needs no camera permission.  On iOS,
 *    torch will fail gracefully if camera permission is not granted.
 */

// react-native-torch ships without bundled TS types; the module is imported
// via require so that TypeScript doesn't error on the missing declaration.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RNTorch = require("react-native-torch") as {
  default: { switchState: (on: boolean) => void };
};
const Torch = RNTorch.default ?? (RNTorch as unknown as { switchState: (on: boolean) => void });

import React, { useEffect, useImperativeHandle, useRef } from "react";
import { Platform } from "react-native";

export interface TorchCameraHandle {
  setTorch: (on: boolean) => void;
}

interface TorchCameraProps {
  /** Ignored on Android — CameraManager needs no camera permission. Kept for iOS compat. */
  permissionGranted?: boolean;
  /** Set to false when torch is not needed (screen-only mode). Default: true. */
  enabled?: boolean;
}

function safeTorch(on: boolean) {
  if (Platform.OS === "web") return;
  try {
    Torch.switchState(on);
  } catch {
    // Device has no flashlight or torch unavailable — silently ignore
  }
}

export const TorchCamera = React.forwardRef<TorchCameraHandle, TorchCameraProps>(
  function TorchCamera({ enabled = true }, ref) {
    "use no memo";

    const enabledRef = useRef(enabled);
    enabledRef.current = enabled;

    useImperativeHandle(
      ref,
      () => ({
        setTorch: (on: boolean) => {
          // When disabled (screen-only mode), ensure torch is always off.
          safeTorch(on && enabledRef.current);
        },
      }),
      [],
    );

    // When `enabled` flips to false at runtime, immediately cut the torch.
    useEffect(() => {
      if (!enabled) safeTorch(false);
    }, [enabled]);

    // Always turn off torch on unmount.
    useEffect(() => {
      return () => { safeTorch(false); };
    }, []);

    // No rendered output — this is a pure imperative controller.
    return null;
  },
);
