import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';

const STORAGE_KEY = '@strobe_session_logs';
const MAX_LOGS = 100;

export interface SessionLog {
  id: string;
  timestamp: number;
  mode: 'screen' | 'torch' | 'both';
  hz: number;
  dutyCycle: number;
  color: string;
  durationMs: number;
  pattern?: string;
}

export function useLogger() {
  const logSession = useCallback(async (session: Omit<SessionLog, 'id'>) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const existing: SessionLog[] = raw ? JSON.parse(raw) : [];
      const entry: SessionLog = {
        ...session,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      };
      const updated = [entry, ...existing].slice(0, MAX_LOGS);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[Logger] Failed to write session log:', e);
    }
  }, []);

  const getLogs = useCallback(async (): Promise<SessionLog[]> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, []);

  const clearLogs = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('[Logger] Failed to clear logs:', e);
    }
  }, []);

  return { logSession, getLogs, clearLogs };
}
