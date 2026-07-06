import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RemoteConfigProvider } from "@/context/RemoteConfigContext";
import { LanguageProvider } from "@/context/LanguageContext";
import {
  FullscreenFlashProvider,
  useFullscreenFlash,
} from "@/context/FullscreenFlashContext";

// ── App version (keep in sync with app.json) ─────────────────────────────────
const APP_VERSION = "1.4.0";

// ── Supabase REST API (read-only, no library needed) ─────────────────────────
const SUPABASE_URL = "https://vdprpaqlerngvcmzwcjg.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkcHJwYXFsZXJuZ3ZjbXp3Y2pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MzI3MjUsImV4cCI6MjA5NjMwODcyNX0.b9_PJEs3F8UH3qCK0bs-nUDvG81fBD0BP4Iec79C3-E";

const DISMISSED_VERSION_KEY = "flashlight_dismissed_update_version";
const FORCE_PROMPT_DISMISSED_KEY = "flashlight_force_prompt_dismissed_id";
const EPILEPSY_ACCEPTED_KEY = "@strobe_epilepsy_accepted";

interface UpdateInfo {
  version: string;
  url: string;
  notes?: string;
  forcePromptId?: string;
}

interface MinVersionInfo {
  minVersion: string;
  url: string;
}

async function fetchUpdateInfo(): Promise<{
  update: UpdateInfo | null;
  minVersionInfo: MinVersionInfo | null;
}> {
  const keys = [
    "flashlight_apk_version",
    "flashlight_apk_url",
    "flashlight_apk_notes",
    "flashlight_force_prompt",
    "flashlight_min_version",
  ];
  const filter = `key=in.(${keys.map((k) => `"${k}"`).join(",")})`;
  const url = `${SUPABASE_URL}/rest/v1/app_settings?${filter}&select=key,value`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) return { update: null, minVersionInfo: null };

  const rows = (await res.json()) as Array<{ key: string; value: string }>;
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  const update: UpdateInfo | null =
    map.flashlight_apk_version && map.flashlight_apk_url
      ? {
          version: map.flashlight_apk_version,
          url: map.flashlight_apk_url,
          notes: map.flashlight_apk_notes,
          forcePromptId: map.flashlight_force_prompt || undefined,
        }
      : null;

  const minVersionInfo: MinVersionInfo | null =
    map.flashlight_min_version && map.flashlight_apk_url
      ? { minVersion: map.flashlight_min_version, url: map.flashlight_apk_url }
      : null;

  return { update, minVersionInfo };
}

function parseVersion(v: string): [number, number, number] {
  const parts = v.replace(/^v/, "").split(".").map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function isNewer(current: string, remote: string): boolean {
  const [cMaj, cMin, cPat] = parseVersion(current);
  const [rMaj, rMin, rPat] = parseVersion(remote);
  if (rMaj !== cMaj) return rMaj > cMaj;
  if (rMin !== cMin) return rMin > cMin;
  return rPat > cPat;
}

function isBelowMin(current: string, min: string): boolean {
  const [cMaj, cMin, cPat] = parseVersion(current);
  const [mMaj, mMin, mPat] = parseVersion(min);
  if (cMaj !== mMaj) return cMaj < mMaj;
  if (cMin !== mMin) return cMin < mMin;
  return cPat < mPat;
}

// ── Full-screen flash overlay ─────────────────────────────────────────────────
// Only mounted while fullscreen strobe is actively running — prevents the
// startup crash from a permanently-mounted transparent Modal.

function FullscreenFlashOverlay() {
  const { flashAnim, isFullscreenActive, flashColor } = useFullscreenFlash();
  if (!isFullscreenActive) return null;
  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType="none"
      hardwareAccelerated
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: flashColor, opacity: flashAnim },
        ]}
      />
    </Modal>
  );
}

// ── Blocking minimum-version dialog ──────────────────────────────────────────

function MinVersionDialog({ info, onDownload }: { info: MinVersionInfo; onDownload: () => void }) {
  return (
    <Modal transparent animationType="fade" statusBarTranslucent>
      <View style={dlg.backdrop}>
        <View style={dlg.card}>
          <Text style={dlg.emoji}>⚠️</Text>
          <Text style={dlg.title}>Update Required</Text>
          <Text style={dlg.version}>Version {info.minVersion} or later is required</Text>
          <Text style={dlg.body}>
            This version is no longer supported. Please download the latest update to continue.
          </Text>
          <Pressable style={dlg.primaryBtn} onPress={onDownload}>
            <Text style={dlg.primaryBtnText}>Download Update</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── Optional update dialog ────────────────────────────────────────────────────

function UpdateDialog({
  info,
  onDownload,
  onDismiss,
}: {
  info: UpdateInfo;
  onDownload: () => void;
  onDismiss: () => void;
}) {
  return (
    <Modal transparent animationType="fade" statusBarTranslucent>
      <View style={dlg.backdrop}>
        <View style={dlg.card}>
          <Text style={dlg.emoji}>🚀</Text>
          <Text style={dlg.title}>Update Available</Text>
          <Text style={dlg.version}>Version {info.version}</Text>
          {info.notes ? <Text style={dlg.body}>{info.notes}</Text> : null}
          <Pressable style={dlg.primaryBtn} onPress={onDownload}>
            <Text style={dlg.primaryBtnText}>Download Update</Text>
          </Pressable>
          <Pressable style={dlg.secondaryBtn} onPress={onDismiss}>
            <Text style={dlg.secondaryBtnText}>Remind Me Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── Epilepsy warning ──────────────────────────────────────────────────────────

function EpilepsyWarning({ onAccept }: { onAccept: () => void }) {
  return (
    <Modal transparent animationType="fade" statusBarTranslucent>
      <View style={dlg.backdrop}>
        <ScrollView contentContainerStyle={dlg.scrollContent}>
          <View style={dlg.card}>
            <Text style={dlg.emoji}>⚠️</Text>
            <Text style={dlg.title}>Safety Warning</Text>
            <Text style={dlg.body}>
              This app produces rapidly flashing lights.{"\n\n"}
              Flashing lights can trigger seizures in people with photosensitive epilepsy or
              similar conditions. Do not use this app if you or anyone nearby has been diagnosed
              with epilepsy or is sensitive to flashing light.{"\n\n"}
              Keep the device at a safe distance and take regular breaks.{"\n\n"}
              By tapping Continue you confirm that you have read and understood this warning.
            </Text>
            <Pressable style={dlg.primaryBtn} onPress={onAccept}>
              <Text style={dlg.primaryBtnText}>I Understand, Continue</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const dlg = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  scrollContent: { flexGrow: 1, justifyContent: "center" },
  card: {
    width: "100%",
    backgroundColor: "#141414",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  emoji: { fontSize: 44, marginBottom: 4 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#f4f4f5", textAlign: "center" },
  version: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#71717a", marginBottom: 4 },
  body: {
    fontSize: 14, fontFamily: "Inter_400Regular", color: "#a1a1aa",
    textAlign: "center", lineHeight: 22,
  },
  primaryBtn: {
    width: "100%", backgroundColor: "#FFD700", borderRadius: 12,
    paddingVertical: 14, alignItems: "center", marginTop: 8,
  },
  primaryBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0a0a0a" },
  secondaryBtn: { width: "100%", paddingVertical: 12, alignItems: "center" },
  secondaryBtnText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#52525b" },
});

// ── Root layout ───────────────────────────────────────────────────────────────

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [minVersionInfo, setMinVersionInfo] = useState<MinVersionInfo | null>(null);
  const [showEpilepsyWarning, setShowEpilepsyWarning] = useState(false);
  const checkedRef = useRef(false);

  // First-launch epilepsy warning
  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    AsyncStorage.getItem(EPILEPSY_ACCEPTED_KEY).then((v) => {
      if (!v) setShowEpilepsyWarning(true);
    }).catch(() => {});
  }, [fontsLoaded, fontError]);

  const handleEpilepsyAccept = async () => {
    await AsyncStorage.setItem(EPILEPSY_ACCEPTED_KEY, "1").catch(() => {});
    setShowEpilepsyWarning(false);
  };

  // Remote update / min-version check (once after fonts load)
  useEffect(() => {
    if ((!fontsLoaded && !fontError) || checkedRef.current) return;
    checkedRef.current = true;

    (async () => {
      try {
        const { update: info, minVersionInfo: minInfo } = await fetchUpdateInfo();

        // Blocking min-version gate — set flashlight_min_version in Supabase
        if (minInfo && isBelowMin(APP_VERSION, minInfo.minVersion)) {
          setMinVersionInfo(minInfo);
          return;
        }

        if (!info) return;

        // Force-prompt (one-time by ID)
        if (info.forcePromptId) {
          const dismissed = await AsyncStorage.getItem(FORCE_PROMPT_DISMISSED_KEY).catch(() => null);
          if (dismissed !== info.forcePromptId) { setUpdateInfo(info); return; }
        }

        // Normal version-based prompt
        if (!isNewer(APP_VERSION, info.version)) return;
        const dismissed = await AsyncStorage.getItem(DISMISSED_VERSION_KEY).catch(() => null);
        if (dismissed === info.version) return;
        setUpdateInfo(info);
      } catch {
        // Never crash over an update check
      }
    })();
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  const openUrl = async (url: string) => {
    try { await Linking.openURL(url); }
    catch { Alert.alert("Couldn't open link", url); }
  };

  const handleDismissUpdate = async () => {
    if (!updateInfo) return;
    if (updateInfo.forcePromptId) {
      await AsyncStorage.setItem(FORCE_PROMPT_DISMISSED_KEY, updateInfo.forcePromptId).catch(() => {});
    } else {
      await AsyncStorage.setItem(DISMISSED_VERSION_KEY, updateInfo.version).catch(() => {});
    }
    setUpdateInfo(null);
  };

  return (
    <SafeAreaProvider>
      <FullscreenFlashProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <LanguageProvider>
              <RemoteConfigProvider>
                <GestureHandlerRootView>
                  <KeyboardProvider>
                    <RootLayoutNav />

                    {/* 1. Epilepsy safety warning — first launch only */}
                    {showEpilepsyWarning && (
                      <EpilepsyWarning onAccept={handleEpilepsyAccept} />
                    )}

                    {/* 2. Blocking min-version gate (no dismiss) */}
                    {!showEpilepsyWarning && minVersionInfo && (
                      <MinVersionDialog
                        info={minVersionInfo}
                        onDownload={() => openUrl(minVersionInfo.url)}
                      />
                    )}

                    {/* 3. Optional update prompt */}
                    {!showEpilepsyWarning && !minVersionInfo && updateInfo && (
                      <UpdateDialog
                        info={updateInfo}
                        onDownload={() => { setUpdateInfo(null); openUrl(updateInfo.url); }}
                        onDismiss={handleDismissUpdate}
                      />
                    )}
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </RemoteConfigProvider>
            </LanguageProvider>
          </QueryClientProvider>
        </ErrorBoundary>

        {/* Full-screen flash overlay — Modal only mounts while actively strobing
            in fullscreen mode to prevent the startup crash. */}
        <FullscreenFlashOverlay />
      </FullscreenFlashProvider>
    </SafeAreaProvider>
  );
}
