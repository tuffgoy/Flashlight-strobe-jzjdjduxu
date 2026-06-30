import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRemoteConfig } from '@/context/RemoteConfigContext';
import { useColors } from '@/hooks/useColors';
import { useLogger } from '@/hooks/useLogger';

// ─── Constants ───────────────────────────────────────────────────────────────
const MIN_HZ = 0.5;
const MAX_HZ = 30;
const MIN_DUTY = 10;
const MAX_DUTY = 90;

const PRESET_COLORS = [
  '#ffffff', // white
  '#ff2d55', // red
  '#30d158', // green
  '#0a84ff', // blue
  '#ffd60a', // yellow
  '#5ac8fa', // cyan
  '#bf5af2', // purple
  '#ff9f0a', // orange
];

const TIMER_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '10s', value: 10 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '5m', value: 300 },
  { label: '10m', value: 600 },
];

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m > 0) return `${m}m ${rem}s`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function StrobeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const { config } = useRemoteConfig();
  const { logSession } = useLogger();

  // ── Core state ─────────────────────────────────────────────────────────────
  type Mode = 'screen' | 'torch' | 'both';
  const [mode, setMode] = useState<Mode>('torch');
  const [isActive, setIsActive] = useState(false);
  const [strobeVisible, setStrobeVisible] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // ── Hz control ─────────────────────────────────────────────────────────────
  const [hz, setHz] = useState(10);
  const [hzInput, setHzInput] = useState('10.0');

  // ── Duty cycle ─────────────────────────────────────────────────────────────
  const [dutyCycle, setDutyCycle] = useState(50);

  // ── Screen color ───────────────────────────────────────────────────────────
  const [screenColor, setScreenColor] = useState('#ffffff');
  const [hexInput, setHexInput] = useState('#ffffff');

  // ── BPM tap ────────────────────────────────────────────────────────────────
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);

  // ── Timer ──────────────────────────────────────────────────────────────────
  const [timerDuration, setTimerDuration] = useState(0);
  const [timerRemaining, setTimerRemaining] = useState(0);

  // ── Session tracking ───────────────────────────────────────────────────────
  const sessionStartRef = useRef<number | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(false);
  const modeRef = useRef<Mode>('torch');

  // Sync refs
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ── Clamp Hz to remote config limits ──────────────────────────────────────
  const effectiveMaxHz = Math.min(MAX_HZ, config.maxHz);
  const effectiveMinHz = Math.max(MIN_HZ, config.minHz);

  // ── Strobe loop ────────────────────────────────────────────────────────────
  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleStrobe = useCallback(
    (currentlyOn: boolean, hzVal: number, dutyVal: number, modeVal: Mode) => {
      const period = 1000 / hzVal;
      const onTime = period * (dutyVal / 100);
      const offTime = period * (1 - dutyVal / 100);
      const delay = currentlyOn ? onTime : offTime;
      const nextOn = !currentlyOn;

      timeoutRef.current = setTimeout(() => {
        if (!isActiveRef.current) return;
        if (modeVal === 'screen' || modeVal === 'both') setStrobeVisible(nextOn);
        if (modeVal === 'torch' || modeVal === 'both') setTorchOn(nextOn);
        scheduleStrobe(nextOn, hzVal, dutyVal, modeVal);
      }, delay);
    },
    [],
  );

  // ── Main strobe effect ─────────────────────────────────────────────────────
  useEffect(() => {
    clearTimer();

    if (!isActive) {
      setTorchOn(false);
      setStrobeVisible(false);

      // Log session on stop
      if (sessionStartRef.current !== null) {
        const durationMs = Date.now() - sessionStartRef.current;
        sessionStartRef.current = null;
        if (durationMs > 500) {
          logSession({ timestamp: Date.now(), mode, hz, dutyCycle, color: screenColor, durationMs });
        }
      }
      return;
    }

    sessionStartRef.current = Date.now();

    // Turn on initial state
    if (mode === 'screen' || mode === 'both') setStrobeVisible(true);
    if (mode === 'torch' || mode === 'both') setTorchOn(true);

    scheduleStrobe(true, hz, dutyCycle, mode);

    return () => {
      clearTimer();
      setTorchOn(false);
      setStrobeVisible(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, hz, dutyCycle, mode]);

  // ── Timer countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || timerDuration === 0) {
      setTimerRemaining(0);
      return;
    }
    setTimerRemaining(timerDuration);
    const interval = setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev <= 1) {
          setIsActive(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, timerDuration]);

  // ── Toggle ─────────────────────────────────────────────────────────────────
  const handleToggle = async () => {
    if (!isActive && (mode === 'torch' || mode === 'both')) {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          Alert.alert(
            'Camera Permission Required',
            'Torch mode needs camera access. Grant permission in Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
          return;
        }
      }
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsActive((prev) => !prev);
  };

  const handleStop = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsActive(false);
  };

  // ── Hz controls ────────────────────────────────────────────────────────────
  const adjustHz = (delta: number) => {
    setHz((prev) => {
      const next = parseFloat((prev + delta).toFixed(1));
      const clamped = clamp(next, effectiveMinHz, effectiveMaxHz);
      setHzInput(clamped.toFixed(1));
      return clamped;
    });
  };

  const handleHzInputChange = (text: string) => {
    setHzInput(text);
  };

  const handleHzInputSubmit = () => {
    const parsed = parseFloat(hzInput);
    if (!isNaN(parsed)) {
      const clamped = clamp(parsed, effectiveMinHz, effectiveMaxHz);
      setHz(clamped);
      setHzInput(clamped.toFixed(1));
    } else {
      setHzInput(hz.toFixed(1));
    }
  };

  // ── Duty cycle controls ────────────────────────────────────────────────────
  const adjustDuty = (delta: number) => {
    setDutyCycle((prev) => clamp(prev + delta, MIN_DUTY, MAX_DUTY));
  };

  // ── Color controls ─────────────────────────────────────────────────────────
  const selectColor = (c: string) => {
    setScreenColor(c);
    setHexInput(c);
  };

  const handleHexInputSubmit = () => {
    const cleaned = hexInput.trim();
    const full = cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(full)) {
      setScreenColor(full);
      setHexInput(full);
    } else {
      setHexInput(screenColor);
    }
  };

  // ── BPM tap ────────────────────────────────────────────────────────────────
  const handleTap = () => {
    const now = Date.now();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTapTimes((prev) => {
      const updated = [...prev, now].slice(-8);
      if (updated.length >= 2) {
        const intervals = updated.slice(1).map((t, i) => t - updated[i]);
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const newBpm = Math.round(60000 / avg);
        setBpm(newBpm);
        const newHz = parseFloat((newBpm / 60).toFixed(1));
        const clamped = clamp(newHz, effectiveMinHz, effectiveMaxHz);
        setHz(clamped);
        setHzInput(clamped.toFixed(1));
      }
      return updated;
    });
    // Managed reset: cancel previous timer before scheduling a new one
    if (tapResetRef.current) clearTimeout(tapResetRef.current);
    tapResetRef.current = setTimeout(() => {
      tapResetRef.current = null;
      setTapTimes((prev) => {
        if (prev.length > 0 && Date.now() - prev[prev.length - 1] > 2800) {
          setBpm(null);
          return [];
        }
        return prev;
      });
    }, 3000);
  };

  // Cleanup tap reset timer on unmount
  useEffect(() => {
    return () => {
      if (tapResetRef.current) clearTimeout(tapResetRef.current);
    };
  }, []);

  // ── Styles ─────────────────────────────────────────────────────────────────
  const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: insets.top + 16,
      paddingBottom: insets.bottom + 100,
    },

    // Mode selector
    modeRow: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 4,
      marginBottom: 20,
      gap: 4,
    },
    modeBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: colors.radius - 4,
      alignItems: 'center',
    },
    modeBtnActive: { backgroundColor: colors.primary },
    modeBtnText: {
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
      letterSpacing: 1,
      color: colors.mutedForeground,
    },
    modeBtnTextActive: { color: colors.primaryForeground },

    // Power button
    powerWrap: { alignItems: 'center', marginBottom: 24 },
    powerRing: {
      width: 160,
      height: 160,
      borderRadius: 80,
      borderWidth: 3,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    powerRingActive: { borderColor: colors.primary, borderWidth: 4 },
    powerBtn: {
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    powerBtnActive: { backgroundColor: colors.primary },
    powerBtnLabel: {
      fontSize: 11,
      fontFamily: 'Inter_700Bold',
      letterSpacing: 2,
      color: colors.mutedForeground,
    },
    powerBtnLabelActive: { color: colors.primaryForeground },

    // Cards
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 12,
    },
    cardLabel: {
      fontSize: 10,
      fontFamily: 'Inter_600SemiBold',
      color: colors.mutedForeground,
      letterSpacing: 1.5,
      marginBottom: 12,
    },

    // Hz row
    hzRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    hzInput: {
      flex: 1,
      fontSize: 36,
      fontFamily: 'Inter_700Bold',
      color: colors.foreground,
      textAlign: 'center',
      backgroundColor: colors.muted,
      borderRadius: colors.radius - 4,
      paddingVertical: 8,
    },
    hzBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hzBtnText: {
      fontSize: 24,
      fontFamily: 'Inter_700Bold',
      color: colors.foreground,
      lineHeight: 30,
    },
    hzUnit: {
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: colors.mutedForeground,
      textAlign: 'center',
      marginTop: 4,
    },

    // Duty cycle
    dutyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dutyValue: {
      flex: 1,
      fontSize: 24,
      fontFamily: 'Inter_700Bold',
      color: colors.foreground,
      textAlign: 'center',
    },
    dutyBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dutyBtnText: { fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.foreground, lineHeight: 28 },

    // Color picker
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    colorSwatch: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorSwatchActive: { borderColor: colors.primary },
    hexInput: {
      flex: 1,
      height: 36,
      borderRadius: 8,
      backgroundColor: colors.muted,
      paddingHorizontal: 10,
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: colors.foreground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    colorPreview: {
      width: 36,
      height: 36,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },

    // BPM row
    bpmRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    tapBtn: {
      flex: 1,
      paddingVertical: 14,
      backgroundColor: colors.muted,
      borderRadius: colors.radius,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    tapBtnText: {
      fontSize: 14,
      fontFamily: 'Inter_700Bold',
      color: colors.foreground,
      letterSpacing: 1,
    },
    bpmDisplay: {
      alignItems: 'center',
      minWidth: 80,
    },
    bpmValue: { fontSize: 28, fontFamily: 'Inter_700Bold', color: colors.primary },
    bpmLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, letterSpacing: 1 },

    // Timer
    timerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    timerBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    timerBtnActive: { backgroundColor: colors.primary },
    timerBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground },
    timerBtnTextActive: { color: colors.primaryForeground },

    // Countdown
    countdown: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    countdownText: {
      fontSize: 20,
      fontFamily: 'Inter_700Bold',
      color: colors.primary,
    },
    countdownLabel: {
      fontSize: 11,
      fontFamily: 'Inter_500Medium',
      color: colors.mutedForeground,
      letterSpacing: 1,
    },

    // Announcement banner
    banner: {
      backgroundColor: colors.muted,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.primary,
      padding: 12,
      marginBottom: 12,
    },
    bannerText: {
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: colors.foreground,
    },

    // Permission banner
    permBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      padding: 14,
      alignItems: 'center',
      marginBottom: 12,
    },
    permBtnText: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: colors.primaryForeground,
    },

    // Screen overlay overlay stop hint
    stopHint: {
      position: 'absolute',
      bottom: insets.bottom + 40,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    stopHintText: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
    },
  });

  const needsCameraForMode = mode === 'torch' || mode === 'both';
  const cameraGranted = permission?.granted ?? false;

  const showAnnouncement = config.announcement && !isActive;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      {/* Hidden camera for torch control */}
      {needsCameraForMode && cameraGranted && (
        <CameraView
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
          enableTorch={torchOn}
        />
      )}

      {/* ── Screen strobe overlay ──────────────────────────────────────── */}
      {isActive && (mode === 'screen' || mode === 'both') && (
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            {
              zIndex: 100,
              backgroundColor: strobeVisible ? screenColor : '#000000',
            },
          ]}
          onPress={handleStop}
        >
          {/* Subtle stop hint */}
          <View style={s.stopHint}>
            <Text style={s.stopHintText}>Tap to stop</Text>
          </View>
        </Pressable>
      )}

      {/* ── Main UI ───────────────────────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Announcement banner */}
        {showAnnouncement && (
          <View style={s.banner}>
            <Text style={s.bannerText}>{config.announcement}</Text>
          </View>
        )}

        {/* Camera permission prompt */}
        {needsCameraForMode && !cameraGranted && (
          <Pressable style={s.permBtn} onPress={requestPermission}>
            <Text style={s.permBtnText}>Grant Camera Access for Torch</Text>
          </Pressable>
        )}

        {/* Mode selector */}
        <View style={s.modeRow}>
          {(['screen', 'torch', 'both'] as Mode[]).map((m) => {
            const labels: Record<Mode, string> = { screen: 'SCREEN', torch: 'TORCH', both: 'BOTH' };
            const active = mode === m;
            return (
              <Pressable
                key={m}
                style={[s.modeBtn, active && s.modeBtnActive]}
                onPress={() => {
                  if (isActive) setIsActive(false);
                  setMode(m);
                  Haptics.selectionAsync();
                }}
              >
                <Text style={[s.modeBtnText, active && s.modeBtnTextActive]}>{labels[m]}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Power button */}
        <View style={s.powerWrap}>
          <View style={[s.powerRing, isActive && s.powerRingActive]}>
            <Pressable
              style={[s.powerBtn, isActive && s.powerBtnActive]}
              onPress={handleToggle}
            >
              <Text style={{ fontSize: 48 }}>⚡</Text>
              <Text style={[s.powerBtnLabel, isActive && s.powerBtnLabelActive]}>
                {isActive ? 'STOP' : 'START'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Hz control */}
        <View style={s.card}>
          <Text style={s.cardLabel}>FREQUENCY</Text>
          <View style={s.hzRow}>
            <Pressable style={s.hzBtn} onPress={() => adjustHz(-0.5)}>
              <Text style={s.hzBtnText}>−</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <TextInput
                style={s.hzInput}
                value={hzInput}
                onChangeText={handleHzInputChange}
                onBlur={handleHzInputSubmit}
                onSubmitEditing={handleHzInputSubmit}
                keyboardType="decimal-pad"
                selectTextOnFocus
                returnKeyType="done"
              />
              <Text style={s.hzUnit}>
                Hz · {effectiveMinHz}–{effectiveMaxHz} Hz{bpm ? ` · ${bpm} BPM` : ''}
              </Text>
            </View>
            <Pressable style={s.hzBtn} onPress={() => adjustHz(0.5)}>
              <Text style={s.hzBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        {/* Duty cycle */}
        <View style={s.card}>
          <Text style={s.cardLabel}>DUTY CYCLE</Text>
          <View style={s.dutyRow}>
            <Pressable style={s.dutyBtn} onPress={() => adjustDuty(-5)}>
              <Text style={s.dutyBtnText}>−</Text>
            </Pressable>
            <Text style={s.dutyValue}>{dutyCycle}%</Text>
            <Pressable style={s.dutyBtn} onPress={() => adjustDuty(5)}>
              <Text style={s.dutyBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        {/* Screen color (only for screen/both modes) */}
        {(mode === 'screen' || mode === 'both') && config.features.customColors && (
          <View style={s.card}>
            <Text style={s.cardLabel}>SCREEN COLOR</Text>
            <View style={s.colorRow}>
              {PRESET_COLORS.map((c) => (
                <Pressable
                  key={c}
                  style={[s.colorSwatch, { backgroundColor: c }, screenColor === c && s.colorSwatchActive]}
                  onPress={() => { selectColor(c); Haptics.selectionAsync(); }}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
              <View style={[s.colorPreview, { backgroundColor: screenColor }]} />
              <TextInput
                style={s.hexInput}
                value={hexInput}
                onChangeText={setHexInput}
                onBlur={handleHexInputSubmit}
                onSubmitEditing={handleHexInputSubmit}
                placeholder="#ffffff"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                returnKeyType="done"
              />
            </View>
          </View>
        )}

        {/* BPM tap */}
        {config.features.bpmTap && (
          <View style={s.card}>
            <Text style={s.cardLabel}>BPM TAP</Text>
            <View style={s.bpmRow}>
              <Pressable style={s.tapBtn} onPress={handleTap}>
                <Text style={s.tapBtnText}>TAP BEAT</Text>
              </Pressable>
              <View style={s.bpmDisplay}>
                <Text style={s.bpmValue}>{bpm ?? '--'}</Text>
                <Text style={s.bpmLabel}>BPM</Text>
              </View>
            </View>
          </View>
        )}

        {/* Timer */}
        {config.features.timer && (
          <View style={s.card}>
            <Text style={s.cardLabel}>AUTO-STOP TIMER</Text>
            <View style={s.timerRow}>
              {TIMER_OPTIONS.map((opt) => {
                const active = timerDuration === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[s.timerBtn, active && s.timerBtnActive]}
                    onPress={() => { setTimerDuration(opt.value); Haptics.selectionAsync(); }}
                  >
                    <Text style={[s.timerBtnText, active && s.timerBtnTextActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {isActive && timerDuration > 0 && timerRemaining > 0 && (
              <View style={s.countdown}>
                <Text style={s.countdownText}>{timerRemaining}s</Text>
                <Text style={s.countdownLabel}>REMAINING</Text>
              </View>
            )}
          </View>
        )}

        {/* Stats row */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.card,
            borderRadius: colors.radius,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            marginBottom: 12,
          }}
        >
          {[
            { label: 'HZ', value: hz.toFixed(1) },
            { label: 'DUTY', value: `${dutyCycle}%` },
            { label: 'PERIOD', value: `${(1000 / hz).toFixed(0)}ms` },
          ].map((stat, idx, arr) => (
            <React.Fragment key={stat.label}>
              <View style={{ flex: 1, paddingVertical: 14, alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: isActive ? colors.primary : colors.foreground }}>
                  {stat.value}
                </Text>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, letterSpacing: 1 }}>
                  {stat.label}
                </Text>
              </View>
              {idx < arr.length - 1 && (
                <View style={{ width: 1, backgroundColor: colors.border }} />
              )}
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
