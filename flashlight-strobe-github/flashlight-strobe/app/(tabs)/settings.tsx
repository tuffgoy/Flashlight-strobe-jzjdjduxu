/**
 * Settings screen — user-facing only.
 * Technical implementation details are NOT shown here.
 */

import * as Haptics from "expo-haptics";
import { Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRemoteConfig } from "@/context/RemoteConfigContext";
import { useLanguage } from "@/context/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { SessionLog, useLogger } from "@/hooks/useLogger";
import { LANG_LABELS, LangCode } from "@/lib/translations";

const APP_VERSION = "1.1.0";
const EPILEPSY_KEY = "@strobe_epilepsy_accepted";

function formatDuration(ms: number): string {
  if (ms < 1000) return "<1s";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return isToday ? `Today ${time}` : `${d.toLocaleDateString()} ${time}`;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useLanguage();
  const { config, fetchConfig, isLoading, lastFetched, error } = useRemoteConfig();
  const { getLogs, clearLogs } = useLogger();

  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [checkStatus, setCheckStatus] = useState<"idle" | "ok" | "fail">("idle");

  useEffect(() => {
    getLogs().then((l) => { setLogs(l); setLogsLoading(false); });
  }, [getLogs]);

  const handleCheckUpdates = useCallback(async () => {
    const result = await fetchConfig();
    setCheckStatus(result.success ? "ok" : "fail");
    if (result.success) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCheckStatus("idle"), 3000);
  }, [fetchConfig]);

  const handleClearLogs = useCallback(() => {
    Alert.alert(t.clearHistory, t.clearHistoryConfirm, [
      { text: t.cancel, style: "cancel" },
      {
        text: t.delete, style: "destructive",
        onPress: async () => {
          await clearLogs();
          setLogs([]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  }, [clearLogs, t]);

  const handleRefreshLogs = useCallback(() => {
    setLogsLoading(true);
    getLogs().then((l) => { setLogs(l); setLogsLoading(false); });
  }, [getLogs]);

  const handleResetWarning = useCallback(async () => {
    await AsyncStorage.removeItem(EPILEPSY_KEY);
    Alert.alert("", "Safety warning will show on next app launch.");
  }, []);

  const updateAvailable =
    config.latestApkVersion &&
    compareVersions(config.latestApkVersion, APP_VERSION) > 0;

  const s = makeStyles(colors, insets);

  const checkBtnLabel =
    checkStatus === "ok" ? "✓ Up to date" :
    checkStatus === "fail" ? "⚠ Check failed" :
    "Check for Updates";

  const checkBtnColor =
    checkStatus === "ok" ? "#22c55e" :
    checkStatus === "fail" ? "#ef4444" :
    colors.primary;

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Update banner ─────────────────────────────────────── */}
        {updateAvailable && (
          <View style={s.updateBanner}>
            <View style={{ flex: 1 }}>
              <Text style={s.updateTitle}>{t.updateAvailable}</Text>
              <Text style={s.updateSub}>
                v{config.latestApkVersion} is available — you have v{APP_VERSION}
              </Text>
            </View>
            {config.apkDownloadUrl && (
              <Pressable
                style={s.downloadBtn}
                onPress={() => Linking.openURL(config.apkDownloadUrl!)}
              >
                <Text style={s.downloadBtnText}>{t.downloadUpdate}</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Check for updates ─────────────────────────────────── */}
        <View>
          <Text style={s.sectionTitle}>UPDATES</Text>
          <Pressable
            style={[s.updateCheckBtn, { backgroundColor: checkBtnColor, opacity: isLoading ? 0.7 : 1 }]}
            onPress={handleCheckUpdates}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator size="small" color={colors.primaryForeground} />
              : <Text style={s.updateCheckBtnText}>{checkBtnLabel}</Text>
            }
          </Pressable>
          {!updateAvailable && lastFetched && checkStatus === "idle" && (
            <Text style={s.lastChecked}>
              Last checked {new Date(lastFetched).toLocaleTimeString()}
            </Text>
          )}
          {error && checkStatus === "idle" && !lastFetched && (
            <Text style={[s.lastChecked, { color: "#ef4444" }]}>
              Couldn't connect — using defaults
            </Text>
          )}
        </View>

        {/* ── Language ──────────────────────────────────────────── */}
        <View>
          <Text style={s.sectionTitle}>{t.language}</Text>
          <View style={s.langGrid}>
            {(Object.keys(LANG_LABELS) as LangCode[]).map((code) => (
              <Pressable
                key={code}
                style={[s.langBtn, lang === code && s.langBtnActive]}
                onPress={() => setLang(code)}
              >
                <Text style={[s.langBtnText, lang === code && s.langBtnTextActive]}>
                  {LANG_LABELS[code]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Session history ───────────────────────────────────── */}
        <View>
          <View style={s.logHeader}>
            <Text style={s.sectionTitle}>{t.sessionHistory}</Text>
            <View style={s.logActions}>
              <Pressable onPress={handleRefreshLogs}><Text style={s.logAction}>{t.refresh}</Text></Pressable>
              {logs.length > 0 && (
                <Pressable onPress={handleClearLogs}>
                  <Text style={[s.logAction, { color: "#ef4444" }]}>{t.clearHistory}</Text>
                </Pressable>
              )}
            </View>
          </View>
          <View style={s.card}>
            {logsLoading
              ? <ActivityIndicator color={colors.primary} />
              : logs.length === 0
              ? <Text style={s.emptyText}>{t.noSessions}</Text>
              : logs.map((log, i) => (
                  <View
                    key={log.id}
                    style={[s.logItem, i === logs.length - 1 && { borderBottomWidth: 0 }]}
                  >
                    <View style={s.logLeft}>
                      <Text style={s.logMode}>
                        {log.mode === "screen" ? t.modeScreen : log.mode === "torch" ? t.modeTorch : t.modeBoth}
                        {log.pattern ? ` · ${log.pattern}` : ""}
                      </Text>
                      <Text style={s.logTime}>{formatTimestamp(log.timestamp)}</Text>
                    </View>
                    <View style={s.logRight}>
                      {log.hz > 0 && <Text style={s.logHz}>{log.hz.toFixed(1)} Hz</Text>}
                      <Text style={s.logDur}>{formatDuration(log.durationMs)}</Text>
                    </View>
                  </View>
                ))
            }
          </View>
        </View>

        {/* ── About ─────────────────────────────────────────────── */}
        <View>
          <Text style={s.sectionTitle}>{t.about}</Text>
          <View style={s.card}>
            {[
              { key: t.appVersion, val: `v${APP_VERSION}` },
              {
                key: t.platform,
                val: Platform.OS === "android" ? "Android" : Platform.OS === "ios" ? "iOS" : "Web",
              },
              { key: t.buildType, val: __DEV__ ? t.dev : t.release },
            ].map((item) => (
              <View key={item.key} style={s.aboutRow}>
                <Text style={s.aboutKey}>{item.key}</Text>
                <Text style={s.aboutVal}>{item.val}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Legal links ────────────────────────────────────────── */}
        <View>
          <Text style={s.sectionTitle}>LEGAL</Text>
          <View style={s.card}>
            <Pressable onPress={() => Linking.openURL("flashlight-strobe://terms").catch(() => {})} style={s.legalRow}>
              <Text style={s.legalLink}>Terms of Use</Text>
            </Pressable>
            <View style={s.legalDivider} />
            <Pressable onPress={() => Linking.openURL("flashlight-strobe://privacy").catch(() => {})} style={s.legalRow}>
              <Text style={s.legalLink}>Privacy Policy</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Safety ─────────────────────────────────────────────── */}
        <View>
          <Text style={s.sectionTitle}>SAFETY</Text>
          <Pressable style={[s.card, { alignItems: "center" }]} onPress={handleResetWarning}>
            <Text style={[s.legalLink, { color: colors.mutedForeground }]}>{t.resetWarning}</Text>
          </Pressable>
        </View>

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
    scroll: { flex: 1 },
    content: { paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100, gap: 16 },
    sectionTitle: { fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 2, marginBottom: 8 },
    card: { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 },

    // Update
    updateBanner: {
      backgroundColor: colors.primary, borderRadius: colors.radius, padding: 14,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    },
    updateTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: colors.primaryForeground },
    updateSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.primaryForeground, opacity: 0.85 },
    downloadBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 8 },
    downloadBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
    updateCheckBtn: {
      paddingVertical: 14, borderRadius: colors.radius, alignItems: "center",
    },
    updateCheckBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.primaryForeground },
    lastChecked: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", marginTop: 6 },

    // Language
    langGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    langBtn: {
      paddingHorizontal: 16, paddingVertical: 10,
      backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border,
    },
    langBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    langBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground },
    langBtnTextActive: { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" },

    // Logs
    logHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    logActions: { flexDirection: "row", gap: 14 },
    logAction: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground },
    logItem: {
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
      flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12,
    },
    logLeft: { flex: 1, gap: 2 },
    logMode: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    logTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    logRight: { alignItems: "flex-end", gap: 2 },
    logHz: { fontSize: 13, fontFamily: "Inter_700Bold", color: colors.primary },
    logDur: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", paddingVertical: 16 },

    // About
    aboutRow: { flexDirection: "row", justifyContent: "space-between" },
    aboutKey: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    aboutVal: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },

    // Legal
    legalRow: { paddingVertical: 4 },
    legalLink: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.primary },
    legalDivider: { height: 1, backgroundColor: colors.border },
  });
}
