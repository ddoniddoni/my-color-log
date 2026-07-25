import { useFonts } from 'expo-font';
import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { type ThemeColors } from '@/src/design/tokens';

const ICON_SIZE = 128;

export function BrandSplash() {
  const { colors } = useAppTheme();
  const styles = useBrandSplashStyles();
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const titleFont = fontsLoaded ? 'BricolageGrotesque_800ExtraBold' : undefined;
  const labelFont = fontsLoaded ? 'BricolageGrotesque_600SemiBold' : undefined;
  const floatProgress = useSharedValue(0);
  const floatingIconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -10 * floatProgress.value },
      { rotate: `${-1 + 2 * floatProgress.value}deg` },
    ],
  }));

  useEffect(() => {
    floatProgress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2_000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2_000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(floatProgress);
    };
  }, [floatProgress]);

  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.drawScribble}><DrawScribble color={colors.ink} /></View>
      <View pointerEvents="none" style={styles.paletteScribble}><PaletteDoodle color={colors.ink} /></View>

      <View style={styles.main}>
        <View style={styles.logoGroup}>
          <Animated.View accessible accessibilityLabel="카메라와 팔레트 로고" accessibilityRole="image" style={[styles.iconWrap, floatingIconStyle]}>
            <View style={styles.iconShadow} />
            <View style={styles.iconCard}>
              <View style={styles.cameraBadge}><CameraGlyph color={colors.ink} /></View>
              <PaletteDoodle color={colors.ink} />
            </View>
          </Animated.View>

          <View style={styles.branding}>
            <AppText style={[styles.title, { fontFamily: titleFont }]}>Color Log</AppText>
            <View style={styles.titleLine} />
          </View>

          <View accessible accessibilityLabel="시작 준비 중" accessibilityLiveRegion="polite" accessibilityRole="progressbar" style={styles.loadingDots}>
            <View style={styles.loadingDot} />
            <View style={styles.loadingDot} />
            <View style={styles.loadingDot} />
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerLine} />
        <AppText style={[styles.footerText, { fontFamily: labelFont }]}>Hand-crafted by <AppText style={[styles.footerStrong, { fontFamily: fontsLoaded ? 'BricolageGrotesque_700Bold' : undefined }]}>Color Log Studio</AppText></AppText>
      </View>
    </View>
  );
}

function CameraGlyph({ color }: { color: string }) {
  return (
    <Svg height={18} viewBox="0 0 24 24" width={18}>
      <Rect fill="none" height="13" rx="1.5" stroke={color} strokeWidth="1.8" width="18" x="3" y="7" />
      <Path d="M8 7 9.5 4.5h5L16 7" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <Circle cx="12" cy="13.5" fill="none" r="3.2" stroke={color} strokeWidth="1.8" />
    </Svg>
  );
}

function PaletteDoodle({ color }: { color: string }) {
  return (
    <Svg height="100%" viewBox="0 0 100 100" width="100%">
      <Path d="M20,50 C20,30 40,15 65,15 C85,15 95,30 95,50 C95,75 75,95 45,95 C25,95 10,80 10,65 C10,55 15,50 20,50 Z" fill="none" stroke={color} strokeWidth="3" />
      <Circle cx="35" cy="35" fill="none" r="5" stroke={color} strokeWidth="3" />
      <Circle cx="55" cy="30" fill="none" r="5" stroke={color} strokeWidth="3" />
      <Circle cx="75" cy="40" fill="none" r="5" stroke={color} strokeWidth="3" />
      <Circle cx="80" cy="60" fill="none" r="5" stroke={color} strokeWidth="3" />
      <Path d="M35,70 Q45,70 45,80 Q45,90 35,90 Q25,90 25,80 Q25,70 35,70" fill="none" stroke={color} strokeWidth="3" />
    </Svg>
  );
}

function DrawScribble({ color }: { color: string }) {
  return (
    <Svg height={80} viewBox="0 0 80 80" width={80}>
      <Path d="M19 53c-4-6-4-14 4-20l22-18 8 8-17 24c-5 7-11 10-17 6Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="6" />
      <Path d="m46 14 8 8M18 53l-4 9 9-4M56 42c7 0 11 4 11 10M53 48c4 0 6 2 6 5" fill="none" stroke={color} strokeLinecap="round" strokeWidth="5" />
    </Svg>
  );
}

function useBrandSplashStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  main: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  logoGroup: { alignItems: 'center', gap: 32 },
  iconWrap: { height: ICON_SIZE, position: 'relative', width: ICON_SIZE },
  iconShadow: { backgroundColor: colors.black, borderRadius: 8, height: ICON_SIZE, left: 6, position: 'absolute', top: 6, width: ICON_SIZE },
  iconCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.ink, borderRadius: 8, borderWidth: 3, height: ICON_SIZE, justifyContent: 'center', padding: 16, transform: [{ rotate: '2deg' }], width: ICON_SIZE },
  cameraBadge: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.ink, borderRadius: 16, borderWidth: 2.5, height: 32, justifyContent: 'center', left: -12, position: 'absolute', top: -12, width: 32 },
  branding: { alignItems: 'center' },
  title: { color: colors.ink, fontSize: 48, fontWeight: '800', letterSpacing: -0.96, lineHeight: 53, textShadowColor: 'rgba(0, 0, 0, 0.1)', textShadowOffset: { height: 1, width: 1 }, textShadowRadius: 0 },
  titleLine: { backgroundColor: colors.ink, borderRadius: 2, height: 4, marginTop: 8, opacity: 0.8, transform: [{ rotate: '-1deg' }], width: 128 },
  loadingDots: { flexDirection: 'row', gap: 12, marginTop: 16 },
  loadingDot: { backgroundColor: colors.ink, borderRadius: 6, height: 12, width: 12 },
  drawScribble: { left: 40, opacity: 0.2, position: 'absolute', top: 80, transform: [{ rotate: '-12deg' }] },
  paletteScribble: { bottom: 160, height: 100, opacity: 0.2, position: 'absolute', right: 40, transform: [{ rotate: '12deg' }], width: 100 },
  footer: { alignItems: 'center', paddingBottom: 32, paddingHorizontal: 16, paddingTop: 32, position: 'relative' },
  footerLine: { backgroundColor: colors.ink, height: 2.5, left: '50%', opacity: 0.3, position: 'absolute', top: 16, transform: [{ translateX: -64 }, { rotate: '1deg' }], width: 128 },
  footerText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600', letterSpacing: 0.35, lineHeight: 17, textAlign: 'center' },
  footerStrong: { color: colors.ink, fontWeight: '700' },
  });
}
