/**
 * TorchCamera
 *
 * An invisible CameraView (0×0) that controls the device torch via an
 * imperative ref. Only this tiny component re-renders on each torch toggle —
 * the parent StrobeScreen / PatternsScreen never re-renders for that reason.
 *
 * Why a hidden 0×0 camera view instead of showing the preview?
 * expo-camera is the only first-party way to control the hardware torch in
 * Expo without writing native code. By sizing it to 0×0 we get torch access
 * without any visible camera preview, exactly like native-only flashlight apps.
 */

import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useImperativeHandle, useState } from "react";
import { Platform, StyleSheet } from "react-native";

export interface TorchCameraHandle {
  setTorch: (on: boolean) => void;
}

export const TorchCamera = React.forwardRef<TorchCameraHandle>(
  function TorchCamera(_, ref) {
    const [permission] = useCameraPermissions();
    const [torchOn, setTorchOn] = useState(false);

    useImperativeHandle(ref, () => ({
      setTorch: setTorchOn,
    }));

    // Web has no hardware torch — parent renders a screen flash overlay instead.
    if (Platform.OS === "web" || !permission?.granted) return null;

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
