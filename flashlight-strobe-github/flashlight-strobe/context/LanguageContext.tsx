/**
 * LanguageContext — simple i18n.
 * Stores the user's chosen language in AsyncStorage and exposes the
 * translation map as `t` throughout the app.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  LangCode,
  TRANSLATIONS,
  Translations,
} from "@/lib/translations";

const LANG_KEY = "@strobe_language";
const DEFAULT_LANG: LangCode = "en";

interface LanguageContextType {
  lang: LangCode;
  setLang: (code: LangCode) => Promise<void>;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: DEFAULT_LANG,
  setLang: async () => {},
  t: TRANSLATIONS[DEFAULT_LANG],
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(DEFAULT_LANG);

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY)
      .then((stored) => {
        if (stored && stored in TRANSLATIONS) {
          setLangState(stored as LangCode);
        }
      })
      .catch(() => {});
  }, []);

  const setLang = useCallback(async (code: LangCode) => {
    setLangState(code);
    await AsyncStorage.setItem(LANG_KEY, code).catch(() => {});
  }, []);

  return (
    <LanguageContext.Provider
      value={{ lang, setLang, t: TRANSLATIONS[lang] }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
