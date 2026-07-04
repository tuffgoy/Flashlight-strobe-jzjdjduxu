export type LangCode = "en" | "es" | "fr" | "de" | "pt";

export interface Translations {
  // Tab labels
  tabStrobe: string;
  tabPatterns: string;
  tabSound: string;
  tabSettings: string;
  // Strobe screen
  strobe: string;
  on: string;
  off: string;
  frequency: string;
  dutyCycle: string;
  flashOnTime: string;
  screenFlash: string;
  screenFlashSub: string;
  timer: string;
  timerSub: string;
  noTimer: string;
  grantPermission: string;
  hzVerySlowLabel: string;
  hzSlowLabel: string;
  hzMediumLabel: string;
  hzFastLabel: string;
  hzRapidLabel: string;
  hzUltraLabel: string;
  msCycle: string;
  msOn: string;
  // Patterns screen
  patterns: string;
  active: string;
  addCustom: string;
  customPatternName: string;
  customPatternAdd: string;
  customPatternSave: string;
  customPatternCancel: string;
  customPatternDelete: string;
  customPatternAddStep: string;
  flashOn: string;
  flashOff: string;
  duration: string;
  // Sound screen
  sound: string;
  micSync: string;
  micSyncSub: string;
  sensitivity: string;
  clickSound: string;
  clickSoundSub: string;
  micPermission: string;
  waitingForBeat: string;
  beatDetected: string;
  // Settings screen
  settings: string;
  updateAvailable: string;
  downloadUpdate: string;
  remindLater: string;
  language: string;
  appVersion: string;
  platform: string;
  buildType: string;
  sessionHistory: string;
  noSessions: string;
  clearHistory: string;
  clearHistoryConfirm: string;
  delete: string;
  cancel: string;
  refresh: string;
  epilepsyWarning: string;
  epilepsyBody: string;
  epilepsyAccept: string;
  dev: string;
  release: string;
  about: string;
  resetWarning: string;
  modeScreen: string;
  modeTorch: string;
  modeBoth: string;
}

const en: Translations = {
  tabStrobe: "Strobe",
  tabPatterns: "Patterns",
  tabSound: "Sound",
  tabSettings: "Settings",
  strobe: "STROBE",
  on: "ON",
  off: "OFF",
  frequency: "FREQUENCY",
  dutyCycle: "DUTY CYCLE",
  flashOnTime: "Flash on-time per cycle",
  screenFlash: "SCREEN FLASH",
  screenFlashSub: "Screen lights up with each pulse",
  timer: "AUTO-STOP TIMER",
  timerSub: "Strobe stops automatically after",
  noTimer: "No timer",
  grantPermission: "Grant Camera Permission for Torch",
  hzVerySlowLabel: "Very Slow",
  hzSlowLabel: "Slow",
  hzMediumLabel: "Medium",
  hzFastLabel: "Fast",
  hzRapidLabel: "Rapid",
  hzUltraLabel: "Ultra",
  msCycle: "ms/CYCLE",
  msOn: "ms ON",
  patterns: "PATTERNS",
  active: "ACTIVE",
  addCustom: "ADD CUSTOM PATTERN",
  customPatternName: "Pattern name",
  customPatternAdd: "Add Step",
  customPatternSave: "Save Pattern",
  customPatternCancel: "Cancel",
  customPatternDelete: "Delete",
  customPatternAddStep: "ADD STEP",
  flashOn: "Flash ON",
  flashOff: "Flash OFF",
  duration: "Duration (ms)",
  sound: "SOUND SYNC",
  micSync: "MIC SYNC",
  micSyncSub: "Flash triggers on detected beats or claps",
  sensitivity: "SENSITIVITY",
  clickSound: "CLICK SOUND",
  clickSoundSub: "Vibrate on each detected beat",
  micPermission: "Grant Microphone Permission",
  waitingForBeat: "Listening for beats…",
  beatDetected: "Beat detected",
  settings: "SETTINGS",
  updateAvailable: "Update Available",
  downloadUpdate: "Download Update",
  remindLater: "Remind Me Later",
  language: "LANGUAGE",
  appVersion: "App version",
  platform: "Platform",
  buildType: "Build type",
  sessionHistory: "SESSION HISTORY",
  noSessions: "No sessions yet — start the strobe to begin recording.",
  clearHistory: "Clear History",
  clearHistoryConfirm: "Delete all recorded sessions?",
  delete: "Delete",
  cancel: "Cancel",
  refresh: "Refresh",
  epilepsyWarning: "⚠️ Safety Warning",
  epilepsyBody:
    "This app produces rapidly flashing lights. Flashing lights can trigger seizures in people with photosensitive epilepsy. Do not use if you or anyone nearby has been diagnosed with epilepsy or light-sensitive conditions. Keep a safe distance and take breaks.\n\nBy continuing you confirm you have read this warning.",
  epilepsyAccept: "I Understand, Continue",
  dev: "Development",
  release: "Release",
  about: "ABOUT",
  resetWarning: "Show Safety Warning Again",
  modeScreen: "Screen",
  modeTorch: "Torch",
  modeBoth: "Both",
};

const es: Translations = {
  tabStrobe: "Estróbos",
  tabPatterns: "Patrones",
  tabSound: "Sonido",
  tabSettings: "Ajustes",
  strobe: "ESTRÓBOS",
  on: "ON",
  off: "OFF",
  frequency: "FRECUENCIA",
  dutyCycle: "CICLO ACTIVO",
  flashOnTime: "Tiempo encendido por ciclo",
  screenFlash: "FLASH DE PANTALLA",
  screenFlashSub: "La pantalla se ilumina con cada pulso",
  timer: "TEMPORIZADOR",
  timerSub: "El estróbos se detiene automáticamente después de",
  noTimer: "Sin temporizador",
  grantPermission: "Conceder permiso de cámara para linterna",
  hzVerySlowLabel: "Muy lento",
  hzSlowLabel: "Lento",
  hzMediumLabel: "Medio",
  hzFastLabel: "Rápido",
  hzRapidLabel: "Muy rápido",
  hzUltraLabel: "Ultra",
  msCycle: "ms/CICLO",
  msOn: "ms ON",
  patterns: "PATRONES",
  active: "ACTIVO",
  addCustom: "AÑADIR PATRÓN PROPIO",
  customPatternName: "Nombre del patrón",
  customPatternAdd: "Añadir paso",
  customPatternSave: "Guardar patrón",
  customPatternCancel: "Cancelar",
  customPatternDelete: "Eliminar",
  customPatternAddStep: "AÑADIR PASO",
  flashOn: "Flash ENCENDIDO",
  flashOff: "Flash APAGADO",
  duration: "Duración (ms)",
  sound: "SINCRONÍA DE SONIDO",
  micSync: "SYNC DE MIC",
  micSyncSub: "El flash se activa al detectar golpes o palmadas",
  sensitivity: "SENSIBILIDAD",
  clickSound: "CLIC DE SONIDO",
  clickSoundSub: "Vibrar con cada beat detectado",
  micPermission: "Conceder permiso de micrófono",
  waitingForBeat: "Escuchando beats…",
  beatDetected: "Beat detectado",
  settings: "AJUSTES",
  updateAvailable: "Actualización disponible",
  downloadUpdate: "Descargar actualización",
  remindLater: "Recordarme después",
  language: "IDIOMA",
  appVersion: "Versión de la app",
  platform: "Plataforma",
  buildType: "Tipo de compilación",
  sessionHistory: "HISTORIAL DE SESIONES",
  noSessions: "Aún no hay sesiones — activa el estróbos para empezar.",
  clearHistory: "Borrar historial",
  clearHistoryConfirm: "¿Eliminar todas las sesiones registradas?",
  delete: "Eliminar",
  cancel: "Cancelar",
  refresh: "Actualizar",
  epilepsyWarning: "⚠️ Aviso de seguridad",
  epilepsyBody:
    "Esta app produce luces parpadeantes rápidas. Las luces intermitentes pueden desencadenar convulsiones en personas con epilepsia fotosensible. No uses la app si tú o alguien cercano ha sido diagnosticado con epilepsia. Mantén una distancia segura y toma descansos.\n\nAl continuar confirmas que has leído este aviso.",
  epilepsyAccept: "Entendido, continuar",
  dev: "Desarrollo",
  release: "Lanzamiento",
  about: "ACERCA DE",
  resetWarning: "Mostrar aviso de seguridad de nuevo",
  modeScreen: "Pantalla",
  modeTorch: "Linterna",
  modeBoth: "Ambos",
};

const fr: Translations = {
  tabStrobe: "Strobe",
  tabPatterns: "Motifs",
  tabSound: "Son",
  tabSettings: "Réglages",
  strobe: "STROBE",
  on: "ON",
  off: "OFF",
  frequency: "FRÉQUENCE",
  dutyCycle: "RAPPORT CYCLIQUE",
  flashOnTime: "Durée flash par cycle",
  screenFlash: "FLASH ÉCRAN",
  screenFlashSub: "L'écran s'allume à chaque impulsion",
  timer: "MINUTERIE D'ARRÊT",
  timerSub: "Le strobe s'arrête automatiquement après",
  noTimer: "Sans minuterie",
  grantPermission: "Autoriser la caméra pour la lampe",
  hzVerySlowLabel: "Très lent",
  hzSlowLabel: "Lent",
  hzMediumLabel: "Moyen",
  hzFastLabel: "Rapide",
  hzRapidLabel: "Très rapide",
  hzUltraLabel: "Ultra",
  msCycle: "ms/CYCLE",
  msOn: "ms ON",
  patterns: "MOTIFS",
  active: "ACTIF",
  addCustom: "AJOUTER UN MOTIF",
  customPatternName: "Nom du motif",
  customPatternAdd: "Ajouter une étape",
  customPatternSave: "Sauvegarder",
  customPatternCancel: "Annuler",
  customPatternDelete: "Supprimer",
  customPatternAddStep: "AJOUTER ÉTAPE",
  flashOn: "Flash ALLUMÉ",
  flashOff: "Flash ÉTEINT",
  duration: "Durée (ms)",
  sound: "SYNC AUDIO",
  micSync: "SYNC MIC",
  micSyncSub: "Flash déclenché par les battements détectés",
  sensitivity: "SENSIBILITÉ",
  clickSound: "SON DE CLIC",
  clickSoundSub: "Vibration sur chaque battement détecté",
  micPermission: "Autoriser le microphone",
  waitingForBeat: "Écoute des battements…",
  beatDetected: "Battement détecté",
  settings: "RÉGLAGES",
  updateAvailable: "Mise à jour disponible",
  downloadUpdate: "Télécharger",
  remindLater: "Me rappeler plus tard",
  language: "LANGUE",
  appVersion: "Version de l'app",
  platform: "Plateforme",
  buildType: "Type de build",
  sessionHistory: "HISTORIQUE",
  noSessions: "Aucune session — démarrez le strobe pour commencer.",
  clearHistory: "Effacer l'historique",
  clearHistoryConfirm: "Supprimer toutes les sessions enregistrées ?",
  delete: "Supprimer",
  cancel: "Annuler",
  refresh: "Actualiser",
  epilepsyWarning: "⚠️ Avertissement de sécurité",
  epilepsyBody:
    "Cette application produit des flashs lumineux rapides. Ces flashs peuvent provoquer des crises chez les personnes épileptiques photosensibles. N'utilisez pas l'application si vous ou une personne proche souffrez d'épilepsie. Gardez une distance de sécurité et faites des pauses.\n\nEn continuant, vous confirmez avoir lu cet avertissement.",
  epilepsyAccept: "J'ai compris, continuer",
  dev: "Développement",
  release: "Version finale",
  about: "À PROPOS",
  resetWarning: "Afficher l'avertissement à nouveau",
  modeScreen: "Écran",
  modeTorch: "Lampe",
  modeBoth: "Les deux",
};

const de: Translations = {
  tabStrobe: "Strobe",
  tabPatterns: "Muster",
  tabSound: "Sound",
  tabSettings: "Einstellungen",
  strobe: "STROBE",
  on: "AN",
  off: "AUS",
  frequency: "FREQUENZ",
  dutyCycle: "TASTVERHÄLTNIS",
  flashOnTime: "Einschaltzeit pro Zyklus",
  screenFlash: "BILDSCHIRM-BLITZ",
  screenFlashSub: "Bildschirm leuchtet bei jedem Puls",
  timer: "ABSCHALTTIMER",
  timerSub: "Strobe stoppt automatisch nach",
  noTimer: "Kein Timer",
  grantPermission: "Kamera-Berechtigung für Taschenlampe erteilen",
  hzVerySlowLabel: "Sehr langsam",
  hzSlowLabel: "Langsam",
  hzMediumLabel: "Mittel",
  hzFastLabel: "Schnell",
  hzRapidLabel: "Sehr schnell",
  hzUltraLabel: "Ultra",
  msCycle: "ms/ZYKLUS",
  msOn: "ms AN",
  patterns: "MUSTER",
  active: "AKTIV",
  addCustom: "EIGENES MUSTER HINZUFÜGEN",
  customPatternName: "Mustername",
  customPatternAdd: "Schritt hinzufügen",
  customPatternSave: "Muster speichern",
  customPatternCancel: "Abbrechen",
  customPatternDelete: "Löschen",
  customPatternAddStep: "SCHRITT HINZUFÜGEN",
  flashOn: "Blitz AN",
  flashOff: "Blitz AUS",
  duration: "Dauer (ms)",
  sound: "SOUND-SYNC",
  micSync: "MIC-SYNC",
  micSyncSub: "Blitz wird bei erkannten Beats ausgelöst",
  sensitivity: "EMPFINDLICHKEIT",
  clickSound: "KLICK-SOUND",
  clickSoundSub: "Vibration bei jedem erkannten Beat",
  micPermission: "Mikrofon-Berechtigung erteilen",
  waitingForBeat: "Höre auf Beats…",
  beatDetected: "Beat erkannt",
  settings: "EINSTELLUNGEN",
  updateAvailable: "Update verfügbar",
  downloadUpdate: "Update herunterladen",
  remindLater: "Später erinnern",
  language: "SPRACHE",
  appVersion: "App-Version",
  platform: "Plattform",
  buildType: "Build-Typ",
  sessionHistory: "SITZUNGSVERLAUF",
  noSessions: "Noch keine Sitzungen — Strobe starten zum Aufzeichnen.",
  clearHistory: "Verlauf löschen",
  clearHistoryConfirm: "Alle aufgezeichneten Sitzungen löschen?",
  delete: "Löschen",
  cancel: "Abbrechen",
  refresh: "Aktualisieren",
  epilepsyWarning: "⚠️ Sicherheitswarnung",
  epilepsyBody:
    "Diese App erzeugt schnell blinkende Lichter. Blinklichter können bei Menschen mit lichtempfindlicher Epilepsie Anfälle auslösen. Nicht verwenden, wenn Sie oder Personen in Ihrer Nähe an Epilepsie leiden. Halten Sie Abstand und machen Sie Pausen.\n\nDurch Fortfahren bestätigen Sie, diese Warnung gelesen zu haben.",
  epilepsyAccept: "Verstanden, weiter",
  dev: "Entwicklung",
  release: "Release",
  about: "ÜBER DIE APP",
  resetWarning: "Sicherheitswarnung erneut anzeigen",
  modeScreen: "Bildschirm",
  modeTorch: "Taschenlampe",
  modeBoth: "Beide",
};

const pt: Translations = {
  tabStrobe: "Strobe",
  tabPatterns: "Padrões",
  tabSound: "Som",
  tabSettings: "Definições",
  strobe: "STROBE",
  on: "LIGADO",
  off: "DESLIGADO",
  frequency: "FREQUÊNCIA",
  dutyCycle: "CICLO DE TRABALHO",
  flashOnTime: "Tempo ligado por ciclo",
  screenFlash: "FLASH DE ECRÃ",
  screenFlashSub: "O ecrã acende a cada pulso",
  timer: "TEMPORIZADOR",
  timerSub: "O strobe para automaticamente após",
  noTimer: "Sem temporizador",
  grantPermission: "Conceder permissão de câmara para lanterna",
  hzVerySlowLabel: "Muito lento",
  hzSlowLabel: "Lento",
  hzMediumLabel: "Médio",
  hzFastLabel: "Rápido",
  hzRapidLabel: "Muito rápido",
  hzUltraLabel: "Ultra",
  msCycle: "ms/CICLO",
  msOn: "ms LIGADO",
  patterns: "PADRÕES",
  active: "ATIVO",
  addCustom: "ADICIONAR PADRÃO PRÓPRIO",
  customPatternName: "Nome do padrão",
  customPatternAdd: "Adicionar passo",
  customPatternSave: "Guardar padrão",
  customPatternCancel: "Cancelar",
  customPatternDelete: "Eliminar",
  customPatternAddStep: "ADICIONAR PASSO",
  flashOn: "Flash LIGADO",
  flashOff: "Flash DESLIGADO",
  duration: "Duração (ms)",
  sound: "SINCRONIZAÇÃO DE SOM",
  micSync: "SYNC MIC",
  micSyncSub: "Flash ativa ao detetar batidas",
  sensitivity: "SENSIBILIDADE",
  clickSound: "SOM DE CLIQUE",
  clickSoundSub: "Vibrar em cada batida detetada",
  micPermission: "Conceder permissão de microfone",
  waitingForBeat: "A ouvir batidas…",
  beatDetected: "Batida detetada",
  settings: "DEFINIÇÕES",
  updateAvailable: "Atualização disponível",
  downloadUpdate: "Transferir atualização",
  remindLater: "Lembrar-me mais tarde",
  language: "IDIOMA",
  appVersion: "Versão da app",
  platform: "Plataforma",
  buildType: "Tipo de compilação",
  sessionHistory: "HISTÓRICO DE SESSÕES",
  noSessions: "Sem sessões ainda — inicie o strobe para começar.",
  clearHistory: "Limpar histórico",
  clearHistoryConfirm: "Eliminar todas as sessões registadas?",
  delete: "Eliminar",
  cancel: "Cancelar",
  refresh: "Atualizar",
  epilepsyWarning: "⚠️ Aviso de segurança",
  epilepsyBody:
    "Esta app produz luzes intermitentes rápidas. As luzes intermitentes podem provocar convulsões em pessoas com epilepsia fotossensível. Não use se você ou alguém próximo tiver epilepsia. Mantenha distância segura e faça pausas.\n\nAo continuar confirma que leu este aviso.",
  epilepsyAccept: "Entendido, continuar",
  dev: "Desenvolvimento",
  release: "Versão final",
  about: "SOBRE",
  resetWarning: "Mostrar aviso de segurança novamente",
  modeScreen: "Ecrã",
  modeTorch: "Lanterna",
  modeBoth: "Ambos",
};

export const TRANSLATIONS: Record<LangCode, Translations> = { en, es, fr, de, pt };

export const LANG_LABELS: Record<LangCode, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
};
