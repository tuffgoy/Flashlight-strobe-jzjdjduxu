import { useColorScheme } from 'react-native';
import colors from '@/constants/colors';

/**
 * Returns the design tokens for the current color scheme.
 * Both light and dark palettes are defined in constants/colors.ts.
 * The strobe app always uses dark tokens regardless of system setting,
 * but the hook respects the system scheme if you ever add a true light palette.
 */
export function useColors() {
  const scheme = useColorScheme();
  // Both palettes are identical (always-dark theme), but we resolve correctly.
  const palette = scheme === 'dark' ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
