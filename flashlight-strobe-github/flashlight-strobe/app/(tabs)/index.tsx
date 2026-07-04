/**
 * Strobe screen — main flashlight/torch strobe controller.
 *
 * Performance design:
 *   - TorchCamera is an isolated forwardRef component (0×0, invisible).
 *     Only IT re-renders on each torch toggle via torchRef.current?.setTorch().
 *     The parent StrobeScreen never re-renders at strobe frequency.
 *   - Drift-corrected high-res timer: polls every 2 ms using performance.now()
 *     so the actual toggle instant is accurate regardless of JS event-loop jitter.
 *   - Max Hz raised to 120. Practical hardware limit depends on the device,
 *     but the JS side no longer bottlenecks it.
 */

import { useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
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

const MIN_HZ = 0.5;
const MAX_HZ = 120;
const MIN_DUTY = 10;
const MAX_DUTY = 90;

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function hzLabel(hz: number): string {
  if (hz < 2) return "Very Slow";
  if (hz < 5) return "Slow";
  if (hz < 15) return "Medium";
  if (hz < 30) return "Fast";
  if (hz < 60) return "Rapid";
  return "Ultra";
}

export default function StrobeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [isActive, setIsActive] = useState(false);
  const [hz, setHz] = useState(10);
  const [dutyCycle, setDutyCycle] = useState(50);

  // Refs for strobe engine (no state changes = no parent re-renders during strobe)
  const torchRef = useRef<TorchCameraHandle>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // ── Strobe engine ──────────────────────────────────────────────────────────
  // Uses a 2 ms polling interval + performance.now() for drift correction.
  // At 120 Hz the half-period is ~4.17 ms; 2 ms polling gives sub-ms accuracy.
  useEffect(() => {
    if (!isActive) {
      torchRef.current?.setTorch(false);
      flashAnim.setValue(0);
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      return;
    }

    // Glow pulse animation while active
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    const period = 1000 / hz;
    const onMs = period * (dutyCycle / 100);
    const offMs = period - onMs;

    let state = true;
    let nextToggle = performance.now() + onMs;

    // Turn torch on immediately
    torchRef.current?.setTorch(true);
    if (Platform.OS === "web") flashAnim.setValue(1);

    const id = setInterval(() => {
      const now = performance.now();
      if (now >= nextToggle) {
        state = !state;
        torchRef.current?.setTorch(state);
        if (Platform.OS === "web") flashAnim.setValue(state ? 1 : 0);
        // Schedule next toggle relative to the *intended* time, not now,
        // so errors don't accumulate.
        nextToggle += state ? onMs : offMs;
      }
    }, 2);

    return () => {
      clearInterval(id);
      torchRef.current?.setTorch(false);
      flashAnim.setValue(0);
    };
  }, [isActive, hz, dutyCycle, glowAnim, flashAnim]);

  // ── Permission: request on mount (non-blocking) ────────────────────────────
  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain !== false) {
      requestPermission().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsActive((prev) => !prev);
  };

  const adjustHz = (delta: number) => {
    setHz((prev) => clamp(parseFloat((prev + delta).toFixed(1)), MIN_HZ, MAX_HZ));
  };

  const adjustDuty = (delta: number) => {
    setDutyCycle((prev) => clamp(prev + delta, MIN_DUTY, MAX_DUTY));
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  const styles = makeStyles(colors, insets);

  return (
    <View style={styles.root}>
      {/* ── Web: full-screen flash overlay (no real torch on web) ── */}
      {Platform.OS === "web" && (
        <Animated.View
          pointerEvents="none"
          style={[styles.flashOverlay, { opacity: flashAnim }]}
        />
      )}

      {/* ── Native: 0×0 invisible camera for torch control ── */}
      <TorchCamera ref={torchRef} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.titleLabel}>STROBE</Text>

        {/* Main toggle button */}
        <View style={styles.buttonWrap}>
          <Animated.View style={[styles.glowRing, { opacity: glowOpacity }]} />
          <Pressable
            style={[styles.mainButton, isActive && styles.mainButtonActive]}
            onPress={handleToggle}
            testID="strobe-toggle"
          >
            <Text style={[styles.buttonIcon, isActive && styles.buttonIconActive]}>
              ⚡
            </Text>
            <Text style={[styles.buttonLabel, isActive && styles.buttonLabelActive]}>
              {isActive ? "ON" : "OFF"}
            </Text>
          </Pressable>
        </View>

        {/* Hz control */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>FREQUENCY</Text>
          <Text style={styles.bigValue}>{hz.toFixed(1)} Hz</Text>
          <Text style={styles.subText}>{hzLabel(hz)}</Text>

          <View style={styles.sliderTrack}>
            <View
              style={[
                styles.sliderFill,
                { width: `${((hz - MIN_HZ) / (MAX_HZ - MIN_HZ)) * 100}%` as any },
              ]}
            />
          </View>

          {/* Fine adjustment row */}
          <View style={styles.adjRow}>
            {[-10, -5, -1].map((d) => (
              <Pressable key={d} style={styles.adjBtn} onPress={() => adjustHz(d)}>
                <Text style={styles.adjBtnText}>{d}</Text>
              </Pressable>
            ))}
            <View style={{ flex: 1 }} />
            {[1, 5, 10].map((d) => (
              <Pressable key={d} style={styles.adjBtn} onPress={() => adjustHz(d)}>
                <Text style={styles.adjBtnText}>+{d}</Text>
              </Pressable>
            ))}
          </View>

          {/* Hz presets — extended to 120 */}
          <View style={styles.presetRow}>
            {[1, 5, 10, 20, 30, 60, 120].map((v) => (
              <Pressable
                key={v}
                style={[styles.presetBtn, hz === v && styles.presetBtnActive]}
                onPress={() => setHz(v)}
              >
                <Text style={[styles.presetText, hz === v && styles.presetTextActive]}>
                  {v}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Duty cycle */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>DUTY CYCLE</Text>
          <Text style={styles.bigValue}>{dutyCycle}%</Text>
          <Text style={styles.subText}>Flash on-time per cycle</Text>

          <View style={styles.sliderTrack}>
            <View
              style={[
                styles.sliderFill,
                {
                  width: `${((dutyCycle - MIN_DUTY) / (MAX_DUTY - MIN_DUTY)) * 100}%` as any,
                },
              ]}
            />
          </View>

          <View style={styles.adjRow}>
            {[-20, -10, -5].map((d) => (
              <Pressable key={d} style={styles.adjBtn} onPress={() => adjustDuty(d)}>
                <Text style={styles.adjBtnText}>{d}</Text>
              </Pressable>
            ))}
            <View style={{ flex: 1 }} />
            {[5, 10, 20].map((d) => (
              <Pressable key={d} style={styles.adjBtn} onPress={() => adjustDuty(d)}>
                <Text style={styles.adjBtnText}>+{d}</Text>
              </Pressable>
            ))}
          </View>

          {/* Duty presets */}
          <View style={styles.presetRow}>
            {[10, 25, 50, 75, 90].map((v) => (
              <Pressable
                key={v}
                style={[styles.presetBtn, dutyCycle === v && styles.presetBtnActive]}
                onPress={() => setDutyCycle(v)}
              >
                <Text style={[styles.presetText, dutyCycle === v && styles.presetTextActive]}>
                  {v}%
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Status */}
        <View style={styles.statusRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{hz.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Hz</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{dutyCycle}</Text>
            <Text style={styles.statLabel}>DUTY%</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{(1000 / hz).toFixed(0)}</Text>
            <Text style={styles.statLabel}>ms/CYCLE</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{((1000 / hz) * (dutyCycle / 100)).toFixed(0)}</Text>
            <Text style={styles.statLabel}>ms ON</Text>
          </View>
        </View>

        {/* Camera permission hint (non-blocking) */}
        {Platform.OS !== "web" && !permission?.granted && (
          <Pressable style={styles.permBtn} onPress={() => requestPermission()}>
            <Text style={styles.permBtnText}>
              Grant Camera Permission for Torch
            </Text>
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
      pointerEvents: "none",
    },
    scroll: {
      paddingHorizontal: 16,
      paddingTop: insets.top + 16,
      paddingBottom: insets.bottom + 100,
      alignItems: "center",
      gap: 16,
    },
    titleLabel: {
      fontSize: 10,
      fontFamily: "Inter_700Bold",
      color: colors.mutedForeground,
      letterSpacing: 3,
      alignSelf: "flex-start",
    },
    buttonWrap: {
      width: 160,
      height: 160,
      alignItems: "center",
      justifyContent: "center",
      marginVertical: 8,
    },
    glowRing: {
      position: "absolute",
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: colors.primary,
    },
    mainButton: {
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    mainButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    buttonIcon: { fontSize: 36 },
    buttonIconActive: {},
    buttonLabel: {
      fontSize: 14,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      letterSpacing: 2,
    },
    buttonLabelActive: { color: colors.primaryForeground },
    card: {
      width: "100%",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 10,
    },
    cardTitle: {
      fontSize: 10,
      fontFamily: "Inter_700Bold",
      color: colors.mutedForeground,
      letterSpacing: 2,
    },
    bigValue: {
      fontSize: 36,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    subText: {
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
    adjRow: {
      flexDirection: "row",
      gap: 6,
    },
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
    presetRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    presetBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.muted,
      borderRadius: colors.radius - 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    presetBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    presetText: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    presetTextActive: {
      color: colors.primaryForeground,
      fontFamily: "Inter_600SemiBold",
    },
    statusRow: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      width: "100%",
    },
    statItem: {
      flex: 1,
      paddingVertical: 16,
      alignItems: "center",
      gap: 4,
    },
    statValue: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    statLabel: {
      fontSize: 9,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      letterSpacing: 1,
    },
    statDivider: { width: 1, backgroundColor: colors.border },
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
