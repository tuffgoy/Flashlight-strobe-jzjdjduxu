import React from "react";
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface TermsSection {
  id: string;
  title: string;
  content: string | string[];
}

const TERMS_SECTIONS: TermsSection[] = [
  {
    id: "acceptance",
    title: "Acceptance of Terms",
    content:
      'By downloading, installing, or using Flashlight Strobe ("the App"), you agree to be bound by these Terms of Use. If you do not agree, do not use the App. These terms apply to all users of the App on Android and iOS devices.',
  },
  {
    id: "use",
    title: "Permitted Use",
    content: [
      "Personal, non-commercial use of the strobe and flashlight features.",
      "Use in environments where you have confirmed no one nearby is at risk of photosensitive reactions.",
      "Experimentation with frequency and duty-cycle settings for legitimate personal purposes (photography, music sync, effects work, etc.).",
    ],
  },
  {
    id: "prohibited",
    title: "Prohibited Use",
    content: [
      "Directing strobe light at other people without their explicit, informed consent.",
      "Using the App to induce seizures or cause harm to any person.",
      "Operating the App in safety-critical environments (while driving, operating machinery, etc.).",
      "Reverse engineering, decompiling, or redistributing the App or its source code without prior written permission.",
    ],
  },
  {
    id: "health",
    title: "Health & Safety Warning",
    content:
      "Flashing lights at certain frequencies — particularly between 3 Hz and 30 Hz — can trigger seizures in people with photosensitive epilepsy or similar conditions, even in users with no prior history. YOU USE THIS APP AT YOUR OWN RISK. Do not use the strobe feature if you or anyone in the vicinity has a known photosensitive condition. If you experience discomfort, dizziness, or vision disturbance, stop using the App immediately.",
  },
  {
    id: "permissions",
    title: "Device Permissions",
    content:
      "The App requests Camera permission solely to access the rear torch/flashlight LED. No images, video, or audio are captured, recorded, stored, or transmitted at any time. On Android and iOS, flashlight access is bundled under the Camera permission — this is a platform requirement, not a deliberate data-collection choice. For full details, see the Privacy Policy tab.",
  },
  {
    id: "data",
    title: "Data Handling",
    content:
      "The App stores your strobe settings (frequency, duty cycle, last-used pattern) locally on your device using AsyncStorage. No personal data is transmitted to any server. No analytics, advertising SDKs, or crash reporters are included in this version. See the Privacy Policy tab for the complete data disclosure.",
  },
  {
    id: "updates",
    title: "App Updates",
    content:
      "The App may check for available updates by reading a publicly accessible configuration from our file-sharing service. This check is read-only and anonymous — no device identifiers or personal information are sent. You can choose to download and install an update or dismiss the prompt. Updates may include bug fixes, new features, and legal-text revisions.",
  },
  {
    id: "disclaimer",
    title: "Disclaimer of Warranties",
    content:
      "The App is provided \"AS IS\" without warranties of any kind, express or implied, including but not limited to fitness for a particular purpose, merchantability, or uninterrupted operation. We do not warrant that the App will function correctly on all devices or operating-system versions.",
  },
  {
    id: "liability",
    title: "Limitation of Liability",
    content:
      "To the maximum extent permitted by applicable law, the developers of Flashlight Strobe shall not be liable for any direct, indirect, incidental, special, or consequential damages arising from the use or inability to use the App, including but not limited to personal injury, property damage, or loss of data.",
  },
  {
    id: "intellectual",
    title: "Intellectual Property",
    content:
      "The App and all associated source code, assets, and documentation are the exclusive property of the App's developers. Nothing in these Terms grants you any rights to copy, modify, distribute, or sublicense the App outside the scope of normal personal use.",
  },
  {
    id: "changes",
    title: "Changes to These Terms",
    content:
      "We may update these Terms from time to time. When we do, the \"Last updated\" date below will change. Continued use of the App after a change constitutes acceptance of the revised Terms. For significant changes, an in-app notice will be shown on the next launch.",
  },
  {
    id: "contact",
    title: "Contact",
    content:
      "Questions about these Terms? Contact us via the app's store listing page. We typically respond within 48 hours.",
  },
];

export default function TermsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTag}>LEGAL</Text>
      <Text style={styles.pageTitle}>Terms of Use</Text>
      <Text style={styles.lastUpdated}>Last updated: July 3, 2026</Text>

      {/* TL;DR summary card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>TL;DR</Text>
        <View style={styles.summaryRow}>
          <View style={styles.checkDot} />
          <Text style={styles.summaryItem}>Free to use for personal purposes</Text>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.checkDot} />
          <Text style={styles.summaryItem}>Never point strobe at others without consent</Text>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.checkDot} />
          <Text style={styles.summaryItem}>No personal data collected or transmitted</Text>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.checkDot} />
          <Text style={styles.summaryItem}>App provided as-is — use responsibly</Text>
        </View>
      </View>

      {/* Epilepsy warning */}
      <View style={styles.warningCard}>
        <Text style={styles.warningIcon}>⚠️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.warningTitle}>Health Warning</Text>
          <Text style={styles.warningText}>
            Strobing between 3–30 Hz can trigger seizures. Stop immediately if you feel unwell.
          </Text>
        </View>
      </View>

      {/* Sections */}
      {TERMS_SECTIONS.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {Array.isArray(section.content) ? (
            <View style={styles.bulletList}>
              {section.content.map((item, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bullet}>·</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.bodyText}>{section.content}</Text>
          )}
        </View>
      ))}

      {/* Privacy link */}
      <View style={styles.privacyNote}>
        <Text style={styles.privacyNoteText}>
          For details on how the App handles your data, see the{" "}
          <Text style={styles.privacyNoteLink}>Privacy Policy</Text> tab.
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Flashlight Strobe — Use responsibly.</Text>
      </View>
    </ScrollView>
  );
}

function makeStyles(
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>,
  insets: ReturnType<typeof useSafeAreaInsets>,
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      paddingTop: Platform.OS === "web" ? insets.top + 67 : 16,
      paddingBottom: Platform.OS === "web" ? insets.bottom + 34 + 84 : insets.bottom + 100,
      paddingHorizontal: 20,
      gap: 20,
    },
    pageTag: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: 4,
      color: colors.mutedForeground,
    },
    pageTitle: {
      fontSize: 28,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginTop: -8,
    },
    lastUpdated: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: -12,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.primary + "44",
      gap: 10,
    },
    summaryTitle: {
      fontSize: 13,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
      letterSpacing: 1,
      marginBottom: 4,
    },
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    checkDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    summaryItem: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      flex: 1,
    },
    warningCard: {
      backgroundColor: "#ef444422",
      borderRadius: colors.radius,
      padding: 16,
      borderWidth: 1,
      borderColor: "#ef444444",
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
    },
    warningIcon: {
      fontSize: 22,
    },
    warningTitle: {
      fontSize: 14,
      fontFamily: "Inter_700Bold",
      color: "#ef4444",
      marginBottom: 4,
    },
    warningText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      lineHeight: 18,
    },
    section: {
      gap: 10,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    bodyText: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      lineHeight: 22,
    },
    bulletList: {
      gap: 8,
    },
    bulletRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
    },
    bullet: {
      fontSize: 20,
      color: colors.primary,
      lineHeight: 22,
    },
    bulletText: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      lineHeight: 22,
    },
    privacyNote: {
      backgroundColor: colors.muted,
      borderRadius: colors.radius,
      padding: 16,
    },
    privacyNoteText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      lineHeight: 19,
    },
    privacyNoteLink: {
      color: colors.primary,
      fontFamily: "Inter_600SemiBold",
    },
    footer: {
      paddingVertical: 10,
      alignItems: "center",
    },
    footerText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
  });
}
