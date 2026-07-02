// metro.config.js — pnpm-aware transformIgnorePatterns
// COMMITTED SOURCE FILE — do not simplify the regex back to a standard one.
//
// WHY THIS IS NEEDED:
// pnpm stores packages at:
//   node_modules/.pnpm/<pkg>@<ver>_<hash>/node_modules/<pkg>/src/file.js
//
// Standard Metro regex (e.g. /node_modules\/(?!(react-native-svg)\/.*)\//):
//   - Tests against the FULL absolute file path
//   - Matches on the FIRST "node_modules/" — which sees ".pnpm" immediately after
//   - Negative lookahead passes (.pnpm is not in the allowlist) → file IGNORED
//   - react-native-svg gets silently skipped; hermesc sees raw ES2022 private fields
//
// FIX: add optional (\.pnpm\/[^/]+\/node_modules\/)? prefix inside the lookahead
// so the regex correctly sees the real package name even in pnpm's nested structure.

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer = config.transformer || {};
config.transformer.transformIgnorePatterns = [
  /node_modules\/(?!(\.pnpm\/[^/]+\/node_modules\/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?\/.*|@expo-google-fonts\/.*|react-navigation|@react-navigation\/.*|@unimodules\/.*|unimodules|sentry-expo|native-base|react-native-svg)\/).*/,
];

module.exports = config;
