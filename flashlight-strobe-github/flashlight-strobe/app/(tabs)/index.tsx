/**
 * StrobeScreen — main strobe/flashlight tab.
 *
 * Flash modes:
 *  - "torch"  → LED flashlight only
 *  - "screen" → display flash only (works without camera permission)
 *  - "both"   → LED + screen together
 *
 * Screen flash area (persisted in AsyncStorage):
 *  - "safearea"   → flash overlay covers only the content area above the tab bar
 *  - "fullscreen" → flash overlay covers the entire screen including the tab bar
 *                   (rendered at the root layout level via FullscreenFlashContext)
 *
 * Hz slider:
 *  - Drag left/right to set frequency, or tap the +/- buttons / presets
 *
 * Performance design:
 *  - TorchCamera is an isolated forwardRef component (1×1 off-screen).
 *    Only IT re-renders on each torch toggle.  Parent never re-renders
 *    at strobe frequency.
 *  - setTimeout chain: each ON→OFF and OFF→ON is a separate scheduled event;
 *    no batching, no phase drift.
 *  - Wake lock keeps the screen on while strobing.
 *  - Auto-stop timer cuts the strobe after a chosen duration.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as KeepAwake from "expo-keep-awake";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TorchCamera, TorchCameraHandle } from "@/components/TorchCamera";
import { useFullscreenFlash } from "@/context/FullscreenFlashContext";
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
  // "torch" = LED only  |  "screen" = display flash only  |  "both" = LED + screen
  const [flashMode, setFlashMode] = useState<"torch" | "screen" | "both">("torch");
  const [timerPresetIdx, setTimerPresetIdx] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [screenFlashArea, setScreenFlashArea] = useState<"fullscreen" | "safearea">("safearea");

  const torchRef = useRef<TorchCameraHandle>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const sessionStart = useRef<number | null>(null);

  // logSession ref — updated every render so the strobe cleanup never goes stale
  const logSessionRef = useRef(logSession);
  logSessionRef.current = logSession;

  // Fullscreen flash context — controlled from root layout
  const { flashAnim: fullscreenFlashAnim } = useFullscreenFlash();

  // Track fullscreen mode in a ref so the strobe closure always reads latest value
  const isFullscreenRef = useRef(false);

  // ── Hz slider ──────────────────────────────────────────────────────────────
  const sliderWidth = useRef(1);

  const sliderPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const ratio = Math.max(0, Math.min(1, x / sliderWidth.current));
        setHz(parseFloat((MIN_HZ + ratio * (MAX_HZ - MIN_HZ)).toFixed(1)));
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const ratio = Math.max(0, Math.min(1, x / sliderWidth.current));
        setHz(parseFloat((MIN_HZ + ratio * (MAX_HZ - MIN_HZ)).toFixed(1)));
      },
    })
  ).current;

  // ── Persist flash mode ─────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem("strobe_flash_mode").then((v) => {
      if (v === "torch" || v === "screen" || v === "both") setFlashMode(v);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    AsyncStorage.setItem("strobe_flash_mode", flashMode).catch(() => {});
  }, [flashMode]);

  // ── Persist screen flash area ──────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem("strobe_screen_flash_area").then((v) => {
      if (v === "fullscreen" || v === "safearea") setScreenFlashArea(v);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    isFullscreenRef.current = screenFlashArea === "fullscreen";
    // When switching modes, immediately clear both overlays
    flashAnim.setValue(0);
    fullscreenFlashAnim.setValue(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenFlashArea]);

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
    return () => { KeepAwake.deactivateKeepAwake(); };
  }, [isActive]);

  // ── Auto-stop countdown ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) { setCountdown(0); return; }
    const preset = TIMER_PRESETS[timerPresetIdx];
    if (preset === 0) return;
    setCountdown(preset);
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(id); setIsActive(false); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isActive, timerPresetIdx]);

  // ── Strobe engine ──────────────────────────────────────────────────────────
  // setTimeout chain — each toggle schedules exactly one next toggle after
  // halfPeriod ms. This is far more reliable than setInterval polling because:
  //   • No missed transitions: every ON→OFF and OFF→ON is its own scheduled event
  //   • No batching: each setTimeout fires independently; React can't coalesce them
  //   • No phase drift: the chain self-corrects around JS thread delays
  //   • Instant start: tick(true) fires synchronously before the first timeout
  //
  // Screen flash routing: reads isFullscreenRef at each tick (no closure stale).
  //   - fullscreen mode → sets fullscreenFlashAnim (root overlay, covers tab bar)
  //   - safearea mode   → sets local flashAnim (covers content area only)
  useEffect(() => {
    if (!isActive) {
      torchRef.current?.setTorch(false);
      flashAnim.setValue(0);
      fullscreenFlashAnim.setValue(0);
      return;
    }

    sessionStart.current = Date.now();

    const halfPeriod = (1000 / hz) / 2;
    const useTorch = flashMode !== "screen";
    const useScreen = flashMode !== "torch" || Platform.OS === "web";

    let timeoutId: ReturnType<typeof setTimeout>;
    let alive = true;

    function tick(on: boolean) {
      if (!alive) return;
      if (useTorch) torchRef.current?.setTorch(on);
      if (useScreen) {
        const val = on ? 1 : 0;
        if (isFullscreenRef.current) {
          fullscreenFlashAnim.setValue(val);
          flashAnim.setValue(0);
        } else {
          flashAnim.setValue(val);
          fullscreenFlashAnim.setValue(0);
        }
      }
      timeoutId = setTimeout(() => tick(!on), halfPeriod);
    }

    tick(true); // start immediately — no leading delay

    return () => {
      alive = false;
      clearTimeout(timeoutId);
      if (useTorch) torchRef.current?.setTorch(false);
      flashAnim.setValue(0);
      fullscreenFlashAnim.setValue(0);
      if (sessionStart.current !== null) {
        const durationMs = Date.now() - sessionStart.current;
        if (durationMs > 2000) {
          logSessionRef.current({
            timestamp: sessionStart.current,
            mode: flashMode,
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
  }, [isActive, hz, flashMode, flashAnim, fullscreenFlashAnim]);

  // Fire-and-forget haptics — do NOT await, or the 200-700ms vibration
  // completion delay becomes visible as lag before the strobe starts.
  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsActive((prev) => !prev);
  };

  const adjustHz = (delta: number) =>
    setHz((prev) => clamp(parseFloat((prev + delta).toFixed(1)), MIN_HZ, MAX_HZ));

  const timerPreset = TIMER_PRESETS[timerPresetIdx];

  const styles = makeStyles(colors, insets);
  const fillPct = `${((hz - MIN_HZ) / (MAX_HZ - MIN_HZ)) * 100}%` as any;

  return (
    <View style={styles.root}>
      {/* Screen flash overlay — safe-area mode: covers content above tab bar */}
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

          {/* Swipeable slider track — drag left/right to change Hz */}
          <View
            style={styles.sliderTrack}
            onLayout={(e) => { sliderWidth.current = e.nativeEvent.layout.width || 1; }}
            hitSlop={{ top: 16, bottom: 16 }}
            {...sliderPan.panHandlers}
          >
            <View style={[styles.sliderFill, { width: fillPct }]} />
            <View style={[styles.sliderThumb, { left: fillPct }]} />
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

        {/* ── Flash mode selector ─────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>FLASH MODE</Text>
          <View style={styles.modeRow}>
            {(["torch", "screen", "both"] as const).map((mode) => (
              <Pressable
                key={mode}
                style={[styles.modeBtn, flashMode === mode && styles.modeBtnActive]}
                onPress={() => setFlashMode(mode)}
              >
                <Text style={styles.modeIcon}>
                  {mode === "torch" ? "🔦" : mode === "screen" ? "📱" : "⚡"}
                </Text>
                <Text style={[styles.modeLbl, flashMode === mode && styles.modeLblActive]}>
                  {mode === "torch" ? "Torch" : mode === "screen" ? "Screen" : "Both"}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.subText}>
            {flashMode === "torch"
              ? "Flashlight LED only"
              : flashMode === "screen"
              ? `Screen flash only — ${screenFlashArea === "fullscreen" ? "full screen" : "above navigation"}`
              : "Flashlight LED + screen together"}
          </Text>
        </View>

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
      height: 8,
      backgroundColor: colors.muted,
      borderRadius: 4,
      overflow: "visible",
      justifyContent: "center",
    },
    sliderFill: {
      height: "100%",
      backgroundColor: colors.primary,
      borderRadius: 4,
    },
    sliderThumb: {
      position: "absolute",
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primary,
      borderWidth: 3,
      borderColor: colors.background,
      top: -6,
      marginLeft: -10,
      elevation: 2,
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
      borderRadius: colors.radius - 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    presetBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    presetText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    presetTextActive: { color: colors.primaryForeground },
    modeRow: { flexDirection: "row", gap: 8 },
    modeBtn: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
      backgroundColor: colors.muted,
      borderRadius: colors.radius - 2,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    modeBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    modeIcon: { fontSize: 20 },
    modeLbl: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      letterSpacing: 0.5,
    },
    modeLblActive: { color: colors.primaryForeground },
    statsRow: {
      width: "100%",
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
    },
    statItem: { flex: 1, alignItems: "center", gap: 2 },
    statVal: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    statLbl: {
      fontSize: 10,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    statDiv: { width: 1, backgroundColor: colors.border, marginHorizontal: 4 },
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
