/**
 * Patterns screen — predefined strobe sequences (SOS, Police, Heartbeat, etc.)
 *
 * Performance: TorchCamera forwardRef component with permissionGranted prop
 * (single source of truth). Only TorchCamera re-renders on each torch step.
 */

import { useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
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
import { useColors } from "@/hooks/useColors";

interface Pattern {
  id: string;
  name: string;
  description: string;
  sequence: Array<{ on: boolean; ms: number }>;
  color: string;
}

const PATTERNS: Pattern[] = [
  {
    id: "sos",
    name: "SOS",
    description: "International distress signal · · · — — — · · ·",
    color: "#ef4444",
    sequence: [
      { on: true, ms: 150 }, { on: false, ms: 100 },
      { on: true, ms: 150 }, { on: false, ms: 100 },
      { on: true, ms: 150 }, { on: false, ms: 300 },
      { on: true, ms: 400 }, { on: false, ms: 100 },
      { on: true, ms: 400 }, { on: false, ms: 100 },
      { on: true, ms: 400 }, { on: false, ms: 300 },
      { on: true, ms: 150 }, { on: false, ms: 100 },
      { on: true, ms: 150 }, { on: false, ms: 100 },
      { on: true, ms: 150 }, { on: false, ms: 800 },
    ],
  },
  {
    id: "police",
    name: "Police",
    description: "Emergency rapid alternating flash",
    color: "#3b82f6",
    sequence: [
      { on: true, ms: 60 }, { on: false, ms: 60 },
      { on: true, ms: 60 }, { on: false, ms: 60 },
      { on: true, ms: 60 }, { on: false, ms: 200 },
      { on: true, ms: 60 }, { on: false, ms: 60 },
      { on: true, ms: 60 }, { on: false, ms: 60 },
      { on: true, ms: 60 }, { on: false, ms: 400 },
    ],
  },
  {
    id: "heartbeat",
    name: "Heartbeat",
    description: "Double pulse rhythm, like a heartbeat",
    color: "#ec4899",
    sequence: [
      { on: true, ms: 80 }, { on: false, ms: 80 },
      { on: true, ms: 80 }, { on: false, ms: 700 },
    ],
  },
  {
    id: "party",
    name: "Party",
    description: "Rapid random burst for strobe effect",
    color: "#a855f7",
    sequence: [
      { on: true, ms: 40 }, { on: false, ms: 40 },
      { on: true, ms: 80 }, { on: false, ms: 60 },
      { on: true, ms: 40 }, { on: false, ms: 120 },
      { on: true, ms: 60 }, { on: false, ms: 40 },
      { on: true, ms: 40 }, { on: false, ms: 80 },
    ],
  },
  {
    id: "morse_help",
    name: "HELP",
    description: "Morse code for H-E-L-P",
    color: "#f59e0b",
    sequence: [
      // H: ....
      { on: true, ms: 120 }, { on: false, ms: 100 },
      { on: true, ms: 120 }, { on: false, ms: 100 },
      { on: true, ms: 120 }, { on: false, ms: 100 },
      { on: true, ms: 120 }, { on: false, ms: 300 },
      // E: .
      { on: true, ms: 120 }, { on: false, ms: 300 },
      // L: .-..
      { on: true, ms: 120 }, { on: false, ms: 100 },
      { on: true, ms: 360 }, { on: false, ms: 100 },
      { on: true, ms: 120 }, { on: false, ms: 100 },
      { on: true, ms: 120 }, { on: false, ms: 300 },
      // P: .--.
      { on: true, ms: 120 }, { on: false, ms: 100 },
      { on: true, ms: 360 }, { on: false, ms: 100 },
      { on: true, ms: 360 }, { on: false, ms: 100 },
      { on: true, ms: 120 }, { on: false, ms: 800 },
    ],
  },
  {
    id: "slow_wave",
    name: "Slow Wave",
    description: "Gentle 1Hz rhythmic flash",
    color: "#22c55e",
    sequence: [
      { on: true, ms: 300 }, { on: false, ms: 700 },
    ],
  },
  {
    id: "rapid_fire",
    name: "Rapid Fire",
    description: "High-speed continuous burst at ~25Hz",
    color: "#f97316",
    sequence: [
      { on: true, ms: 20 }, { on: false, ms: 20 },
    ],
  },
  {
    id: "club_strobe",
    name: "Club Strobe",
    description: "Classic club strobe at ~10Hz",
    color: "#8b5cf6",
    sequence: [
      { on: true, ms: 50 }, { on: false, ms: 50 },
    ],
  },
];

export default function PatternsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // Single source of truth for permission — passed as prop to TorchCamera
  const [permission, requestPermission] = useCameraPermissions();
  const [activeId, setActiveId] = useState<string | null>(null);

  const torchRef = useRef<TorchCameraHandle>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Request permission on mount (non-blocking)
  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain !== false) {
      requestPermission().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const runSequence = useCallback(
    (pattern: Pattern, idx: number) => {
      const step = pattern.sequence[idx];

      // Only TorchCamera re-renders — PatternsScreen does not
      torchRef.current?.setTorch(step.on);

      if (Platform.OS === "web") {
        Animated.timing(flashAnim, {
          toValue: step.on ? 1 : 0,
          duration: 8,
          useNativeDriver: true,
        }).start();
      }

      timeoutRef.current = setTimeout(() => {
        const nextIdx = (idx + 1) % pattern.sequence.length;
        runSequence(pattern, nextIdx);
      }, step.ms);
    },
    [flashAnim]
  );

  const handleSelect = async (pattern: Pattern) => {
    if (activeId === pattern.id) {
      clearTimer();
      setActiveId(null);
      torchRef.current?.setTorch(false);
      flashAnim.setValue(0);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }

    if (!permission?.granted && Platform.OS !== "web") {
      const result = await requestPermission();
      if (!result.granted) return;
    }

    clearTimer();
    torchRef.current?.setTorch(false);
    setActiveId(pattern.id);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    runSequence(pattern, 0);
  };

  useEffect(() => {
    return () => {
      clearTimer();
      torchRef.current?.setTorch(false);
    };
  }, [clearTimer]);

  const activePattern = PATTERNS.find((p) => p.id === activeId);
  const styles = makeStyles(colors, insets);

  return (
    <View style={styles.root}>
      {/* Web flash overlay */}
      {Platform.OS === "web" && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flashOverlay,
            { opacity: flashAnim, backgroundColor: activePattern?.color ?? "#FFEE88" },
          ]}
        />
      )}

      {/* Invisible 0×0 camera — single source of permission truth via prop */}
      <TorchCamera
        ref={torchRef}
        permissionGranted={permission?.granted ?? false}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>PATTERNS</Text>

        {activeId && (
          <View style={[styles.activeCard, { borderColor: activePattern?.color }]}>
            <View style={[styles.activeDot, { backgroundColor: activePattern?.color }]} />
            <Text style={[styles.activeName, { color: activePattern?.color }]}>
              {activePattern?.name} Active
            </Text>
          </View>
        )}

        <View style={styles.grid}>
          {PATTERNS.map((pattern) => {
            const isActive = activeId === pattern.id;
            return (
              <Pressable
                key={pattern.id}
                style={[
                  styles.patternCard,
                  isActive && { borderColor: pattern.color, borderWidth: 2 },
                ]}
                onPress={() => handleSelect(pattern)}
              >
                <View style={[styles.colorDot, { backgroundColor: pattern.color }]} />
                <Text style={styles.patternName}>{pattern.name}</Text>
                <Text style={styles.patternDesc}>{pattern.description}</Text>
                {isActive && (
                  <View style={[styles.activeBadge, { backgroundColor: pattern.color }]}>
                    <Text style={styles.activeBadgeText}>ACTIVE</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Camera permission button */}
        {Platform.OS !== "web" && !permission?.granted && (
          <Pressable style={styles.permBtn} onPress={() => requestPermission()}>
            <Text style={styles.permBtnText}>Grant Camera Permission for Torch</Text>
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
    flashOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
    scroll: {
      paddingHorizontal: 16,
      paddingTop: insets.top + 16,
      paddingBottom: insets.bottom + 100,
      gap: 16,
    },
    sectionTitle: {
      fontSize: 10,
      fontFamily: "Inter_700Bold",
      color: colors.mutedForeground,
      letterSpacing: 3,
    },
    activeCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    activeDot: { width: 10, height: 10, borderRadius: 5 },
    activeName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    grid: { gap: 12 },
    patternCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
      position: "relative",
    },
    colorDot: { width: 14, height: 14, borderRadius: 7, marginBottom: 4 },
    patternName: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    patternDesc: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    activeBadge: {
      position: "absolute",
      top: 12,
      right: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    activeBadgeText: {
      fontSize: 10,
      fontFamily: "Inter_700Bold",
      color: "#ffffff",
      letterSpacing: 1,
    },
    permBtn: {
      paddingVertical: 14,
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      alignItems: "center",
    },
    permBtnText: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.primaryForeground,
    },
  });
}
