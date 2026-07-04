/**
 * Patterns screen — predefined + user-created strobe sequences.
 *
 * Each pattern runs a sequence of { on, ms } steps in a recursive
 * setTimeout loop (patterns have uneven timings, so setInterval
 * doesn't fit here).
 *
 * New: wake lock keeps screen on while a pattern plays.
 * New: custom pattern editor lets users add their own sequences.
 */

import { useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as KeepAwake from "expo-keep-awake";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TorchCamera, TorchCameraHandle } from "@/components/TorchCamera";
import { useLanguage } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";

interface PatternStep { on: boolean; ms: number }
interface Pattern {
  id: string;
  name: string;
  description: string;
  sequence: PatternStep[];
  color: string;
  custom?: boolean;
}

const CUSTOM_PATTERNS_KEY = "@strobe_custom_patterns";

const BUILTIN_PATTERNS: Pattern[] = [
  {
    id: "sos", name: "SOS", color: "#ef4444",
    description: "International distress signal · · · — — — · · ·",
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
    id: "police", name: "Police", color: "#3b82f6",
    description: "Emergency rapid alternating flash",
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
    id: "heartbeat", name: "Heartbeat", color: "#ec4899",
    description: "Double pulse rhythm, like a heartbeat",
    sequence: [
      { on: true, ms: 80 }, { on: false, ms: 80 },
      { on: true, ms: 80 }, { on: false, ms: 700 },
    ],
  },
  {
    id: "party", name: "Party", color: "#a855f7",
    description: "Rapid random burst for strobe effect",
    sequence: [
      { on: true, ms: 40 }, { on: false, ms: 40 },
      { on: true, ms: 80 }, { on: false, ms: 60 },
      { on: true, ms: 40 }, { on: false, ms: 120 },
      { on: true, ms: 60 }, { on: false, ms: 40 },
      { on: true, ms: 40 }, { on: false, ms: 80 },
    ],
  },
  {
    id: "morse_help", name: "HELP", color: "#f59e0b",
    description: "Morse code for H-E-L-P",
    sequence: [
      { on: true, ms: 120 }, { on: false, ms: 100 },
      { on: true, ms: 120 }, { on: false, ms: 100 },
      { on: true, ms: 120 }, { on: false, ms: 100 },
      { on: true, ms: 120 }, { on: false, ms: 300 },
      { on: true, ms: 120 }, { on: false, ms: 300 },
      { on: true, ms: 120 }, { on: false, ms: 100 },
      { on: true, ms: 360 }, { on: false, ms: 100 },
      { on: true, ms: 120 }, { on: false, ms: 100 },
      { on: true, ms: 120 }, { on: false, ms: 300 },
      { on: true, ms: 120 }, { on: false, ms: 100 },
      { on: true, ms: 360 }, { on: false, ms: 100 },
      { on: true, ms: 360 }, { on: false, ms: 100 },
      { on: true, ms: 120 }, { on: false, ms: 800 },
    ],
  },
  {
    id: "slow_wave", name: "Slow Wave", color: "#22c55e",
    description: "Gentle 1Hz rhythmic flash",
    sequence: [{ on: true, ms: 300 }, { on: false, ms: 700 }],
  },
  {
    id: "rapid_fire", name: "Rapid Fire", color: "#f97316",
    description: "High-speed continuous burst at ~25Hz",
    sequence: [{ on: true, ms: 20 }, { on: false, ms: 20 }],
  },
  {
    id: "club_strobe", name: "Club Strobe", color: "#8b5cf6",
    description: "Classic club strobe at ~10Hz",
    sequence: [{ on: true, ms: 50 }, { on: false, ms: 50 }],
  },
];

const STEP_COLORS = ["#ef4444","#f97316","#f59e0b","#22c55e","#3b82f6","#8b5cf6","#ec4899","#06b6d4"];

export default function PatternsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [permission, requestPermission] = useCameraPermissions();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [customPatterns, setCustomPatterns] = useState<Pattern[]>([]);

  // Custom pattern editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSteps, setEditSteps] = useState<PatternStep[]>([
    { on: true, ms: 200 }, { on: false, ms: 200 },
  ]);

  const torchRef = useRef<TorchCameraHandle>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allPatterns = [...BUILTIN_PATTERNS, ...customPatterns];

  // Load custom patterns from storage
  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_PATTERNS_KEY)
      .then((raw) => raw ? setCustomPatterns(JSON.parse(raw)) : null)
      .catch(() => {});
  }, []);

  // Camera permission on mount
  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain !== false) {
      requestPermission().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wake lock
  useEffect(() => {
    if (activeId) {
      KeepAwake.activateKeepAwakeAsync().catch(() => {});
    } else {
      KeepAwake.deactivateKeepAwake();
    }
  }, [activeId]);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  const runSequence = useCallback((pattern: Pattern, idx: number) => {
    const step = pattern.sequence[idx];
    torchRef.current?.setTorch(step.on);
    if (Platform.OS === "web") {
      Animated.timing(flashAnim, { toValue: step.on ? 1 : 0, duration: 8, useNativeDriver: true }).start();
    }
    timeoutRef.current = setTimeout(() => {
      runSequence(pattern, (idx + 1) % pattern.sequence.length);
    }, step.ms);
  }, [flashAnim]);

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

  const saveCustomPattern = async () => {
    if (!editName.trim() || editSteps.length === 0) return;
    const newPattern: Pattern = {
      id: `custom_${Date.now()}`,
      name: editName.trim(),
      description: editSteps.map((s) => `${s.on ? "ON" : "OFF"} ${s.ms}ms`).join(" → "),
      sequence: editSteps,
      color: STEP_COLORS[customPatterns.length % STEP_COLORS.length],
      custom: true,
    };
    const updated = [...customPatterns, newPattern];
    setCustomPatterns(updated);
    await AsyncStorage.setItem(CUSTOM_PATTERNS_KEY, JSON.stringify(updated)).catch(() => {});
    setEditorOpen(false);
    setEditName("");
    setEditSteps([{ on: true, ms: 200 }, { on: false, ms: 200 }]);
  };

  const deleteCustomPattern = (id: string) => {
    Alert.alert(t.customPatternDelete, "Remove this pattern?", [
      { text: t.cancel, style: "cancel" },
      {
        text: t.customPatternDelete,
        style: "destructive",
        onPress: async () => {
          if (activeId === id) { clearTimer(); setActiveId(null); torchRef.current?.setTorch(false); }
          const updated = customPatterns.filter((p) => p.id !== id);
          setCustomPatterns(updated);
          await AsyncStorage.setItem(CUSTOM_PATTERNS_KEY, JSON.stringify(updated)).catch(() => {});
        },
      },
    ]);
  };

  const addStep = (on: boolean) => {
    setEditSteps((prev) => [...prev, { on, ms: 200 }]);
  };

  const updateStepMs = (i: number, ms: number) => {
    setEditSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, ms: Math.max(20, ms) } : s));
  };

  const removeStep = (i: number) => {
    setEditSteps((prev) => prev.filter((_, idx) => idx !== i));
  };

  useEffect(() => {
    return () => { clearTimer(); torchRef.current?.setTorch(false); };
  }, [clearTimer]);

  const activePattern = allPatterns.find((p) => p.id === activeId);
  const s = makeStyles(colors, insets);

  return (
    <View style={s.root}>
      {Platform.OS === "web" && (
        <Animated.View
          pointerEvents="none"
          style={[s.flashOverlay, { opacity: flashAnim, backgroundColor: activePattern?.color ?? "#fff" }]}
        />
      )}
      <TorchCamera ref={torchRef} permissionGranted={permission?.granted ?? false} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.sectionTitle}>{t.patterns}</Text>

        {activeId && (
          <View style={[s.activeCard, { borderColor: activePattern?.color }]}>
            <View style={[s.activeDot, { backgroundColor: activePattern?.color }]} />
            <Text style={[s.activeName, { color: activePattern?.color }]}>
              {activePattern?.name} · {t.active}
            </Text>
          </View>
        )}

        {/* Built-in + custom patterns */}
        <View style={s.grid}>
          {allPatterns.map((pattern) => {
            const isActive = activeId === pattern.id;
            return (
              <Pressable
                key={pattern.id}
                style={[s.card, isActive && { borderColor: pattern.color, borderWidth: 2 }]}
                onPress={() => handleSelect(pattern)}
              >
                <View style={[s.colorDot, { backgroundColor: pattern.color }]} />
                <Text style={s.patternName}>{pattern.name}</Text>
                <Text style={s.patternDesc}>{pattern.description}</Text>
                {isActive && (
                  <View style={[s.badge, { backgroundColor: pattern.color }]}>
                    <Text style={s.badgeText}>{t.active}</Text>
                  </View>
                )}
                {pattern.custom && (
                  <Pressable
                    style={s.deleteBtn}
                    onPress={() => deleteCustomPattern(pattern.id)}
                  >
                    <Text style={s.deleteBtnText}>✕</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* ── Custom pattern editor ───────────────────────────────── */}
        {!editorOpen ? (
          <Pressable style={s.addBtn} onPress={() => setEditorOpen(true)}>
            <Text style={s.addBtnText}>+ {t.addCustom}</Text>
          </Pressable>
        ) : (
          <View style={s.editor}>
            <Text style={s.editorTitle}>{t.addCustom}</Text>

            <TextInput
              style={s.nameInput}
              value={editName}
              onChangeText={setEditName}
              placeholder={t.customPatternName}
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={s.stepListTitle}>{t.customPatternAddStep}</Text>

            {editSteps.map((step, i) => (
              <View key={i} style={s.stepRow}>
                <View style={[s.stepOnDot, { backgroundColor: step.on ? "#22c55e" : "#ef4444" }]} />
                <Text style={s.stepLabel}>{step.on ? t.flashOn : t.flashOff}</Text>
                <TextInput
                  style={s.msInput}
                  value={String(step.ms)}
                  onChangeText={(v) => updateStepMs(i, parseInt(v) || 200)}
                  keyboardType="numeric"
                  placeholderTextColor={colors.mutedForeground}
                />
                <Text style={s.msLabel}>ms</Text>
                <Pressable onPress={() => removeStep(i)} style={s.removeStepBtn}>
                  <Text style={s.removeStepText}>✕</Text>
                </Pressable>
              </View>
            ))}

            <View style={s.addStepRow}>
              <Pressable style={[s.addStepBtn, { backgroundColor: "#22c55e" }]} onPress={() => addStep(true)}>
                <Text style={s.addStepBtnText}>+ {t.flashOn}</Text>
              </Pressable>
              <Pressable style={[s.addStepBtn, { backgroundColor: "#ef4444" }]} onPress={() => addStep(false)}>
                <Text style={s.addStepBtnText}>+ {t.flashOff}</Text>
              </Pressable>
            </View>

            <View style={s.editorActions}>
              <Pressable style={[s.editorBtn, s.editorBtnPrimary]} onPress={saveCustomPattern}>
                <Text style={[s.editorBtnText, s.editorBtnTextPrimary]}>{t.customPatternSave}</Text>
              </Pressable>
              <Pressable style={s.editorBtn} onPress={() => setEditorOpen(false)}>
                <Text style={s.editorBtnText}>{t.customPatternCancel}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {Platform.OS !== "web" && !permission?.granted && (
          <Pressable style={s.permBtn} onPress={() => requestPermission()}>
            <Text style={s.permBtnText}>{t.grantPermission}</Text>
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
    scroll: { paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100, gap: 16 },
    sectionTitle: { fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 3 },
    activeCard: {
      flexDirection: "row", alignItems: "center", gap: 8, padding: 12,
      borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.card,
    },
    activeDot: { width: 10, height: 10, borderRadius: 5 },
    activeName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    grid: { gap: 12 },
    card: {
      backgroundColor: colors.card, borderRadius: colors.radius, padding: 20,
      borderWidth: 1, borderColor: colors.border, gap: 6, position: "relative",
    },
    colorDot: { width: 14, height: 14, borderRadius: 7, marginBottom: 4 },
    patternName: { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.foreground },
    patternDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    badge: { position: "absolute", top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1 },
    deleteBtn: { position: "absolute", top: 12, right: 12, padding: 6 },
    deleteBtnText: { fontSize: 14, color: colors.mutedForeground },
    addBtn: {
      width: "100%", paddingVertical: 16,
      backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border,
      alignItems: "center",
    },
    addBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.primary },
    editor: {
      width: "100%", backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12,
    },
    editorTitle: { fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 2 },
    nameInput: {
      backgroundColor: colors.muted, borderRadius: 8, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground,
    },
    stepListTitle: { fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 2 },
    stepRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    stepOnDot: { width: 10, height: 10, borderRadius: 5 },
    stepLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground },
    msInput: {
      width: 70, backgroundColor: colors.muted, borderRadius: 6, borderWidth: 1,
      borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 6,
      fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, textAlign: "center",
    },
    msLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    removeStepBtn: { padding: 4 },
    removeStepText: { fontSize: 14, color: "#ef4444" },
    addStepRow: { flexDirection: "row", gap: 8 },
    addStepBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
    addStepBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
    editorActions: { flexDirection: "row", gap: 10 },
    editorBtn: {
      flex: 1, paddingVertical: 12, borderRadius: 8,
      backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border,
      alignItems: "center",
    },
    editorBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
    editorBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    editorBtnTextPrimary: { color: colors.primaryForeground },
    permBtn: { paddingVertical: 14, backgroundColor: colors.primary, borderRadius: colors.radius, alignItems: "center" },
    permBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.primaryForeground },
  });
}
