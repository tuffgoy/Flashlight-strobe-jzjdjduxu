import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const MIN_HZ = 0.5;
const MAX_HZ = 30;
const MIN_DUTY = 10;
const MAX_DUTY = 90;

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export default function StrobeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [isActive, setIsActive] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hz, setHz] = useState(10);
  const [dutyCycle, setDutyCycle] = useState(50);

  const glowAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleStrobe = useCallback(
    (currentlyOn: boolean, hzVal: number, dutyVal: number) => {
      const period = 1000 / hzVal;
      const onTime = period * (dutyVal / 100);
      const offTime = period * (1 - dutyVal / 100);

      if (currentlyOn) {
        timeoutRef.current = setTimeout(() => {
          setTorchOn(false);
          if (Platform.OS === "web") {
            Animated.timing(flashAnim, {
              toValue: 0,
              duration: 10,
              useNativeDriver: true,
            }).start();
          }
          scheduleStrobe(false, hzVal, dutyVal);
        }, onTime);
      } else {
        timeoutRef.current = setTimeout(() => {
          setTorchOn(true);
          if (Platform.OS === "web") {
            Animated.timing(flashAnim, {
              toValue: 1,
              duration: 10,
              useNativeDriver: true,
            }).start();
          }
          scheduleStrobe(true, hzVal, dutyVal);
        }, offTime);
      }
    },
    [flashAnim]
  );

  useEffect(() => {
    clearTimer();
    if (!isActive) {
      setTorchOn(false);
      flashAnim.setValue(0);
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();

    setTorchOn(true);
    if (Platform.OS === "web") flashAnim.setValue(1);
    scheduleStrobe(true, hz, dutyCycle);

    return () => {
      clearTimer();
      setTorchOn(false);
      flashAnim.setValue(0);
    };
  }, [isActive, hz, dutyCycle, scheduleStrobe, clearTimer, glowAnim, flashAnim]);

  const handleToggle = async () => {
    if (!isActive && permission && !permission.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsActive((prev) => !prev);
  };

  const adjustHz = (delta: number) => {
    setHz((prev) => {
      const next = parseFloat((prev + delta).toFixed(1));
      return clamp(next, MIN_HZ, MAX_HZ);
    });
  };

  const adjustDuty = (delta: number) => {
    setDutyCycle((prev) => clamp(prev + delta, MIN_DUTY, MAX_DUTY));
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  const styles = makeStyles(colors, insets);

  return (
    <View style={styles.root}>
      {/* Web flash overlay */}
      {Platform.OS === "web" && (
        <Animated.View
          pointerEvents="none"
          style={[styles.flashOverlay, { opacity: flashAnim }]}
        />
      )}

      {/* Hidden camera view for torch on native */}
      {Platform.OS !== "web" && permission?.granted && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          enableTorch={torchOn}
          facing="back"
        />
      )}

      {/* Dark overlay when camera visible */}
      {Platform.OS !== "web" && permission?.granted && (
        <View style={styles.cameraOverlay} />
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.titleLabel}>STROBE</Text>

        {/* Main toggle button */}
        <View style={styles.buttonWrap}>
          <Animated.View
            style={[styles.glowRing, { opacity: glowOpacity }]}
          />
          <Pressable
            style={[styles.mainButton, isActive && styles.mainButtonActive]}
            onPress={handleToggle}
            testID="strobe-toggle"
          >
            <Text style={[styles.buttonIcon, isActive && styles.buttonIconActive]}>
              ⚡
            </Text>
            <Text style={[styles.buttonLabel, isActive && styles.buttonLabelActive]}>
              {isActive ? "ON" : "OFF"}
            </Text>
          </Pressable>
        </View>

        {/* Hz control */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>FREQUENCY</Text>
          <Text style={styles.bigValue}>{hz.toFixed(1)} Hz</Text>
          <Text style={styles.subText}>{hz < 3 ? "Slow" : hz < 10 ? "Medium" : hz < 20 ? "Fast" : "Rapid"}</Text>

          <View style={styles.sliderTrack}>
            <View
              style={[
                styles.sliderFill,
                {
                  width: `${((hz - MIN_HZ) / (MAX_HZ - MIN_HZ)) * 100}%` as any,
                },
              ]}
            />
          </View>

          <View style={styles.adjRow}>
            {[-5, -1, -0.5].map((d) => (
              <Pressable
                key={d}
                style={styles.adjBtn}
                onPress={() => adjustHz(d)}
              >
                <Text style={styles.adjBtnText}>{d > 0 ? `+${d}` : d}</Text>
              </Pressable>
            ))}
            <View style={{ flex: 1 }} />
            {[0.5, 1, 5].map((d) => (
              <Pressable
                key={d}
                style={styles.adjBtn}
                onPress={() => adjustHz(d)}
              >
                <Text style={styles.adjBtnText}>+{d}</Text>
              </Pressable>
            ))}
          </View>

          {/* Hz presets */}
          <View style={styles.presetRow}>
            {[1, 5, 10, 15, 20, 30].map((v) => (
              <Pressable
                key={v}
                style={[styles.presetBtn, hz === v && styles.presetBtnActive]}
                onPress={() => setHz(v)}
              >
                <Text style={[styles.presetText, hz === v && styles.presetTextActive]}>
                  {v}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Duty cycle */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>DUTY CYCLE</Text>
          <Text style={styles.bigValue}>{dutyCycle}%</Text>
          <Text style={styles.subText}>Flash on time per cycle</Text>

          <View style={styles.sliderTrack}>
            <View
              style={[
                styles.sliderFill,
                {
                  width: `${((dutyCycle - MIN_DUTY) / (MAX_DUTY - MIN_DUTY)) * 100}%` as any,
                },
              ]}
            />
          </View>

          <View style={styles.adjRow}>
            {[-20, -10, -5].map((d) => (
              <Pressable
                key={d}
                style={styles.adjBtn}
                onPress={() => adjustDuty(d)}
              >
                <Text style={styles.adjBtnText}>{d}</Text>
              </Pressable>
            ))}
            <View style={{ flex: 1 }} />
            {[5, 10, 20].map((d) => (
              <Pressable
                key={d}
                style={styles.adjBtn}
                onPress={() => adjustDuty(d)}
              >
                <Text style={styles.adjBtnText}>+{d}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Status info */}
        <View style={styles.statusRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{hz.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Hz</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{dutyCycle}%</Text>
            <Text style={styles.statLabel}>Duty</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{(1000 / hz).toFixed(0)}</Text>
            <Text style={styles.statLabel}>ms period</Text>
          </View>
        </View>

        {Platform.OS !== "web" && !permission?.granted && (
          <Pressable style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Grant Camera Permission</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import("@/hooks/useColors").useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flashOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "#FFEE88",
      zIndex: 999,
      pointerEvents: "none" as any,
    },
    cameraOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.92)",
    },
    scroll: {
      paddingTop: Platform.OS === "web" ? insets.top + 67 : 16,
      paddingBottom: Platform.OS === "web" ? insets.bottom + 34 + 84 : insets.bottom + 100,
      paddingHorizontal: 20,
      alignItems: "center",
      gap: 20,
    },
    titleLabel: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: 4,
      color: colors.mutedForeground,
      marginBottom: 4,
    },
    buttonWrap: {
      alignItems: "center",
      justifyContent: "center",
      width: 200,
      height: 200,
    },
    glowRing: {
      position: "absolute",
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: "#FFD700",
      shadowColor: "#FFD700",
      shadowRadius: 40,
      shadowOpacity: 0.8,
      shadowOffset: { width: 0, height: 0 },
    },
    mainButton: {
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: colors.card,
      borderWidth: 3,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    mainButtonActive: {
      backgroundColor: "#FFD700",
      borderColor: "#FFD700",
    },
    buttonIcon: {
      fontSize: 52,
    },
    buttonIconActive: {},
    buttonLabel: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      letterSpacing: 3,
      color: colors.mutedForeground,
    },
    buttonLabelActive: {
      color: "#0a0a0a",
    },
    card: {
      width: "100%",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    cardTitle: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: 3,
      color: colors.mutedForeground,
    },
    bigValue: {
      fontSize: 42,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
      lineHeight: 48,
    },
    subText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: -8,
    },
    sliderTrack: {
      height: 6,
      backgroundColor: colors.muted,
      borderRadius: 3,
      overflow: "hidden",
    },
    sliderFill: {
      height: "100%",
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    adjRow: {
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
    },
    adjBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.muted,
      borderRadius: 8,
    },
    adjBtnText: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    presetRow: {
      flexDirection: "row",
      gap: 6,
      flexWrap: "wrap",
    },
    presetBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.muted,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "transparent",
    },
    presetBtnActive: {
      backgroundColor: "transparent",
      borderColor: colors.primary,
    },
    presetText: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    presetTextActive: {
      color: colors.primary,
      fontFamily: "Inter_600SemiBold",
    },
    statusRow: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      width: "100%",
    },
    statItem: {
      flex: 1,
      paddingVertical: 16,
      alignItems: "center",
      gap: 4,
    },
    statValue: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    statLabel: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      letterSpacing: 1,
    },
    statDivider: {
      width: 1,
      backgroundColor: colors.border,
    },
    permBtn: {
      width: "100%",
      paddingVertical: 14,
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      alignItems: "center",
    },
    permBtnText: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: "#0a0a0a",
    },
  });
}
