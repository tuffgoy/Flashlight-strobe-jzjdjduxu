/**
 * Sound Sync screen
 *
 * Two modes:
 *
 *  MIC SYNC  — uses the device microphone to detect loud beats/claps and
 *               triggers a single torch + screen flash on each detected peak.
 *
 *  MUSIC SYNC — you pick a local audio file, the app plays it through the
 *               speaker, and the microphone beat-detection triggers flashes
 *               in sync.  The existing sensitivity slider tunes how easily
 *               beats are detected from the speaker output.
 *
 * Adjustable threshold lets the user dial in sensitivity.
 * Vibration ("click sound") provides tactile feedback on each beat.
 */

import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
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

const HOLD_OFF_MS = 150;
const FLASH_MS = 80;

type SyncMode = "mic" | "music";

export default function SoundScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [permission, requestPermission] = useCameraPermissions();
  const [micGranted, setMicGranted] = useState(false);
  const [syncMode, setSyncMode] = useState<SyncMode>("mic");
  const [isListening, setIsListening] = useState(false);
  const [threshold, setThreshold] = useState(65);
  const [clickEnabled, setClickEnabled] = useState(true);
  const [lastBeatTime, setLastBeatTime] = useState<number | null>(null);
  const [beatCount, setBeatCount] = useState(0);

  // Music Sync state
  const [musicName, setMusicName] = useState<string | null>(null);
  const [musicUri, setMusicUri] = useState<string | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicLoading, setMusicLoading] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const torchRef = useRef<TorchCameraHandle>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdOffRef = useRef(false);

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

    torchRef.current?.setTorch(true);
    if (Platform.OS === "web") flashAnim.setValue(1);
    if (clickEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    setBeatCount((prev) => prev + 1);
    setLastBeatTime(Date.now());

    setTimeout(() => {
      torchRef.current?.setTorch(false);
      if (Platform.OS === "web") flashAnim.setValue(0);
      setTimeout(() => { holdOffRef.current = false; }, HOLD_OFF_MS);
    }, FLASH_MS);
  }, [clickEnabled, flashAnim]);

  function sensitivityToDb(s: number): number {
    return -10 - (s / 100) * 50;
  }

  // ── Music Sync — file picker & playback ──────────────────────────────────

  const handlePickMusic = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      // Stop any currently playing music first
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
        setMusicPlaying(false);
      }
      setMusicUri(asset.uri);
      setMusicName(asset.name ?? "Audio file");
    } catch {
      // User cancelled — ignore
    }
  }, []);

  const handlePlayMusic = useCallback(async () => {
    if (!musicUri) return;
    setMusicLoading(true);
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: true, // must stay true so mic recording works simultaneously
        staysActiveInBackground: false,
      }).catch(() => {});
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: musicUri });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) setMusicPlaying(false);
      });
      await sound.playAsync();
      setMusicPlaying(true);
    } catch {
      soundRef.current = null;
      setMusicPlaying(false);
    } finally {
      setMusicLoading(false);
    }
  }, [musicUri]);

  const handleStopMusic = useCallback(async () => {
    const s = soundRef.current;
    soundRef.current = null;
    setMusicPlaying(false);
    if (s) {
      await s.stopAsync().catch(() => {});
      await s.unloadAsync().catch(() => {});
    }
  }, []);

  useEffect(() => {
    return () => {
      const s = soundRef.current;
      if (s) { s.stopAsync().catch(() => {}); s.unloadAsync().catch(() => {}); }
    };
  }, []);

  // ── Listening engine ──────────────────────────────────────────────────────

  const startListening = useCallback(async () => {
    let granted = micGranted;
    if (!granted) granted = await requestMicPermission();
    if (!granted) return;

    await KeepAwake.activateKeepAwakeAsync().catch(() => {});

    let recordingStarted = false;
    const recording = new Audio.Recording();
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        // Keep speaker output active in Music Sync mode so audio plays
        staysActiveInBackground: false,
      });
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
      KeepAwake.deactivateKeepAwake();
      if (!recordingStarted) recording.stopAndUnloadAsync().catch(() => {});
      return;
    }

    const dbThreshold = sensitivityToDb(threshold);
    let statusPending = false;

    pollRef.current = setInterval(async () => {
      const rec = recordingRef.current;
      if (!rec || statusPending) return;
      statusPending = true;
      try {
        const status = await rec.getStatusAsync();
        if (status.isRecording && typeof status.metering === "number") {
          if (status.metering >= dbThreshold) triggerFlash();
        }
      } catch {
        // ignore
      } finally {
        statusPending = false;
      }
    }, 40);

    setIsListening(true);
  }, [micGranted, requestMicPermission, threshold, triggerFlash]);

  const stopListening = useCallback(async () => {
    setIsListening(false);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (rec) { try { await rec.stopAndUnloadAsync(); } catch {} }
    torchRef.current?.setTorch(false);
    if (Platform.OS === "web") flashAnim.setValue(0);
    KeepAwake.deactivateKeepAwake();
  }, [flashAnim]);

  // Stop listening when switching modes
  useEffect(() => {
    if (isListening) stopListening().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncMode]);

  useEffect(() => {
    return () => { stopListening().catch(() => {}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const styles = makeStyles(colors, insets);
  const adjustThreshold = (d: number) =>
    setThreshold((prev) => Math.max(0, Math.min(100, prev + d)));

  return (
    <View style={styles.root}>
      {Platform.OS === "web" && (
        <Animated.View pointerEvents="none" style={[styles.flashOverlay, { opacity: flashAnim }]} />
      )}

      <TorchCamera ref={torchRef} permissionGranted={permission?.granted ?? false} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>{t.sound}</Text>

        {/* ── Mode selector ─────────────────────────────────────── */}
        <View style={styles.segmentedControl}>
          {(["mic", "music"] as SyncMode[]).map((mode) => (
            <Pressable
              key={mode}
              style={[styles.segBtn, syncMode === mode && styles.segBtnActive]}
              onPress={() => setSyncMode(mode)}
            >
              <Text style={styles.segIcon}>{mode === "mic" ? "🎤" : "🎵"}</Text>
              <Text style={[styles.segLabel, syncMode === mode && styles.segLabelActive]}>
                {mode === "mic" ? "Mic Sync" : "Music Sync"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── MUSIC SYNC section ─────────────────────────────────── */}
        {syncMode === "music" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>MUSIC SYNC</Text>
            <Text style={styles.hintText}>
              Load a song and play it — the mic will detect beats from the speaker and flash automatically.
              Adjust sensitivity below to tune the detection.
            </Text>

            <Pressable style={styles.musicPickBtn} onPress={handlePickMusic}>
              <Text style={styles.musicPickIcon}>🎵</Text>
              <Text style={styles.musicPickLabel}>
                {musicName ? "Change Song" : "Load Song"}
              </Text>
            </Pressable>

            {musicName && (
              <View style={styles.musicRow}>
                <View style={styles.musicInfo}>
                  <Text style={styles.musicTrackName} numberOfLines={1}>{musicName}</Text>
                  <Text style={styles.hintText}>{musicPlaying ? "Playing…" : "Ready to play"}</Text>
                </View>
                <View style={styles.musicControls}>
                  {!musicPlaying ? (
                    <Pressable
                      style={[styles.musicBtn, styles.musicBtnPlay, musicLoading && { opacity: 0.5 }]}
                      onPress={handlePlayMusic}
                      disabled={musicLoading}
                    >
                      <Text style={styles.musicBtnText}>{musicLoading ? "…" : "▶"}</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={[styles.musicBtn, styles.musicBtnStop]} onPress={handleStopMusic}>
                      <Text style={styles.musicBtnText}>■</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {musicPlaying && (
              <View style={styles.musicHint}>
                <View style={styles.musicHintDot} />
                <Text style={styles.hintText}>
                  Tap Start below — the mic detects beats from the speaker
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Big toggle ────────────────────────────────────────── */}
        <Pressable
          style={[styles.bigToggle, isListening && styles.bigToggleActive]}
          onPress={isListening ? stopListening : startListening}
        >
          <Text style={styles.bigToggleIcon}>
            {syncMode === "music" ? (isListening ? "🎵" : "🎵") : (isListening ? "🎙️" : "🎤")}
          </Text>
          <Text style={[styles.bigToggleLabel, isListening && styles.bigToggleLabelActive]}>
            {isListening ? t.on : t.off}
          </Text>
        </Pressable>

        {/* Status */}
        {isListening && (
          <View style={styles.statusCard}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {syncMode === "music" && musicPlaying
                ? "Listening for beats from music…"
                : t.waitingForBeat}
            </Text>
            {lastBeatTime && <Text style={styles.beatCount}>{beatCount}</Text>}
          </View>
        )}

        {/* ── Sensitivity ───────────────────────────────────────── */}
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
              ? "Low — only very loud beats trigger"
              : threshold < 60
              ? "Medium — normal beats and claps"
              : "High — triggers on quieter sounds too"}
          </Text>
        </View>

        {/* ── Click / vibrate toggle ─────────────────────────────── */}
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

        {/* ── Mic info ──────────────────────────────────────────── */}
        {syncMode === "mic" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.micSync}</Text>
            <Text style={styles.hintText}>{t.micSyncSub}</Text>
          </View>
        )}

        {/* Permission prompts */}
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
      fontSize: 10, fontFamily: "Inter_700Bold",
      color: colors.mutedForeground, letterSpacing: 3, alignSelf: "flex-start",
    },
    // Mode toggle
    segmentedControl: {
      width: "100%", flexDirection: "row",
      backgroundColor: colors.muted, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    segBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      paddingVertical: 12, gap: 6,
    },
    segBtnActive: { backgroundColor: colors.card },
    segIcon: { fontSize: 16 },
    segLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground },
    segLabelActive: { color: colors.foreground },
    // Music sync card
    card: {
      width: "100%", backgroundColor: colors.card,
      borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 10,
    },
    cardTitle: {
      fontSize: 10, fontFamily: "Inter_700Bold",
      color: colors.mutedForeground, letterSpacing: 2,
    },
    musicPickBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, paddingVertical: 12,
      backgroundColor: colors.muted, borderRadius: colors.radius - 2,
      borderWidth: 1, borderColor: colors.border,
    },
    musicPickIcon: { fontSize: 18 },
    musicPickLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    musicRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: colors.muted, borderRadius: colors.radius - 2,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 12, paddingVertical: 10,
    },
    musicInfo: { flex: 1, gap: 2 },
    musicTrackName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    musicControls: { flexDirection: "row", gap: 8 },
    musicBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    musicBtnPlay: { backgroundColor: colors.primary },
    musicBtnStop: { backgroundColor: "#ef4444" },
    musicBtnText: { fontSize: 16, color: "#fff", fontFamily: "Inter_700Bold" },
    musicHint: {
      flexDirection: "row", alignItems: "center", gap: 8,
    },
    musicHintDot: {
      width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e",
    },
    // Existing styles
    bigToggle: {
      width: 150, height: 150, borderRadius: 75,
      backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border,
      alignItems: "center", justifyContent: "center", gap: 4, marginVertical: 8,
    },
    bigToggleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    bigToggleIcon: { fontSize: 40 },
    bigToggleLabel: {
      fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground, letterSpacing: 2,
    },
    bigToggleLabelActive: { color: colors.primaryForeground },
    statusCard: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border, padding: 14, width: "100%",
    },
    statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22c55e" },
    statusText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground },
    beatCount: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.primary },
    bigVal: { fontSize: 36, fontFamily: "Inter_700Bold", color: colors.foreground },
    hintText: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    sliderTrack: {
      width: "100%", height: 4, backgroundColor: colors.muted,
      borderRadius: 2, overflow: "hidden",
    },
    sliderFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 2 },
    adjRow: { flexDirection: "row", gap: 6 },
    adjBtn: {
      paddingHorizontal: 10, paddingVertical: 8,
      backgroundColor: colors.muted, borderRadius: colors.radius - 2,
      borderWidth: 1, borderColor: colors.border, minWidth: 40, alignItems: "center",
    },
    adjBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    toggleRow: { flexDirection: "row", alignItems: "center" },
    toggle: {
      width: 48, height: 28, borderRadius: 14,
      backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border,
      justifyContent: "center", paddingHorizontal: 2,
    },
    toggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.mutedForeground },
    toggleKnobOn: { alignSelf: "flex-end", backgroundColor: colors.primaryForeground },
    permBtn: {
      width: "100%", paddingVertical: 14,
      backgroundColor: colors.primary, borderRadius: colors.radius, alignItems: "center",
    },
    permBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.primaryForeground },
  });
}
