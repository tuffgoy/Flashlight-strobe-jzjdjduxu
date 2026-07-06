/**
 * StrobeScreen — main strobe/flashlight tab.
 *
 * Flash modes:
 *  - "torch"  → LED flashlight only (via react-native-torch, no camera session)
 *  - "screen" → display flash only
 *  - "both"   → LED + screen together
 *
 * Screen flash area (shown when mode is screen or both):
 *  - "safearea"   → covers only the content area (above the tab bar)
 *  - "fullscreen" → covers the entire screen including the tab bar
 *                   (uses a Modal mounted at the root layout level)
 *
 * Flash color: user-selectable palette for the screen flash overlay.
 *
 * Performance design:
 *  - react-native-torch calls CameraManager.setTorchMode() directly — no
 *    camera session, no camera-in-use indicator on Android.
 *  - Drift-correcting scheduler: each tick is scheduled relative to an absolute
 *    epoch so phase slip cannot accumulate over many cycles.
 *  - Wake lock keeps the screen on while strobing.
 *  - Auto-stop timer cuts the strobe after a chosen duration.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as KeepAwake from "expo-keep-awake";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
const TIMER_PRESETS = [0, 30, 60, 300, 600];
const TAP_WINDOW = 8;
const TAP_RESET_MS = 3000;

const FLASH_COLORS = [
  { label: "White",  value: "#ffffff" },
  { label: "Yellow", value: "#FFD700" },
  { label: "Red",    value: "#ef4444" },
  { label: "Blue",   value: "#3b82f6" },
  { label: "Green",  value: "#22c55e" },
  { label: "Cyan",   value: "#06b6d4" },
  { label: "Purple", value: "#a855f7" },
];

function clamp(val: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, val));
}

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

  // react-native-torch doesn't need camera permission on Android.
  // Keep the hook for iOS compatibility and the permission prompt UI.
  const [permission, requestPermission] = useCameraPermissions();

  const [isActive, setIsActive] = useState(false);
  const [hz, setHz] = useState(10);
  const [flashMode, setFlashMode] = useState<"torch" | "screen" | "both">("torch");
  const [screenFlashArea, setScreenFlashArea] = useState<"fullscreen" | "safearea">("safearea");
  const [timerPresetIdx, setTimerPresetIdx] = useState(0);
  const [countdown, setCountdown] = useState(0);

  // BPM tap state
  const tapTimesRef = useRef<number[]>([]);
  const tapResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [detectedBpm, setDetectedBpm] = useState<number | null>(null);
  const [tapCount, setTapCount] = useState(0);

  const torchRef = useRef<TorchCameraHandle>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const sessionStart = useRef<number | null>(null);
  const logSessionRef = useRef(logSession);
  logSessionRef.current = logSession;

  const {
    flashAnim: fullscreenFlashAnim,
    setFullscreenActive,
    flashColor,
    setFlashColor,
  } = useFullscreenFlash();

  const isFullscreenRef = useRef(false);
  const setFullscreenActiveRef = useRef(setFullscreenActive);
  setFullscreenActiveRef.current = setFullscreenActive;

  // ── Hz slider ──────────────────────────────────────────────────────────────
  const sliderWidth = useRef(1);
  const sliderPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const ratio = Math.max(0, Math.min(1, evt.nativeEvent.locationX / sliderWidth.current));
        setHz(parseFloat((MIN_HZ + ratio * (MAX_HZ - MIN_HZ)).toFixed(1)));
      },
      onPanResponderMove: (evt) => {
        const ratio = Math.max(0, Math.min(1, evt.nativeEvent.locationX / sliderWidth.current));
        setHz(parseFloat((MIN_HZ + ratio * (MAX_HZ - MIN_HZ)).toFixed(1)));
      },
    })
  ).current;

  // ── BPM tap ────────────────────────────────────────────────────────────────
  const handleTapBpm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const now = Date.now();
    const times = [...tapTimesRef.current, now].slice(-TAP_WINDOW);
    tapTimesRef.current = times;
    setTapCount(times.length);
    if (times.length >= 2) {
      let total = 0;
      for (let i = 1; i < times.length; i++) total += times[i] - times[i - 1];
      const bpm = Math.round(60000 / (total / (times.length - 1)));
      const newHz = clamp(parseFloat((bpm / 60).toFixed(1)), MIN_HZ, MAX_HZ);
      setDetectedBpm(bpm);
      setHz(newHz);
    }
    if (tapResetRef.current) clearTimeout(tapResetRef.current);
    tapResetRef.current = setTimeout(() => {
      tapTimesRef.current = [];
      setDetectedBpm(null);
      setTapCount(0);
    }, TAP_RESET_MS);
  }, []);

  const handleResetTap = useCallback(() => {
    if (tapResetRef.current) clearTimeout(tapResetRef.current);
    tapTimesRef.current = [];
    setDetectedBpm(null);
    setTapCount(0);
  }, []);

  useEffect(() => () => { if (tapResetRef.current) clearTimeout(tapResetRef.current); }, []);

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
    AsyncStorage.setItem("strobe_screen_flash_area", screenFlashArea).catch(() => {});
    isFullscreenRef.current = screenFlashArea === "fullscreen";
    flashAnim.setValue(0);
    fullscreenFlashAnim.setValue(0);
    if (!isActive) setFullscreenActiveRef.current(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenFlashArea]);

  // Camera permission request on mount (iOS torch compatibility)
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

  // ── Strobe engine (drift-correcting) ──────────────────────────────────────
  useEffect(() => {
    if (!isActive) {
      torchRef.current?.setTorch(false);
      flashAnim.setValue(0);
      fullscreenFlashAnim.setValue(0);
      setFullscreenActiveRef.current(false);
      return;
    }

    sessionStart.current = Date.now();

    const halfPeriod = (1000 / hz) / 2;
    const useTorch = flashMode !== "screen";
    const useScreen = flashMode !== "torch" || Platform.OS === "web";
    const fullscreen = isFullscreenRef.current && useScreen;

    if (fullscreen) setFullscreenActiveRef.current(true);

    let timeoutId: ReturnType<typeof setTimeout>;
    let alive = true;
    const epoch = Date.now();
    let tickCount = 0;

    function tick() {
      if (!alive) return;
      const on = tickCount % 2 === 0;
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
      tickCount++;
      const delay = Math.max(0, epoch + tickCount * halfPeriod - Date.now());
      timeoutId = setTimeout(tick, delay);
    }

    tick();

    return () => {
      alive = false;
      clearTimeout(timeoutId);
      if (useTorch) torchRef.current?.setTorch(false);
      flashAnim.setValue(0);
      fullscreenFlashAnim.setValue(0);
      setFullscreenActiveRef.current(false);
      if (sessionStart.current !== null) {
        const durationMs = Date.now() - sessionStart.current;
        if (durationMs > 2000) {
          logSessionRef.current({
            timestamp: sessionStart.current,
            mode: flashMode,
            hz,
            dutyCycle: 50,
            color: flashColor,
            durationMs,
          });
        }
        sessionStart.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, hz, flashMode, flashAnim, fullscreenFlashAnim]);

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsActive((prev) => !prev);
  };

  const adjustHz = (delta: number) =>
    setHz((prev) => clamp(parseFloat((prev + delta).toFixed(1)), MIN_HZ, MAX_HZ));

  const timerPreset = TIMER_PRESETS[timerPresetIdx];
  const styles = makeStyles(colors, insets);
  const fillPct = `${((hz - MIN_HZ) / (MAX_HZ - MIN_HZ)) * 100}%` as any;

  // Torch only needs to be active when flash mode uses the LED
  const torchNeeded = flashMode !== "screen";
  const showScreenOptions = flashMode !== "torch";

  return (
    <View style={styles.root}>
      {/* Safe-area screen flash overlay (not fullscreen mode) */}
      <Animated.View
        pointerEvents="none"
        style={[styles.flashOverlay, { opacity: flashAnim, backgroundColor: flashColor }]}
      />

      {/* Torch controller — react-native-torch, no camera session or indicator */}
      <TorchCamera ref={torchRef} enabled={torchNeeded} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        overScrollMode="never"
        bounces={false}
      >
        <Text style={styles.sectionLabel}>{t.strobe}</Text>

        {/* ── Main toggle ────────────────────────────────────────── */}
        <View style={styles.buttonWrap}>
          <Pressable
            style={[styles.mainBtn, isActive && styles.mainBtnActive]}
            onPress={handleToggle}
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
          <Text style={styles.subText}>
            {[t.hzVerySlowLabel, t.hzSlowLabel, t.hzMediumLabel, t.hzFastLabel, t.hzRapidLabel, t.hzUltraLabel][hzLabelKey(hz)]}
          </Text>
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

        {/* ── BPM Tap ────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.bpmHeader}>
            <Text style={styles.cardLabel}>BPM TAP</Text>
            {tapCount > 0 && (
              <Pressable onPress={handleResetTap}>
                <Text style={styles.bpmReset}>Reset</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.subText}>Tap to the beat — Hz updates automatically</Text>
          <View style={styles.bpmRow}>
            <Pressable
              style={[styles.bpmBtn, tapCount > 0 && styles.bpmBtnActive]}
              onPress={handleTapBpm}
            >
              <Text style={styles.bpmBtnLabel}>
                {tapCount === 0 ? "TAP" : tapCount === 1 ? "TAP…" : detectedBpm !== null ? `${detectedBpm}` : "TAP"}
              </Text>
              {detectedBpm !== null && <Text style={styles.bpmBtnSub}>BPM</Text>}
              {tapCount === 1 && <Text style={styles.bpmBtnSub}>keep tapping</Text>}
            </Pressable>
            <View style={styles.bpmInfo}>
              <View style={styles.bpmInfoRow}>
                <Text style={styles.bpmInfoLabel}>TAPS</Text>
                <Text style={styles.bpmInfoVal}>{tapCount}</Text>
              </View>
              <View style={styles.bpmDivider} />
              <View style={styles.bpmInfoRow}>
                <Text style={styles.bpmInfoLabel}>BPM → Hz</Text>
                <Text style={[styles.bpmInfoVal, { color: colors.primary }]}>
                  {detectedBpm !== null ? `${detectedBpm} → ${(detectedBpm / 60).toFixed(1)}` : "—"}
                </Text>
              </View>
              <View style={styles.bpmDivider} />
              <View style={styles.bpmInfoRow}>
                <Text style={styles.bpmInfoLabel}>SET TO</Text>
                <Text style={styles.bpmInfoVal}>{hz.toFixed(1)} Hz</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Flash mode + options ────────────────────────────────── */}
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

          {/* Screen area — visible when mode uses screen flash */}
          {showScreenOptions && (
            <>
              <View style={styles.divider} />
              <Text style={styles.cardLabel}>SCREEN AREA</Text>
              <View style={styles.modeRow}>
                {(["safearea", "fullscreen"] as const).map((area) => (
                  <Pressable
                    key={area}
                    style={[styles.modeBtn, screenFlashArea === area && styles.modeBtnActive]}
                    onPress={() => setScreenFlashArea(area)}
                  >
                    <Text style={styles.modeIcon}>
                      {area === "safearea" ? "▣" : "⬛"}
                    </Text>
                    <Text style={[styles.modeLbl, screenFlashArea === area && styles.modeLblActive]}>
                      {area === "safearea" ? "Safe Area" : "Fullscreen"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.subText}>
                {screenFlashArea === "fullscreen"
                  ? "Flash covers the entire screen including tab bar"
                  : "Flash covers the content area only"}
              </Text>

              {/* Flash color picker */}
              <View style={styles.divider} />
              <Text style={styles.cardLabel}>FLASH COLOR</Text>
              <View style={styles.colorRow}>
                {FLASH_COLORS.map((c) => (
                  <Pressable
                    key={c.value}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: c.value },
                      flashColor === c.value && styles.colorSwatchActive,
                    ]}
                    onPress={() => setFlashColor(c.value)}
                  />
                ))}
              </View>
              <Text style={styles.subText}>
                {FLASH_COLORS.find((c) => c.value === flashColor)?.label ?? "Custom"}
              </Text>
            </>
          )}

          <Text style={[styles.subText, { marginTop: showScreenOptions ? 0 : 2 }]}>
            {flashMode === "torch"
              ? "LED torch only — no camera session required"
              : flashMode === "screen"
              ? "Screen flash only — no torch used"
              : "LED torch + screen flash together"}
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
            { val: `${Math.round(hz * 60)}`, lbl: "BPM" },
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

        {Platform.OS !== "web" && !permission?.granted && flashMode !== "screen" && (
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
      zIndex: 10,
      pointerEvents: "none",
    } as any,
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
      width: 160, height: 160,
      alignItems: "center", justifyContent: "center",
      marginVertical: 8,
    },
    mainBtn: {
      width: 150, height: 150, borderRadius: 75,
      backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border,
      alignItems: "center", justifyContent: "center", gap: 2,
    },
    mainBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    btnIcon: { fontSize: 36 },
    btnLabel: { fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground, letterSpacing: 2 },
    btnLabelActive: { color: colors.primaryForeground },
    countdownText: { fontSize: 11, fontFamily: "Inter_500Medium", color: colors.primaryForeground, opacity: 0.8 },
    card: {
      width: "100%", backgroundColor: colors.card,
      borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 10,
    },
    cardLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 2 },
    bigVal: { fontSize: 36, fontFamily: "Inter_700Bold", color: colors.foreground },
    subText: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
    sliderTrack: {
      width: "100%", height: 8, backgroundColor: colors.muted,
      borderRadius: 4, overflow: "visible" as any, justifyContent: "center",
    },
    sliderFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 4 },
    sliderThumb: {
      position: "absolute", width: 20, height: 20, borderRadius: 10,
      backgroundColor: colors.primary, borderWidth: 3, borderColor: colors.background,
      top: -6, marginLeft: -10, elevation: 2,
    },
    adjRow: { flexDirection: "row", gap: 6 },
    adjBtn: {
      paddingHorizontal: 10, paddingVertical: 8,
      backgroundColor: colors.muted, borderRadius: colors.radius - 2,
      borderWidth: 1, borderColor: colors.border,
      minWidth: 40, alignItems: "center",
    },
    adjBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    presetBtn: {
      paddingHorizontal: 12, paddingVertical: 6,
      backgroundColor: colors.muted, borderRadius: colors.radius - 4,
      borderWidth: 1, borderColor: colors.border,
    },
    presetBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    presetText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    presetTextActive: { color: colors.primaryForeground },
    // BPM
    bpmHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    bpmReset: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground },
    bpmRow: { flexDirection: "row", gap: 14, alignItems: "center" },
    bpmBtn: {
      width: 96, height: 96, borderRadius: 48,
      backgroundColor: colors.muted, borderWidth: 2, borderColor: colors.border,
      alignItems: "center", justifyContent: "center", gap: 2,
    },
    bpmBtnActive: { borderColor: colors.primary, backgroundColor: colors.card },
    bpmBtnLabel: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center" },
    bpmBtnSub: { fontSize: 10, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textAlign: "center" },
    bpmInfo: {
      flex: 1, backgroundColor: colors.muted,
      borderRadius: colors.radius - 2, borderWidth: 1, borderColor: colors.border,
      overflow: "hidden",
    },
    bpmInfoRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: 12, paddingVertical: 8,
    },
    bpmDivider: { height: 1, backgroundColor: colors.border },
    bpmInfoLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 1 },
    bpmInfoVal: { fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground },
    // Flash mode
    modeRow: { flexDirection: "row", gap: 8 },
    modeBtn: {
      flex: 1, paddingVertical: 12, alignItems: "center",
      backgroundColor: colors.muted, borderRadius: colors.radius - 2,
      borderWidth: 1, borderColor: colors.border, gap: 4,
    },
    modeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    modeIcon: { fontSize: 20 },
    modeLbl: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.foreground, letterSpacing: 0.5 },
    modeLblActive: { color: colors.primaryForeground },
    // Color picker
    colorRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    colorSwatch: {
      width: 32, height: 32, borderRadius: 16,
      borderWidth: 2, borderColor: "transparent",
    },
    colorSwatchActive: {
      borderColor: colors.foreground,
      transform: [{ scale: 1.2 }],
    },
    // Stats
    statsRow: {
      width: "100%", flexDirection: "row",
      backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border, padding: 12,
    },
    statItem: { flex: 1, alignItems: "center", gap: 2 },
    statVal: { fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground },
    statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    statDiv: { width: 1, backgroundColor: colors.border, marginHorizontal: 4 },
    permBtn: {
      width: "100%", paddingVertical: 14,
      backgroundColor: colors.primary, borderRadius: colors.radius, alignItems: "center",
    },
    permBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.primaryForeground },
  });
}
