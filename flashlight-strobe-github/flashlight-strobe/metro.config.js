const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// ── Asset optimisation ────────────────────────────────────────────────────────
// Only bundle the asset extensions the app actually uses.
// Removing rarely-needed types (3d assets, exotic fonts, etc.) trims the bundle.
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) =>
    ![
      "glb", "gltf", "obj", "fbx", "stl",   // 3D models — unused
      "db", "sqlite",                         // database files — unused
      "otf",                                  // OpenType fonts — we use Inter (ttf/woff via expo-font)
    ].includes(ext)
);

// ── Tree-shake: only include source extensions actually used ──────────────────
// Default already covers ts/tsx/js/jsx; leaving as-is but documenting it here.
// config.resolver.sourceExts stays at the default.

// ── Minifier (Hermes Babel transformer already handles this in release) ───────
// For web builds we can opt into terser via the transformer field.
// No change needed here — EAS handles minification for native release builds.

module.exports = config;
