/**
 * TorchCamera
 *
 * An invisible CameraView (0×0) that controls the device torch.
 * Accepts `permissionGranted` as a prop so the parent is the single
 * source of truth for camera permission state — no dual hook instances.
 *
 * Use the imperative ref to toggle the torch without triggering a re-render
 * of the parent component tree. Only this tiny component re-renders.
 */

import { CameraView } from "expo-camera";
import React, { useImperativeHandle, useState } from "react";
import { Platform, StyleSheet } from "react-native";

export interface TorchCameraHandle {
  setTorch: (on: boolean) => void;
}

interface TorchCameraProps {
  /** Passed from parent's useCameraPermissions() — single source of truth. */
  permissionGranted: boolean;
}

export const TorchCamera = React.forwardRef<TorchCameraHandle, TorchCameraProps>(
  function TorchCamera({ permissionGranted }, ref) {
    const [torchOn, setTorchOn] = useState(false);

    useImperativeHandle(ref, () => ({
      setTorch: setTorchOn,
    }));

    // Web has no hardware torch — parent renders a screen flash overlay instead.
    // If permission not yet granted, mount nothing (torch will be a no-op).
    if (Platform.OS === "web" || !permissionGranted) return null;

    return (
      <CameraView style={styles.hidden} enableTorch={torchOn} facing="back" />
    );
  }
);

const styles = StyleSheet.create({
  hidden: {
    position: "absolute",
    width: 0,
    height: 0,
    opacity: 0,
  },
});
