/**
 * Sound Sync screen
 *
 * Uses the device microphone to detect loud beats/claps and triggers a
 * single torch + screen flash on each detected peak.  Adjustable threshold
 * lets the user dial in sensitivity for different environments.
 *
 * Vibration ("click sound") provides tactile feedback on each triggered flash.
 */

import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import * as KeepAwake from "expo-keep-awake";
import { useCameraPermissions } from "expo-camera";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TorchCamera, TorchCameraHandle } from "@/components/TorchCamera";
import { useLanguage } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

// Beat hold-off after a detected beat (ms) — prevents re-triggering on echo
const HOLD_OFF_MS = 150;
// Flash duration for each beat (ms)
const FLASH_MS = 80;

export default function SoundScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [permission, requestPermission] = useCameraPermissions();
  const [micGranted, setMicGranted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [threshold, setThreshold] = useState(65); // 0–100 "loudness" scale
  const [clickEnabled, setClickEnabled] = useState(true);
  const [lastBeatTime, setLastBeatTime] = useState<number | null>(null);
  const [beatCount, setBeatCount] = useState(0);

  const torchRef = useRef<TorchCameraHandle>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdOffRef = useRef(false);

  // Request camera permission on mount
  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain !== false) {
      requestPermission().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestMicPermission = useCallback(async () => {
    try {
      const result = await Audio.requestPermissionsAsync();
      setMicGranted(result.granted);
      return result.granted;
    } catch {
      return false;
    }
  }, []);

  const triggerFlash = useCallback(() => {
    if (holdOffRef.current) return;
    holdOffRef.current = true;

    // Torch
    torchRef.current?.setTorch(true);
    if (Platform.OS === "web") flashAnim.setValue(1);

    if (clickEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    setBeatCount((prev) => prev + 1);
    setLastBeatTime(Date.now());

    setTimeout(() => {
      torchRef.current?.setTorch(false);
      if (Platform.OS === "web") flashAnim.setValue(0);
      // Release hold-off slightly after flash ends
      setTimeout(() => { holdOffRef.current = false; }, HOLD_OFF_MS);
    }, FLASH_MS);
  }, [clickEnabled, flashAnim]);

  // Convert our 0–100 "sensitivity" scale to a dB threshold.
  // Higher sensitivity (larger number) → trigger on quieter sounds.
  // dB range: -160 (silence) to 0 (maximum).
  // sensitivity=0  → trigger only at -10 dB (very loud)
  // sensitivity=100 → trigger at -60 dB (quiet ambient)
  function sensitivityToDb(s: number): number {
    // Linear map: s=0 → -10, s=100 → -60
    return -10 - (s / 100) * 50;
  }

  const startListening = useCallback(async () => {
    let granted = micGranted;
    if (!granted) {
      granted = await requestMicPermission();
    }
    if (!granted) return;

    // Activate wake lock AFTER we're sure we'll actually start
    await KeepAwake.activateKeepAwakeAsync().catch(() => {});

    let recordingStarted = false;
    const recording = new Audio.Recording();
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      await recording.prepareToRecordAsync({
        android: {
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        ios: {
          extension: ".caf",
          audioQuality: Audio.IOSAudioQuality.MIN,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 64000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        isMeteringEnabled: true,
        web: {},
      } as Audio.RecordingOptions);
      await recording.startAsync();
      recordingStarted = true;
      recordingRef.current = recording;
    } catch {
      // Setup failed — release wake lock and any partial recording
      KeepAwake.deactivateKeepAwake();
      if (!recordingStarted) {
        recording.stopAndUnloadAsync().catch(() => {});
      }
      return;
    }

    const dbThreshold = sensitivityToDb(threshold);
    let statusPending = false; // guard against overlapping getStatusAsync calls

    pollRef.current = setInterval(async () => {
      const rec = recordingRef.current;
      if (!rec || statusPending) return;
      statusPending = true;
      try {
        const status = await rec.getStatusAsync();
        if (status.isRecording && typeof status.metering === "number") {
          if (status.metering >= dbThreshold) {
            triggerFlash();
          }
        }
      } catch {
        // ignore transient errors
      } finally {
        statusPending = false;
      }
    }, 40); // poll at 25 Hz

    setIsListening(true);
  }, [micGranted, requestMicPermission, threshold, triggerFlash]);

  const stopListening = useCallback(async () => {
    setIsListening(false);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (rec) {
      try {
        await rec.stopAndUnloadAsync();
      } catch {
        // ignore
      }
    }
    torchRef.current?.setTorch(false);
    if (Platform.OS === "web") flashAnim.setValue(0);
    KeepAwake.deactivateKeepAwake();
  }, [flashAnim]);

  useEffect(() => {
    return () => {
      stopListening().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const styles = makeStyles(colors, insets);

  const adjustThreshold = (d: number) =>
    setThreshold((prev) => Math.max(0, Math.min(100, prev + d)));

  return (
    <View style={styles.root}>
      {Platform.OS === "web" && (
        <Animated.View
          pointerEvents="none"
          style={[styles.flashOverlay, { opacity: flashAnim }]}
        />
      )}

      <TorchCamera ref={torchRef} permissionGranted={permission?.granted ?? false} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>{t.sound}</Text>

        {/* Big toggle */}
        <Pressable
          style={[styles.bigToggle, isListening && styles.bigToggleActive]}
          onPress={isListening ? stopListening : startListening}
        >
          <Text style={styles.bigToggleIcon}>{isListening ? "🎙️" : "🎤"}</Text>
          <Text style={[styles.bigToggleLabel, isListening && styles.bigToggleLabelActive]}>
            {isListening ? t.on : t.off}
          </Text>
        </Pressable>

        {/* Status */}
        {isListening && (
          <View style={styles.statusCard}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{t.waitingForBeat}</Text>
            {lastBeatTime && (
              <Text style={styles.beatCount}>{beatCount}</Text>
            )}
          </View>
        )}

        {/* Sensitivity */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.sensitivity}</Text>
          <Text style={styles.bigVal}>{threshold}</Text>

          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${threshold}%` as any }]} />
          </View>

          <View style={styles.adjRow}>
            {[-20, -10, -5].map((d) => (
              <Pressable key={d} style={styles.adjBtn} onPress={() => adjustThreshold(d)}>
                <Text style={styles.adjBtnText}>{d}</Text>
              </Pressable>
            ))}
            <View style={{ flex: 1 }} />
            {[5, 10, 20].map((d) => (
              <Pressable key={d} style={styles.adjBtn} onPress={() => adjustThreshold(d)}>
                <Text style={styles.adjBtnText}>+{d}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.hintText}>
            {threshold < 30
              ? "Low — only very loud sounds trigger"
              : threshold < 60
              ? "Medium — normal beats and claps"
              : "High — triggers on quiet sounds too"}
          </Text>
        </View>

        {/* Click / vibrate toggle */}
        <Pressable
          style={[styles.card, styles.toggleRow]}
          onPress={() => setClickEnabled((prev) => !prev)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{t.clickSound}</Text>
            <Text style={styles.hintText}>{t.clickSoundSub}</Text>
          </View>
          <View style={[styles.toggle, clickEnabled && styles.toggleOn]}>
            <View style={[styles.toggleKnob, clickEnabled && styles.toggleKnobOn]} />
          </View>
        </Pressable>

        {/* Mic info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.micSync}</Text>
          <Text style={styles.hintText}>{t.micSyncSub}</Text>
        </View>

        {/* Permission buttons */}
        {Platform.OS !== "web" && !permission?.granted && (
          <Pressable style={styles.permBtn} onPress={() => requestPermission()}>
            <Text style={styles.permBtnText}>{t.grantPermission}</Text>
          </Pressable>
        )}
        {!micGranted && (
          <Pressable style={styles.permBtn} onPress={requestMicPermission}>
            <Text style={styles.permBtnText}>{t.micPermission}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>,
  insets: ReturnType<typeof useSafeAreaInsets>
) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    flashOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "#ffffff",
      zIndex: 10,
    },
    scroll: {
      paddingHorizontal: 16,
      paddingTop: insets.top + 16,
      paddingBottom: insets.bottom + 100,
      alignItems: "center",
      gap: 16,
    },
    sectionTitle: {
      fontSize: 10,
      fontFamily: "Inter_700Bold",
      color: colors.mutedForeground,
      letterSpacing: 3,
      alignSelf: "flex-start",
    },
    bigToggle: {
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      marginVertical: 8,
    },
    bigToggleActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    bigToggleIcon: { fontSize: 40 },
    bigToggleLabel: {
      fontSize: 14,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      letterSpacing: 2,
    },
    bigToggleLabelActive: { color: colors.primaryForeground },
    statusCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      width: "100%",
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: "#22c55e",
    },
    statusText: {
      flex: 1,
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    beatCount: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
    },
    card: {
      width: "100%",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 10,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    cardTitle: {
      fontSize: 10,
      fontFamily: "Inter_700Bold",
      color: colors.mutedForeground,
      letterSpacing: 2,
    },
    bigVal: {
      fontSize: 36,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    hintText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    sliderTrack: {
      width: "100%",
      height: 4,
      backgroundColor: colors.muted,
      borderRadius: 2,
      overflow: "hidden",
    },
    sliderFill: {
      height: "100%",
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    adjRow: { flexDirection: "row", gap: 6 },
    adjBtn: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: colors.muted,
      borderRadius: colors.radius - 2,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 40,
      alignItems: "center",
    },
    adjBtnText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    toggle: {
      width: 48,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "center",
      paddingHorizontal: 2,
    },
    toggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    toggleKnob: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.mutedForeground,
    },
    toggleKnobOn: { alignSelf: "flex-end", backgroundColor: colors.primaryForeground },
    permBtn: {
      width: "100%",
      paddingVertical: 14,
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      alignItems: "center",
    },
    permBtnText: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.primaryForeground,
    },
  });
}
