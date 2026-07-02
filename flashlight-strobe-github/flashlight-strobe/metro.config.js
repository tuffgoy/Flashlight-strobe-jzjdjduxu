const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// react-native-svg v15+ ships ES2022 private class fields (#x, #y, etc.)
// that hermesc cannot compile. Extend transformIgnorePatterns so these
// packages are Babel-transformed before the bundle reaches hermesc.
//
// IMPORTANT: Metro requires RegExp objects — plain strings are silently ignored.
//
// PNPM PATH FIX: pnpm stores packages at:
//   node_modules/.pnpm/<pkg>@<ver>_<hash>/node_modules/<pkg>/
// A standard regex like /node_modules\/(?!(react-native-svg)\/.*)/ tests against
// the full file path and matches on the FIRST "node_modules/", seeing ".pnpm"
// next — so the negative lookahead passes and ALL pnpm packages are ignored.
// Fix: add (.pnpm\/[^/]+\/node_modules\/)? inside the lookahead so the regex
// correctly peeks through the pnpm prefix to find the real package name.
config.transformer.transformIgnorePatterns = [
  /node_modules\/(?!(\.pnpm\/[^/]+\/node_modules\/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?\/.*|@expo-google-fonts\/.*|react-navigation|@react-navigation\/.*|@unimodules\/.*|unimodules|sentry-expo|native-base|@sentry\/.*|react-native-svg|react-native-reanimated|react-native-worklets|react-native-screens|react-native-gesture-handler|react-native-safe-area-context|react-native-keyboard-controller)\/)/,
];

module.exports = config;
