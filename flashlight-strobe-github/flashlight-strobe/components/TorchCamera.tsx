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
 */

import { CameraView } from "expo-camera";
import React, { useImperativeHandle, useState } from "react";
import { Platform, StyleSheet } from "react-native";

export interface TorchCameraHandle {
  setTorch: (on: boolean) => void;
}

interface TorchCameraProps {
  permissionGranted: boolean;
}

export const TorchCamera = React.forwardRef<TorchCameraHandle, TorchCameraProps>(
  function TorchCamera({ permissionGranted }, ref) {
    const [torchOn, setTorchOn] = useState(false);

    useImperativeHandle(ref, () => ({ setTorch: setTorchOn }));

    // Web has no hardware torch — parent handles screen-flash overlay.
    // Only render when permission is granted so CameraView never shows an
    // uninitialised camera frame to the user.
    if (Platform.OS === "web" || !permissionGranted) return null;

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
