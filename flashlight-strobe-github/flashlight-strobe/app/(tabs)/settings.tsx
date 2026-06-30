import * as Haptics from 'expo-haptics';
import { Linking } from 'react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { SessionLog, useLogger } from '@/hooks/useLogger';

const APP_VERSION = '1.0.0';

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return isToday ? `Today ${time}` : d.toLocaleDateString() + ' ' + time;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return '<1s';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m > 0) return `${m}m ${rem}s`;
  return `${s}s`;
}

function modeLabel(mode: SessionLog['mode']): string {
  return { screen: 'Screen', torch: 'Torch', both: 'Both' }[mode] ?? mode;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { config, configUrl, setConfigUrl, fetchConfig, isLoading, lastFetched, error } =
    useRemoteConfig();
  const { getLogs, clearLogs } = useLogger();

  const [urlInput, setUrlInput] = useState(configUrl);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Sync url input when config URL loads
  useEffect(() => {
    setUrlInput(configUrl);
  }, [configUrl]);

  // Load logs on mount
  useEffect(() => {
    getLogs().then((l) => {
      setLogs(l);
      setLogsLoading(false);
    });
  }, [getLogs]);

  const handleSaveUrl = useCallback(() => {
    setConfigUrl(urlInput.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [urlInput, setConfigUrl]);

  const handleFetch = useCallback(async () => {
    const url = urlInput.trim();
    // Save the URL before fetching so future app launches use it.
    if (url !== configUrl) {
      setConfigUrl(url);
    }
    // Pass url directly so fetchConfig doesn't read the old (pre-update) state.
    const result = await fetchConfig(url);
    setFetchStatus(result.success ? 'success' : 'error');
    setTimeout(() => setFetchStatus('idle'), 3000);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [urlInput, configUrl, setConfigUrl, fetchConfig]);

  const handleClearLogs = useCallback(() => {
    Alert.alert('Clear Session Logs', 'Delete all recorded sessions?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await clearLogs();
          setLogs([]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  }, [clearLogs]);

  const handleRefreshLogs = useCallback(() => {
    setLogsLoading(true);
    getLogs().then((l) => {
      setLogs(l);
      setLogsLoading(false);
    });
  }, [getLogs]);

  const updateAvailable =
    config.latestApkVersion && compareVersions(config.latestApkVersion, APP_VERSION) > 0;

  const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: 16,
      paddingTop: insets.top + 16,
      paddingBottom: insets.bottom + 100,
      gap: 16,
    },
    sectionTitle: {
      fontSize: 10,
      fontFamily: 'Inter_700Bold',
      color: colors.mutedForeground,
      letterSpacing: 2,
      marginBottom: 8,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    input: {
      backgroundColor: colors.muted,
      borderRadius: colors.radius - 4,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: colors.foreground,
    },
    row: { flexDirection: 'row', gap: 8 },
    btn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: colors.radius,
      alignItems: 'center',
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    btnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
    btnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    btnTextPrimary: { color: colors.primaryForeground },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.mutedForeground },
    configItem: { flexDirection: 'row', justifyContent: 'space-between' },
    configKey: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.mutedForeground },
    configVal: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground },

    // Update banner
    updateBanner: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    updateText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primaryForeground },
    updateSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.primaryForeground, opacity: 0.8 },
    downloadBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: 'rgba(0,0,0,0.2)',
      borderRadius: 8,
    },
    downloadBtnText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#ffffff' },

    // Log items
    logItem: {
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    logLeft: { flex: 1, gap: 2 },
    logMode: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    logTime: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    logRight: { alignItems: 'flex-end', gap: 2 },
    logHz: { fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primary },
    logDur: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    emptyLogs: { paddingVertical: 20, alignItems: 'center' },
    emptyLogsText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },

    // Feature flags
    featureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    featureKey: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    featureBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 6,
    },
    featureBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },

    // About
    aboutRow: { flexDirection: 'row', justifyContent: 'space-between' },
    aboutKey: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    aboutVal: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
  });

  const fetchStatusColor =
    fetchStatus === 'success' ? colors.success :
    fetchStatus === 'error' ? colors.destructive :
    error ? colors.destructive :
    lastFetched ? colors.success :
    colors.mutedForeground;

  const fetchStatusText =
    fetchStatus === 'success' ? 'Config loaded successfully' :
    fetchStatus === 'error' ? `Error: ${error ?? 'fetch failed'}` :
    error ? `Last error: ${error}` :
    lastFetched ? `Last fetched ${new Date(lastFetched).toLocaleTimeString()}` :
    'Not fetched yet';

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Update available banner ─────────────────────────────── */}
        {updateAvailable && (
          <View style={s.updateBanner}>
            <View style={{ flex: 1 }}>
              <Text style={s.updateText}>Update Available</Text>
              <Text style={s.updateSub}>v{config.latestApkVersion} · You have v{APP_VERSION}</Text>
            </View>
            {config.apkDownloadUrl && (
              <Pressable
                style={s.downloadBtn}
                onPress={() => Linking.openURL(config.apkDownloadUrl!)}
              >
                <Text style={s.downloadBtnText}>Download APK</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Remote Config ───────────────────────────────────────── */}
        <View>
          <Text style={s.sectionTitle}>REMOTE CONFIG</Text>
          <View style={s.card}>
            <TextInput
              style={s.input}
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="https://your-supabase-url/config.json"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={handleSaveUrl}
            />
            <View style={s.row}>
              <Pressable style={s.btn} onPress={handleSaveUrl}>
                <Text style={s.btnText}>Save URL</Text>
              </Pressable>
              <Pressable
                style={[s.btn, s.btnPrimary, isLoading && { opacity: 0.6 }]}
                onPress={handleFetch}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.primaryForeground} size="small" />
                ) : (
                  <Text style={[s.btnText, s.btnTextPrimary]}>Fetch Now</Text>
                )}
              </Pressable>
            </View>
            <View style={s.statusRow}>
              <View style={[s.statusDot, { backgroundColor: fetchStatusColor }]} />
              <Text style={s.statusText}>{fetchStatusText}</Text>
            </View>
          </View>
        </View>

        {/* ── Active Config values ──────────────────────────────── */}
        <View>
          <Text style={s.sectionTitle}>ACTIVE CONFIG</Text>
          <View style={s.card}>
            {[
              { key: 'Config version', val: config.version },
              { key: 'Hz range', val: `${config.minHz} – ${config.maxHz} Hz` },
              { key: 'Latest APK', val: config.latestApkVersion ?? 'Not set' },
            ].map((item) => (
              <View key={item.key} style={s.configItem}>
                <Text style={s.configKey}>{item.key}</Text>
                <Text style={s.configVal}>{item.val}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Feature Flags ──────────────────────────────────────── */}
        <View>
          <Text style={s.sectionTitle}>FEATURE FLAGS</Text>
          <View style={s.card}>
            {Object.entries(config.features).map(([key, enabled]) => (
              <View key={key} style={s.featureRow}>
                <Text style={s.featureKey}>{key}</Text>
                <View style={[s.featureBadge, { backgroundColor: enabled ? `${colors.success}22` : `${colors.muted}` }]}>
                  <Text style={[s.featureBadgeText, { color: enabled ? colors.success : colors.mutedForeground }]}>
                    {enabled ? 'ON' : 'OFF'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Session Logs ─────────────────────────────────────────── */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={s.sectionTitle}>SESSION LOGS ({logs.length})</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={handleRefreshLogs}>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>Refresh</Text>
              </Pressable>
              {logs.length > 0 && (
                <Pressable onPress={handleClearLogs}>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.destructive }}>Clear</Text>
                </Pressable>
              )}
            </View>
          </View>
          <View style={s.card}>
            {logsLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : logs.length === 0 ? (
              <View style={s.emptyLogs}>
                <Text style={s.emptyLogsText}>No sessions recorded yet</Text>
                <Text style={[s.emptyLogsText, { marginTop: 4 }]}>
                  Start the strobe to begin logging
                </Text>
              </View>
            ) : (
              logs.map((log, i) => (
                <View key={log.id} style={[s.logItem, i === logs.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={s.logLeft}>
                    <Text style={s.logMode}>
                      {modeLabel(log.mode)}{log.pattern ? ` · ${log.pattern}` : ''}
                    </Text>
                    <Text style={s.logTime}>{formatTimestamp(log.timestamp)}</Text>
                  </View>
                  <View style={s.logRight}>
                    {log.hz > 0 && <Text style={s.logHz}>{log.hz.toFixed(1)} Hz</Text>}
                    <Text style={s.logDur}>{formatDuration(log.durationMs)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* ── About ──────────────────────────────────────────────── */}
        <View>
          <Text style={s.sectionTitle}>ABOUT</Text>
          <View style={s.card}>
            {[
              { key: 'App version', val: `v${APP_VERSION}` },
              { key: 'Platform', val: Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : 'Web' },
              { key: 'Build type', val: __DEV__ ? 'Development' : 'Release' },
            ].map((item) => (
              <View key={item.key} style={s.aboutRow}>
                <Text style={s.aboutKey}>{item.key}</Text>
                <Text style={s.aboutVal}>{item.val}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </View>
  );
}
