import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

const CONFIG_URL_KEY = '@strobe_remote_config_url';
const CONFIG_CACHE_KEY = '@strobe_remote_config_cache';

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
  version: '1.0.0',
  minHz: 0.5,
  maxHz: 30,
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
  configUrl: string;
  setConfigUrl: (url: string) => void;
  /** Fetch config from `urlOverride` (or current saved URL if omitted). */
  fetchConfig: (urlOverride?: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  lastFetched: number | null;
  error: string | null;
}

const RemoteConfigContext = createContext<RemoteConfigContextType>({
  config: DEFAULT_CONFIG,
  configUrl: '',
  setConfigUrl: () => {},
  fetchConfig: async () => ({ success: false }),
  isLoading: false,
  lastFetched: null,
  error: null,
});

export function RemoteConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<RemoteConfig>(DEFAULT_CONFIG);
  const [configUrl, setConfigUrlState] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track whether we've done the initial auto-fetch so we only do it once.
  const hasAutoFetched = useRef(false);

  // Load saved URL and cached config on mount
  useEffect(() => {
    (async () => {
      try {
        const [savedUrl, cachedConfig] = await Promise.all([
          AsyncStorage.getItem(CONFIG_URL_KEY),
          AsyncStorage.getItem(CONFIG_CACHE_KEY),
        ]);
        if (savedUrl) setConfigUrlState(savedUrl);
        if (cachedConfig) {
          const parsed = JSON.parse(cachedConfig) as Partial<RemoteConfig>;
          setConfig({ ...DEFAULT_CONFIG, ...parsed, features: { ...DEFAULT_CONFIG.features, ...(parsed.features ?? {}) } });
        }
      } catch (e) {
        console.warn('[RemoteConfig] Failed to load saved config:', e);
      }
    })();
  }, []);

  const setConfigUrl = useCallback((url: string) => {
    setConfigUrlState(url);
    AsyncStorage.setItem(CONFIG_URL_KEY, url).catch((e) =>
      console.warn('[RemoteConfig] Failed to save URL:', e),
    );
  }, []);

  /**
   * Fetch remote config.
   * Pass `urlOverride` to bypass the current state (useful right after setConfigUrl
   * before the state update has propagated).
   */
  const fetchConfig = useCallback(
    async (urlOverride?: string): Promise<{ success: boolean; error?: string }> => {
      const url = (urlOverride ?? configUrl).trim();

      if (!url) {
        setError('No remote config URL configured');
        return { success: false, error: 'No URL configured' };
      }

      setIsLoading(true);
      setError(null);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache' },
        });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json() as Partial<RemoteConfig>;
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
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setIsLoading(false);
      }
    },
    [configUrl],
  );

  // Auto-fetch once when a non-empty configUrl first becomes available (after
  // AsyncStorage load). Using configUrl in deps so this reacts to the initial load.
  useEffect(() => {
    if (configUrl && !hasAutoFetched.current) {
      hasAutoFetched.current = true;
      // Pass URL explicitly so we don't race against the state read inside fetchConfig.
      fetchConfig(configUrl).catch(() => {});
    }
  }, [configUrl, fetchConfig]);

  return (
    <RemoteConfigContext.Provider
      value={{ config, configUrl, setConfigUrl, fetchConfig, isLoading, lastFetched, error }}
    >
      {children}
    </RemoteConfigContext.Provider>
  );
}

export function useRemoteConfig() {
  return useContext(RemoteConfigContext);
}
