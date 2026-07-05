/**
 * Strobe screen
 *
 * Performance design:
 *  - TorchCamera is an isolated forwardRef component (1×1 off-screen).
 *    Only IT re-renders on each torch toggle.  Parent never re-renders
 *    at strobe frequency.
 *  - Modulo-based timer: samples performance.now() every 2 ms, computes
 *    whether we're in the ON or OFF phase via elapsed % period. No drift.
 *  - Wake lock keeps the screen on while strobing.
 *  - Optional "screen flash" mode lights the display on every pulse
 *    (works even without camera permission).
 *  - Auto-stop timer cuts the strobe after a chosen duration.
 */

import { useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as KeepAwake from "expo-keep-awake";
import React, { useEffect, useRef, useState } from "react";
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
import { useLogger } from "@/hooks/useLogger";

const MIN_HZ = 0.5;
const MAX_HZ = 120;

// Timer presets in seconds (0 = no timer)
const TIMER_PRESETS = [0, 30, 60, 300, 600];

function clamp(val: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, val));
}

// Hz description key index: 0=VerySlowLabel 1=SlowLabel 2=MediumLabel 3=FastLabel 4=RapidLabel 5=UltraLabel
function hzLabelKey(hz: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (hz < 2) return 0;
  if (hz < 5) return 1;
  if (hz < 15) return 2;
  if (hz < 30) return 3;
  if (hz < 60) return 4;
  return 5;
}

function fmtTimer(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

export default function StrobeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { logSession } = useLogger();

  const [permission, requestPermission] = useCameraPermissions();
  const [isActive, setIsActive] = useState(false);
  const [hz, setHz] = useState(10);
  const [screenFlash, setScreenFlash] = useState(false);
  const [timerPresetIdx, setTimerPresetIdx] = useState(0); // index into TIMER_PRESETS
  const [countdown, setCountdown] = useState(0);

  const torchRef = useRef<TorchCameraHandle>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const sessionStart = useRef<number | null>(null);

  // Refs that the strobe engine reads without being in its dependency array.
  // This prevents the engine from restarting mid-flash when permission resolves
  // (undefined → granted) or when logSession gets a new function reference.
  const permissionGrantedRef = useRef(permission?.granted ?? false);
  permissionGrantedRef.current = permission?.granted ?? false;
  const logSessionRef = useRef(logSession);
  logSessionRef.current = logSession;

  // Request camera permission on mount (non-blocking)
  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain !== false) {
      requestPermission().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Wake lock ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isActive) {
      KeepAwake.activateKeepAwakeAsync().catch(() => {});
    } else {
      KeepAwake.deactivateKeepAwake();
    }
    // Ensure wake lock is released on unmount regardless of isActive state
    return () => { KeepAwake.deactivateKeepAwake(); };
  }, [isActive]);

  // ── Auto-stop countdown ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) {
      setCountdown(0);
      return;
    }
    const preset = TIMER_PRESETS[timerPresetIdx];
    if (preset === 0) return;

    setCountdown(preset);
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setIsActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isActive, timerPresetIdx]);

  // ── Strobe engine ──────────────────────────────────────────────────────────
  // Uses elapsed % period to determine ON/OFF phase at any given moment.
  // Only calls setTorch when the phase actually changes → max 1 React setState
  // per 2 ms tick, never batched away.
  useEffect(() => {
    if (!isActive) {
      torchRef.current?.setTorch(false);
      flashAnim.setValue(0);
      return;
    }

    sessionStart.current = Date.now();

    const period = 1000 / hz;
    const halfPeriod = period / 2; // pure 50/50 — flash on, flash off, repeat
    const startTime = performance.now();
    let lastState: boolean | null = null;

    torchRef.current?.setTorch(true);
    if (Platform.OS === "web" || screenFlash) flashAnim.setValue(1);
    lastState = true;

    const id = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const phase = elapsed % period;
      const shouldBeOn = phase < halfPeriod;

      if (shouldBeOn !== lastState) {
        lastState = shouldBeOn;
        torchRef.current?.setTorch(shouldBeOn);
        if (Platform.OS === "web" || screenFlash) {
          flashAnim.setValue(shouldBeOn ? 1 : 0);
        }
      }
    }, 2);

    return () => {
      clearInterval(id);
      torchRef.current?.setTorch(false);
      flashAnim.setValue(0);
      // Log session — read via refs so this closure never goes stale
      if (sessionStart.current !== null) {
        const durationMs = Date.now() - sessionStart.current;
        if (durationMs > 2000) {
          logSessionRef.current({
            timestamp: sessionStart.current,
            mode: screenFlash ? (permissionGrantedRef.current ? "both" : "screen") : "torch",
            hz,
            dutyCycle: 50,
            color: "#FFD700",
            durationMs,
          });
        }
        sessionStart.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, hz, screenFlash, flashAnim]);
  // NOTE: logSession and permission?.granted are intentionally excluded —
  // they update via refs above so the engine never restarts mid-flash.

  const handleToggle = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsActive((prev) => !prev);
  };

  const adjustHz = (delta: number) =>
    setHz((prev) => clamp(parseFloat((prev + delta).toFixed(1)), MIN_HZ, MAX_HZ));

  const timerPreset = TIMER_PRESETS[timerPresetIdx];

  const styles = makeStyles(colors, insets);

  return (
    <View style={styles.root}>
      {/* Screen flash overlay — active on all platforms when screenFlash on */}
      <Animated.View
        pointerEvents="none"
        style={[styles.flashOverlay, { opacity: flashAnim }]}
      />

      {/* 1×1 off-screen camera — drives hardware torch */}
      <TorchCamera ref={torchRef} permissionGranted={permission?.granted ?? false} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>{t.strobe}</Text>

        {/* ── Main toggle button ─────────────────────────────────── */}
        <View style={styles.buttonWrap}>
          <Pressable
            style={[styles.mainBtn, isActive && styles.mainBtnActive]}
            onPress={handleToggle}
            testID="strobe-toggle"
          >
            <Text style={styles.btnIcon}>⚡</Text>
            <Text style={[styles.btnLabel, isActive && styles.btnLabelActive]}>
              {isActive ? t.on : t.off}
            </Text>
            {isActive && countdown > 0 && (
              <Text style={styles.countdownText}>{fmtTimer(countdown)}</Text>
            )}
          </Pressable>
        </View>

        {/* ── Frequency ──────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t.frequency}</Text>
          <Text style={styles.bigVal}>{hz.toFixed(1)} Hz</Text>
          <Text style={styles.subText}>{
            [t.hzVerySlowLabel, t.hzSlowLabel, t.hzMediumLabel, t.hzFastLabel, t.hzRapidLabel, t.hzUltraLabel][hzLabelKey(hz)]
          }</Text>

          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${((hz - MIN_HZ) / (MAX_HZ - MIN_HZ)) * 100}%` as any }]} />
          </View>

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

          <View style={styles.presetRow}>
            {[1, 5, 10, 20, 30, 60, 120].map((v) => (
              <Pressable
                key={v}
                style={[styles.presetBtn, hz === v && styles.presetBtnActive]}
                onPress={() => setHz(v)}
              >
                <Text style={[styles.presetText, hz === v && styles.presetTextActive]}>{v}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Screen flash toggle ─────────────────────────────────── */}
        <Pressable
          style={[styles.card, styles.toggleRow]}
          onPress={() => setScreenFlash((prev) => !prev)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>{t.screenFlash}</Text>
            <Text style={styles.subText}>{t.screenFlashSub}</Text>
          </View>
          <View style={[styles.toggle, screenFlash && styles.toggleOn]}>
            <View style={[styles.toggleKnob, screenFlash && styles.toggleKnobOn]} />
          </View>
        </Pressable>

        {/* ── Auto-stop timer ─────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t.timer}</Text>
          <Text style={styles.bigVal}>
            {timerPreset === 0 ? t.noTimer : fmtTimer(timerPreset)}
          </Text>
          {isActive && countdown > 0 && (
            <Text style={styles.subText}>{fmtTimer(countdown)} remaining</Text>
          )}
          <View style={styles.presetRow}>
            {TIMER_PRESETS.map((v, i) => (
              <Pressable
                key={v}
                style={[styles.presetBtn, timerPresetIdx === i && styles.presetBtnActive]}
                onPress={() => setTimerPresetIdx(i)}
              >
                <Text style={[styles.presetText, timerPresetIdx === i && styles.presetTextActive]}>
                  {v === 0 ? "Off" : v < 60 ? `${v}s` : `${v / 60}m`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Stats row ──────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          {[
            { val: hz.toFixed(1), lbl: "Hz" },
            { val: `${(1000 / hz).toFixed(0)}`, lbl: "ms / cycle" },
            { val: `${(1000 / hz / 2).toFixed(0)}`, lbl: "ms ON" },
            { val: `${(1000 / hz / 2).toFixed(0)}`, lbl: "ms OFF" },
          ].map((item, i, arr) => (
            <React.Fragment key={item.lbl}>
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{item.val}</Text>
                <Text style={styles.statLbl}>{item.lbl}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.statDiv} />}
            </React.Fragment>
          ))}
        </View>

        {/* Permission button (only shown if denied) */}
        {Platform.OS !== "web" && !permission?.granted && (
          <Pressable style={styles.permBtn} onPress={() => requestPermission()}>
            <Text style={styles.permBtnText}>{t.grantPermission}</Text>
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
    sectionLabel: {
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
    mainBtn: {
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    },
    mainBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    btnIcon: { fontSize: 36 },
    btnLabel: {
      fontSize: 14,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      letterSpacing: 2,
    },
    btnLabelActive: { color: colors.primaryForeground },
    countdownText: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.primaryForeground,
      opacity: 0.8,
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
    cardLabel: {
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
    presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
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
    statsRow: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      width: "100%",
    },
    statItem: { flex: 1, paddingVertical: 16, alignItems: "center", gap: 4 },
    statVal: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground },
    statLbl: {
      fontSize: 9,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      letterSpacing: 1,
    },
    statDiv: { width: 1, backgroundColor: colors.border },
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
