/**
 * RemoteConfigContext
 *
 * Fetches app configuration from a hardcoded R2 URL on launch.
 * The URL is NOT user-configurable — it is baked into the app so that
 * only the developer can change where config comes from (by deploying a
 * new build). This prevents tampering via the Settings screen.
 *
 * To update remote config: upload a new strobe-config.json to R2 at:
 *   https://pub-fa68c3ee55314901b1f1da18e733b041.r2.dev/strobe-config.json
 *
 * Example strobe-config.json:
 * {
 *   "version": "1.0.0",
 *   "minHz": 0.5,
 *   "maxHz": 120,
 *   "apkDownloadUrl": "https://xshare.netlify.app/f/<file-id>",
 *   "latestApkVersion": "1.2.0",
 *   "features": { "screenMode": true, "torchMode": true, ... },
 *   "message": null,
 *   "announcement": null
 * }
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ── Hardcoded config endpoint — not editable by the user ─────────────────────
const HARDCODED_CONFIG_URL =
  "https://pub-fa68c3ee55314901b1f1da18e733b041.r2.dev/strobe-config.json";

const CONFIG_CACHE_KEY = "@strobe_remote_config_cache";

export interface RemoteConfig {
  version: string;
  minHz: number;
  maxHz: number;
  apkDownloadUrl: string | null;
  latestApkVersion: string | null;
  features: {
    screenMode: boolean;
    torchMode: boolean;
    customColors: boolean;
    bpmTap: boolean;
    timer: boolean;
    patterns: boolean;
    logging: boolean;
  };
  message: string | null;
  announcement: string | null;
}

export const DEFAULT_CONFIG: RemoteConfig = {
  version: "1.0.0",
  minHz: 0.5,
  maxHz: 120,
  apkDownloadUrl: null,
  latestApkVersion: null,
  features: {
    screenMode: true,
    torchMode: true,
    customColors: true,
    bpmTap: true,
    timer: true,
    patterns: true,
    logging: true,
  },
  message: null,
  announcement: null,
};

interface RemoteConfigContextType {
  config: RemoteConfig;
  /** Always equals HARDCODED_CONFIG_URL — exposed for display only. */
  configUrl: string;
  /** No-op: the config URL is hardcoded and cannot be changed at runtime. */
  setConfigUrl: (url: string) => void;
  fetchConfig: () => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  lastFetched: number | null;
  error: string | null;
}

const RemoteConfigContext = createContext<RemoteConfigContextType>({
  config: DEFAULT_CONFIG,
  configUrl: HARDCODED_CONFIG_URL,
  setConfigUrl: () => {},
  fetchConfig: async () => ({ success: false }),
  isLoading: false,
  lastFetched: null,
  error: null,
});

export function RemoteConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<RemoteConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasAutoFetched = useRef(false);

  // Load cached config on mount for instant UI (no flicker while fetching)
  useEffect(() => {
    AsyncStorage.getItem(CONFIG_CACHE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<RemoteConfig>;
        setConfig({
          ...DEFAULT_CONFIG,
          ...parsed,
          features: { ...DEFAULT_CONFIG.features, ...(parsed.features ?? {}) },
        });
      })
      .catch(() => {});
  }, []);

  const fetchConfig = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setError(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(HARDCODED_CONFIG_URL, {
        signal: controller.signal,
        headers: { "Cache-Control": "no-cache" },
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = (await res.json()) as Partial<RemoteConfig>;
      const merged: RemoteConfig = {
        ...DEFAULT_CONFIG,
        ...json,
        features: { ...DEFAULT_CONFIG.features, ...(json.features ?? {}) },
      };
      setConfig(merged);
      setLastFetched(Date.now());
      await AsyncStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(merged));
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-fetch once on mount
  useEffect(() => {
    if (!hasAutoFetched.current) {
      hasAutoFetched.current = true;
      fetchConfig().catch(() => {});
    }
  }, [fetchConfig]);

  return (
    <RemoteConfigContext.Provider
      value={{
        config,
        configUrl: HARDCODED_CONFIG_URL,
        setConfigUrl: () => {
          // Intentionally a no-op: URL is hardcoded
          console.warn("[RemoteConfig] setConfigUrl is disabled; URL is hardcoded.");
        },
        fetchConfig,
        isLoading,
        lastFetched,
        error,
      }}
    >
      {children}
    </RemoteConfigContext.Provider>
  );
}

export function useRemoteConfig() {
  return useContext(RemoteConfigContext);
}
