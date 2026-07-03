import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface IdeaSection {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  tag: string;
  tagColor: string;
  items: Array<{
    title: string;
    description: string;
    complexity: "Low" | "Medium" | "High";
  }>;
}

const SECTIONS: IdeaSection[] = [
  {
    id: "logging",
    emoji: "📊",
    title: "Session Logging",
    subtitle: "Track every strobe session for analytics and diagnostics",
    tag: "Analytics",
    tagColor: "#3b82f6",
    items: [
      {
        title: "Local Session History",
        description:
          "Store each session (start time, duration, Hz, duty cycle, pattern name) in AsyncStorage. Export as JSON or CSV for personal review.",
        complexity: "Low",
      },
      {
        title: "Crash & Error Reporting",
        description:
          "Integrate Sentry or Bugsnag to capture native crashes and unhandled JS exceptions with full stack traces. Events tagged by app version and device model.",
        complexity: "Medium",
      },
      {
        title: "Usage Analytics (Privacy-first)",
        description:
          "Opt-in anonymous telemetry via PostHog or Mixpanel. Track feature adoption (which patterns are most used, average Hz). No PII, no hardware fingerprinting.",
        complexity: "Medium",
      },
      {
        title: "Performance Metrics",
        description:
          "Log actual vs intended strobe timing using a high-resolution timer. Surface average frame drift per Hz setting — helps identify hardware limits on older devices.",
        complexity: "High",
      },
    ],
  },
  {
    id: "remote_updates",
    emoji: "🚀",
    title: "Remote Updates",
    subtitle: "Push live changes to users without App Store review cycles",
    tag: "OTA",
    tagColor: "#22c55e",
    items: [
      {
        title: "Expo OTA Updates (EAS Update)",
        description:
          "Ship JS/CSS/asset patches instantly via Expo's EAS Update. Users get the new logic on next launch with no App Store submission. Keep native modules pinned.",
        complexity: "Low",
      },
      {
        title: "Remote Config (Firebase / AWS AppConfig)",
        description:
          "Drive app behavior (default Hz, max Hz limit, feature flags, pattern list) from a remote JSON config. Changes apply on next session without a code deploy.",
        complexity: "Medium",
      },
      {
        title: "Kill Switch",
        description:
          "Add a remote flag to disable specific features (e.g., >25 Hz in regions with epilepsy regulations). Fetched on startup, falls back to last cached value if offline.",
        complexity: "Medium",
      },
      {
        title: "A/B Testing",
        description:
          "Serve different default configurations to randomized user cohorts via Firebase Remote Config or Statsig. Measure retention and engagement per variant.",
        complexity: "High",
      },
    ],
  },
  {
    id: "source_control",
    emoji: "🔐",
    title: "Partial Remote Source Control",
    subtitle: "Professional pattern for evolving live apps without full redeploys",
    tag: "Advanced",
    tagColor: "#a855f7",
    items: [
      {
        title: "Pattern Definition API",
        description:
          "Store strobe patterns as JSON on a backend (Supabase or simple REST API). The app fetches and renders user-created or admin-defined patterns dynamically — no code change needed to add new patterns.",
        complexity: "Medium",
      },
      {
        title: "JS Bundle Splitting (Code Push Style)",
        description:
          "Isolate feature modules into independently updatable chunks. Non-critical UI screens (settings, roadmap, privacy) can be updated via OTA; core strobe engine stays in the native bundle for reliability.",
        complexity: "High",
      },
      {
        title: "Server-Driven UI for Info Pages",
        description:
          "Serve the roadmap and privacy pages as structured JSON (title, sections, items) from an API. Edit content from a CMS (Contentful, Sanity, Notion API) without a code deploy — perfect for legal text updates.",
        complexity: "Medium",
      },
      {
        title: "Feature Flag Gates",
        description:
          "Wrap experimental features (new pattern algorithms, haptic feedback modes) behind flag checks. Deploy code to all users but activate only for beta testers via a flag service (LaunchDarkly, GrowthBook).",
        complexity: "High",
      },
      {
        title: "Signed Config Payloads",
        description:
          "HMAC-sign all remote configs so the app can verify authenticity before applying. Prevents man-in-the-middle config injection. Use the app's bundle ID as part of the signing key.",
        complexity: "High",
      },
    ],
  },
];

const complexityColor: Record<string, string> = {
  Low: "#22c55e",
  Medium: "#f59e0b",
  High: "#ef4444",
};

export default function RoadmapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<string | null>("logging");

  const styles = makeStyles(colors, insets);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>ENGINEERING ROADMAP</Text>
      <Text style={styles.pageSubtitle}>
        Professional formula for logging, remote delivery, and live source control
        — ready to implement.
      </Text>

      {SECTIONS.map((section) => {
        const isOpen = expanded === section.id;
        return (
          <View key={section.id} style={styles.sectionCard}>
            <Pressable
              style={styles.sectionHeader}
              onPress={() => setExpanded(isOpen ? null : section.id)}
            >
              <View style={styles.sectionMeta}>
                <Text style={styles.sectionEmoji}>{section.emoji}</Text>
                <View style={styles.sectionTextBlock}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <View style={[styles.sectionTag, { backgroundColor: section.tagColor + "22", borderColor: section.tagColor + "55" }]}>
                      <Text style={[styles.sectionTagText, { color: section.tagColor }]}>{section.tag}</Text>
                    </View>
                  </View>
                  <Text style={styles.sectionSub}>{section.subtitle}</Text>
                </View>
              </View>
              <Text style={[styles.chevron, isOpen && styles.chevronOpen]}>›</Text>
            </Pressable>

            {isOpen && (
              <View style={styles.itemList}>
                <View style={styles.divider} />
                {section.items.map((item, i) => (
                  <View key={i} style={styles.ideaItem}>
                    <View style={styles.ideaItemHeader}>
                      <Text style={styles.ideaTitle}>{item.title}</Text>
                      <View
                        style={[
                          styles.complexityBadge,
                          { backgroundColor: complexityColor[item.complexity] + "22" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.complexityText,
                            { color: complexityColor[item.complexity] },
                          ]}
                        >
                          {item.complexity}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.ideaDesc}>{item.description}</Text>
                    {i < section.items.length - 1 && <View style={styles.itemDivider} />}
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

      <View style={styles.noteCard}>
        <Text style={styles.noteIcon}>💡</Text>
        <Text style={styles.noteText}>
          Start with <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Expo OTA + Remote Config</Text> — lowest effort, highest impact. Add session logging and pattern API as the user base grows.
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
      gap: 14,
    },
    pageTitle: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: 4,
      color: colors.mutedForeground,
    },
    pageSubtitle: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      lineHeight: 21,
      marginBottom: 6,
    },
    sectionCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      gap: 12,
    },
    sectionMeta: {
      flex: 1,
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
    },
    sectionEmoji: {
      fontSize: 28,
      lineHeight: 36,
    },
    sectionTextBlock: {
      flex: 1,
      gap: 4,
    },
    sectionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    sectionTag: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
    },
    sectionTagText: {
      fontSize: 10,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: 0.5,
    },
    sectionSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      lineHeight: 17,
    },
    chevron: {
      fontSize: 22,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      transform: [{ rotate: "0deg" }],
    },
    chevronOpen: {
      transform: [{ rotate: "90deg" }],
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    itemList: {
      gap: 0,
    },
    ideaItem: {
      padding: 16,
      gap: 8,
    },
    ideaItemHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 8,
    },
    ideaTitle: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      flex: 1,
    },
    complexityBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    complexityText: {
      fontSize: 10,
      fontFamily: "Inter_600SemiBold",
    },
    ideaDesc: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      lineHeight: 19,
    },
    itemDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginTop: 8,
    },
    noteCard: {
      backgroundColor: colors.muted,
      borderRadius: colors.radius,
      padding: 16,
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
      marginTop: 4,
    },
    noteIcon: {
      fontSize: 20,
    },
    noteText: {
      flex: 1,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      lineHeight: 19,
    },
  });
}
