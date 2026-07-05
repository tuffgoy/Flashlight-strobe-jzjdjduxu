import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface PolicySection {
  id: string;
  title: string;
  content: string | string[];
}

const POLICY_SECTIONS: PolicySection[] = [
  {
    id: "overview",
    title: "Overview",
    content:
      "Flashlight Strobe is designed with privacy as a core principle. We collect the absolute minimum data required to operate the app — and in most cases, we collect nothing at all. This page explains exactly what happens with your data.",
  },
  {
    id: "collected",
    title: "Data We Collect",
    content: [
      "Camera permission status — we ask for permission to access your device's torch/flashlight. We store whether permission was granted locally on your device only.",
      "Strobe settings (Hz, duty cycle, last-used pattern) — saved locally in your device's storage using AsyncStorage. Never transmitted.",
      "Nothing else. No name, no email, no account required.",
    ],
  },
  {
    id: "not_collected",
    title: "Data We Do NOT Collect",
    content: [
      "Personal identification information (name, email, phone number, address)",
      "Location or GPS data",
      "Contacts or calendar access",
      "Device IMEI, serial number, or hardware identifiers",
      "Photos, videos, or any camera image data — we only access the torch LED, not the camera sensor",
      "Network activity logs or browsing history",
      "Crash reports or analytics (in this version)",
    ],
  },
  {
    id: "camera",
    title: "Camera Permission",
    content:
      "The app requests camera permission solely to access your device's rear flashlight/torch LED. We do not capture, record, store, or transmit any images or video. The camera sensor is never activated. On Android and iOS, torch access is bundled under the camera permission — this is a platform limitation, not a deliberate data collection choice.",
  },
  {
    id: "local_storage",
    title: "Local Storage",
    content:
      "Your preferences (selected Hz, duty cycle, last pattern) are stored in your device's local AsyncStorage — a standard React Native key-value store. This data lives entirely on your device, is never synced to a server, and is deleted when you uninstall the app.",
  },
  {
    id: "third_party",
    title: "Third-Party Services",
    content:
      "This version of Flashlight Strobe does not integrate with any third-party analytics, advertising, tracking, or crash-reporting SDK. No data is shared with any external party.",
  },
  {
    id: "children",
    title: "Children's Privacy",
    content:
      "Flashlight Strobe does not knowingly collect any information from users under 13. If you believe your child has provided information, contact us and we will delete it promptly.",
  },
  {
    id: "epilepsy",
    title: "Photosensitivity Warning",
    content:
      "Flashing lights at certain frequencies can trigger seizures in people with photosensitive epilepsy. Do NOT use strobe frequencies between 3–30 Hz if you or anyone nearby has a history of photosensitive conditions. The app is designed for personal use only. Do not direct strobe light at others without their informed consent.",
  },
  {
    id: "changes",
    title: "Changes to This Policy",
    content:
      "If we update this privacy policy, we will change the \"Last updated\" date at the top of this page. For significant changes, we will notify users via an in-app alert on the next launch.",
  },
  {
    id: "contact",
    title: "Contact",
    content:
      "Questions about this policy? Reach out via Whatsapp for now. We typically respond within 48 hours.",
  },
];

export default function PrivacyScreen() {
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
      <Text style={styles.pageTitle}>Privacy Policy</Text>
      <Text style={styles.lastUpdated}>Last updated: June 30, 2026</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>TL;DR</Text>
        <View style={styles.summaryRow}>
          <View style={styles.checkDot} />
          <Text style={styles.summaryItem}>No account required</Text>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.checkDot} />
          <Text style={styles.summaryItem}>No personal data collected</Text>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.checkDot} />
          <Text style={styles.summaryItem}>No third-party tracking</Text>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.checkDot} />
          <Text style={styles.summaryItem}>Camera used for torch only — no images captured</Text>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.checkDot} />
          <Text style={styles.summaryItem}>All settings stored locally on your device</Text>
        </View>
      </View>

      <View style={styles.warningCard}>
        <Text style={styles.warningIcon}>⚠️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.warningTitle}>Photosensitivity Warning</Text>
          <Text style={styles.warningText}>
            Strobing between 3–30 Hz may trigger seizures in susceptible individuals. Use responsibly.
          </Text>
        </View>
      </View>

      {POLICY_SECTIONS.map((section) => (
        <View key={section.id} style={styles.policySection}>
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

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Flashlight Strobe — Built with privacy by default.
        </Text>
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof import("@/hooks/useColors").useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
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
    policySection: {
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
