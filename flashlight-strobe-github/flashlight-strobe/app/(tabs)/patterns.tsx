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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRemoteConfig } from '@/context/RemoteConfigContext';
import { useColors } from '@/hooks/useColors';
import { useLogger } from '@/hooks/useLogger';

// ─── Pattern definitions ──────────────────────────────────────────────────────
interface Pattern {
  id: string;
  name: string;
  description: string;
  sequence: Array<{ on: boolean; ms: number }>;
  color: string;
  emoji: string;
}

const BUILT_IN_PATTERNS: Pattern[] = [
  {
    id: 'sos',
    name: 'SOS',
    description: 'International distress signal · · · — — — · · ·',
    color: '#ef4444',
    emoji: '🆘',
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
    id: 'police',
    name: 'Police',
    description: 'Emergency rapid alternating flash',
    color: '#3b82f6',
    emoji: '🚔',
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
    id: 'heartbeat',
    name: 'Heartbeat',
    description: 'Double pulse rhythm like a heartbeat',
    color: '#ec4899',
    emoji: '❤️',
    sequence: [
      { on: true, ms: 80 }, { on: false, ms: 80 },
      { on: true, ms: 80 }, { on: false, ms: 700 },
    ],
  },
  {
    id: 'party',
    name: 'Party',
    description: 'Rapid randomized burst for strobe effect',
    color: '#a855f7',
    emoji: '🎉',
    sequence: [
      { on: true, ms: 40 }, { on: false, ms: 40 },
      { on: true, ms: 80 }, { on: false, ms: 60 },
      { on: true, ms: 40 }, { on: false, ms: 120 },
      { on: true, ms: 60 }, { on: false, ms: 40 },
      { on: true, ms: 40 }, { on: false, ms: 80 },
    ],
  },
  {
    id: 'morse_help',
    name: 'HELP',
    description: 'Morse code for H-E-L-P',
    color: '#f59e0b',
    emoji: '📡',
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
    id: 'slow_wave',
    name: 'Slow Wave',
    description: 'Gentle 1 Hz rhythmic flash',
    color: '#22c55e',
    emoji: '🌊',
    sequence: [
      { on: true, ms: 300 }, { on: false, ms: 700 },
    ],
  },
  {
    id: 'lightning',
    name: 'Lightning',
    description: 'Fast triple burst with gap — feels electric',
    color: '#FFD700',
    emoji: '⚡',
    sequence: [
      { on: true, ms: 30 }, { on: false, ms: 30 },
      { on: true, ms: 30 }, { on: false, ms: 30 },
      { on: true, ms: 30 }, { on: false, ms: 600 },
    ],
  },
  {
    id: 'camera',
    name: 'Camera Flash',
    description: 'Single pop every 2 seconds — photo effect',
    color: '#94a3b8',
    emoji: '📸',
    sequence: [
      { on: true, ms: 80 }, { on: false, ms: 1920 },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function PatternsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const { config } = useRemoteConfig();
  const { logSession } = useLogger();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);

  const seqRef = useRef<{ pattern: Pattern; idx: number } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const runStep = useCallback(() => {
    const ref = seqRef.current;
    if (!ref) return;
    const step = ref.pattern.sequence[ref.idx];
    setTorchOn(step.on);
    const nextIdx = (ref.idx + 1) % ref.pattern.sequence.length;
    seqRef.current = { ...ref, idx: nextIdx };
    timeoutRef.current = setTimeout(runStep, step.ms);
  }, []);

  const stopPattern = useCallback(() => {
    clearTimer();
    seqRef.current = null;
    setTorchOn(false);
    if (sessionStartRef.current !== null) {
      const durationMs = Date.now() - sessionStartRef.current;
      sessionStartRef.current = null;
      if (activeId && durationMs > 500) {
        logSession({
          timestamp: Date.now(),
          mode: 'torch',
          hz: 0,
          dutyCycle: 50,
          color: '#ffffff',
          durationMs,
          pattern: activeId,
        });
      }
    }
    setActiveId(null);
  }, [clearTimer, activeId, logSession]);

  const startPattern = useCallback(
    async (pattern: Pattern) => {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          Alert.alert(
            'Camera Permission Required',
            'Patterns need camera access for torch control.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ],
          );
          return;
        }
      }
      clearTimer();
      seqRef.current = { pattern, idx: 0 };
      sessionStartRef.current = Date.now();
      setActiveId(pattern.id);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      runStep();
    },
    [permission, requestPermission, clearTimer, runStep],
  );

  const handleTogglePattern = useCallback(
    async (pattern: Pattern) => {
      if (activeId === pattern.id) {
        stopPattern();
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        if (activeId) stopPattern();
        await startPattern(pattern);
      }
    },
    [activeId, stopPattern, startPattern],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      seqRef.current = null;
    };
  }, [clearTimer]);

  if (!config.features.patterns) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 15 }}>
          Patterns disabled by remote config
        </Text>
      </View>
    );
  }

  const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: 16,
      paddingTop: insets.top + 16,
      paddingBottom: insets.bottom + 100,
      gap: 10,
    },
    permBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      padding: 14,
      alignItems: 'center',
      marginBottom: 4,
    },
    permBtnText: {
      fontSize: 14,
      fontFamily: 'Inter_600SemiBold',
      color: colors.primaryForeground,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 6,
      position: 'relative',
    },
    cardActive: { borderColor: colors.primary, borderWidth: 2 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    patternName: { fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.foreground },
    patternDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    badge: {
      position: 'absolute',
      top: 12,
      right: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#ffffff', letterSpacing: 1 },
  });

  return (
    <View style={s.root}>
      {permission?.granted && (
        <CameraView
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
          enableTorch={torchOn}
        />
      )}

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {!permission?.granted && (
          <Pressable style={s.permBtn} onPress={requestPermission}>
            <Text style={s.permBtnText}>Grant Camera Access for Torch</Text>
          </Pressable>
        )}

        {BUILT_IN_PATTERNS.map((pattern) => {
          const isRunning = activeId === pattern.id;
          return (
            <Pressable
              key={pattern.id}
              style={[s.card, isRunning && s.cardActive]}
              onPress={() => handleTogglePattern(pattern)}
            >
              <View style={s.nameRow}>
                <View style={[s.dot, { backgroundColor: pattern.color }]} />
                <Text style={s.patternName}>{pattern.name}</Text>
              </View>
              <Text style={s.patternDesc}>{pattern.description}</Text>
              {isRunning && (
                <View style={[s.badge, { backgroundColor: pattern.color }]}>
                  <Text style={s.badgeText}>ACTIVE</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
