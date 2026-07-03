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
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";

// ── App version (keep in sync with app.json) ─────────────────────────────────
const APP_VERSION = "1.1.0";

// ── Supabase REST API (read-only, no library needed) ─────────────────────────
const SUPABASE_URL = "https://vdprpaqlerngvcmzwcjg.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkcHJwYXFsZXJuZ3ZjbXp3Y2pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MzI3MjUsImV4cCI6MjA5NjMwODcyNX0.b9_PJEs3F8UH3qCK0bs-nUDvG81fBD0BP4Iec79C3-E";

const DISMISSED_VERSION_KEY = "flashlight_dismissed_update_version";

interface UpdateInfo {
  version: string;
  url: string;
  notes?: string;
}

/**
 * Fetches the latest APK info from the Supabase app_settings table.
 * The admin sets these via the xShare admin panel or Supabase dashboard:
 *   key=flashlight_apk_version  value="1.2.0"
 *   key=flashlight_apk_url      value="https://xshare.netlify.app/f/<file-id>"
 *   key=flashlight_apk_notes    value="Bug fixes and new patterns" (optional)
 */
async function fetchUpdateInfo(): Promise<UpdateInfo | null> {
  const keys = ["flashlight_apk_version", "flashlight_apk_url", "flashlight_apk_notes"];
  const filter = `key=in.(${keys.map((k) => `"${k}"`).join(",")})`;
  const url = `${SUPABASE_URL}/rest/v1/app_settings?${filter}&select=key,value`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) return null;

  const rows = (await res.json()) as Array<{ key: string; value: string }>;
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  if (!map.flashlight_apk_version || !map.flashlight_apk_url) return null;
  return {
    version: map.flashlight_apk_version,
    url: map.flashlight_apk_url,
    notes: map.flashlight_apk_notes,
  };
}

/** Returns true when remoteVersion is strictly newer than currentVersion (semver). */
function isNewer(current: string, remote: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [cMaj, cMin, cPat] = parse(current);
  const [rMaj, rMin, rPat] = parse(remote);
  if (rMaj !== cMaj) return rMaj > cMaj;
  if (rMin !== cMin) return rMin > cMin;
  return rPat > cPat;
}

// ── Update dialog ─────────────────────────────────────────────────────────────

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
      <View style={dialogStyles.backdrop}>
        <View style={dialogStyles.card}>
          <Text style={dialogStyles.emoji}>🚀</Text>
          <Text style={dialogStyles.title}>Update Available</Text>
          <Text style={dialogStyles.version}>Version {info.version}</Text>
          {info.notes ? (
            <Text style={dialogStyles.notes}>{info.notes}</Text>
          ) : null}
          <Pressable style={dialogStyles.primaryBtn} onPress={onDownload}>
            <Text style={dialogStyles.primaryBtnText}>Download Update</Text>
          </Pressable>
          <Pressable style={dialogStyles.secondaryBtn} onPress={onDismiss}>
            <Text style={dialogStyles.secondaryBtnText}>Remind Me Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const dialogStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  card: {
    width: "100%",
    backgroundColor: "#141414",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  emoji: {
    fontSize: 44,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#f4f4f5",
    textAlign: "center",
  },
  version: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#71717a",
    marginBottom: 4,
  },
  notes: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#a1a1aa",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 4,
  },
  primaryBtn: {
    width: "100%",
    backgroundColor: "#FFD700",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#0a0a0a",
  },
  secondaryBtn: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#52525b",
  },
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
  const checkedRef = useRef(false);

  // ── Remote update check (runs once after fonts load) ─────────────────────
  useEffect(() => {
    if ((!fontsLoaded && !fontError) || checkedRef.current) return;
    checkedRef.current = true;

    (async () => {
      try {
        const info = await fetchUpdateInfo();
        if (!info) return;
        if (!isNewer(APP_VERSION, info.version)) return;

        // Skip if the user already dismissed this specific version
        const dismissed = await AsyncStorage.getItem(DISMISSED_VERSION_KEY).catch(() => null);
        if (dismissed === info.version) return;

        setUpdateInfo(info);
      } catch {
        // Never crash the app over an update check failure
      }
    })();
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  const handleDownload = async () => {
    if (!updateInfo) return;
    setUpdateInfo(null);
    try {
      await Linking.openURL(updateInfo.url);
    } catch {
      Alert.alert("Couldn't open link", updateInfo.url);
    }
  };

  const handleDismiss = async () => {
    if (updateInfo) {
      // Remember this version so the dialog doesn't appear again until a newer one ships
      await AsyncStorage.setItem(DISMISSED_VERSION_KEY, updateInfo.version).catch(() => {});
    }
    setUpdateInfo(null);
  };

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <RootLayoutNav />
              {updateInfo && (
                <UpdateDialog
                  info={updateInfo}
                  onDownload={handleDownload}
                  onDismiss={handleDismiss}
                />
              )}
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
