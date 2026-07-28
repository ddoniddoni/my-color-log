import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { useFonts } from 'expo-font';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { type ThemeColors } from '@/src/design/tokens';
import { type DailyMission, type MissionRevealColor } from '@/src/features/missions/model/dailyMission';
import { getRevealTargetRotation, MISSION_REVEAL_SLOT_COUNT } from '@/src/features/missions/model/missionRevealWheel';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';

type MissionRevealProps = {
  mission: DailyMission;
  palette: readonly MissionRevealColor[];
  reduceMotion: boolean;
  onRevealed: () => Promise<void>;
};

const INITIAL_WHEEL_ROTATION = 165;

export function MissionReveal({ mission, palette, reduceMotion, onRevealed }: MissionRevealProps) {
  const theme = useAppTheme();
  const styles = useMissionRevealStyles();
  const { language, t } = useAppLanguage();
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const [isRevealing, setIsRevealing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const insets = useSafeAreaInsets();
  const rotation = useSharedValue(INITIAL_WHEEL_ROTATION);
  const resultProgress = useSharedValue(0);
  const wheelStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const resultStyle = useAnimatedStyle(() => ({ opacity: interpolate(resultProgress.value, [0, 1], [0, 1]), transform: [{ translateY: reduceMotion ? 0 : interpolate(resultProgress.value, [0, 1], [8, 0]) }] }));
  const displayFont = fontsLoaded ? 'BricolageGrotesque_800ExtraBold' : undefined;
  const titleFont = fontsLoaded ? 'BricolageGrotesque_700Bold' : undefined;
  const targetIndex = palette.findIndex((color) => color.id === mission.color.id);
  const colorName = language === 'ko' ? mission.color.nameKo : mission.color.nameEn;

  const finishReveal = useCallback(() => {
    void onRevealed().catch(() => {
      resultProgress.set(0);
      setShowResult(false);
      setIsRevealing(false);
    });
  }, [onRevealed, resultProgress]);

  const showRevealResult = useCallback(() => {
    setShowResult(true);
    resultProgress.set(withSequence(
      withTiming(1, { duration: reduceMotion ? 120 : 220 }),
      withDelay(reduceMotion ? 240 : 620, withTiming(0, { duration: 1 }, (finished) => {
        if (finished) runOnJS(finishReveal)();
      })),
    ));
  }, [finishReveal, reduceMotion, resultProgress]);

  const handleReveal = (): void => {
    if (isRevealing || targetIndex < 0 || palette.length !== MISSION_REVEAL_SLOT_COUNT) return;
    setIsRevealing(true);
    setShowResult(false);
    resultProgress.set(0);
    if (reduceMotion) {
      showRevealResult();
      return;
    }
    rotation.value = withTiming(
      getRevealTargetRotation(targetIndex),
      { duration: 2_200, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(showRevealResult)();
        else runOnJS(setIsRevealing)(false);
      },
    );
  };

  return (
    <View style={styles.page}>
      <WavyPaper color={theme.colors.border} />
      <View style={[styles.navBar, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.navBrand}><MenuIcon color={theme.colors.ink} /><AppText style={[styles.wordmark, { fontFamily: titleFont }]}>Color Log</AppText></View>
        <BellIcon color={theme.colors.ink} />
      </View>

      <View style={styles.content}>
        <View style={styles.copy}>
          <AppText style={[styles.title, { fontFamily: displayFont }]}>오늘의 컬러 룰렛</AppText>
          <View style={styles.markerLine} />
          <AppText style={[styles.subtitle, { fontFamily: fontsLoaded ? 'BricolageGrotesque_400Regular' : undefined }]}>색을 돌려 오늘의 장면을 만나보세요.</AppText>
        </View>

        <View accessibilityLabel={language === 'ko' ? `${MISSION_REVEAL_SLOT_COUNT}가지 실제 색상으로 구성된 오늘의 ${colorName} 룰렛` : `Today’s ${colorName} wheel with ${MISSION_REVEAL_SLOT_COUNT} real colors`} accessible={!showResult} style={styles.wheelFrame}>
          <Animated.View style={[styles.wheel, wheelStyle]}>
            <WheelArtwork colors={theme.colors} palette={palette} />
          </Animated.View>
          <View pointerEvents="none" style={styles.pointer}>
            <WheelPointer fill={theme.colors.ink} stroke={theme.colors.surface} />
          </View>
          {showResult ? <Animated.View accessibilityLabel={language === 'ko' ? `오늘의 색은 ${colorName}` : `Today’s color is ${colorName}`} accessibilityLiveRegion="assertive" accessibilityRole="alert" accessible pointerEvents="none" style={[styles.resultCard, { backgroundColor: mission.color.accentTint }, resultStyle]}>
            <AppText style={styles.resultEyebrow}>오늘의 색</AppText>
            <AppText style={styles.resultName}>{colorName}</AppText>
          </Animated.View> : null}
        </View>

        <Pressable
          accessibilityLabel={t('오늘의 색 룰렛 돌리기')}
          accessibilityRole="button"
          accessibilityState={{ busy: isRevealing, disabled: isRevealing }}
          disabled={isRevealing}
          onPress={handleReveal}
          style={({ pressed }) => [styles.spinButton, isRevealing && styles.spinButtonDisabled, pressed && !isRevealing && styles.spinButtonPressed]}
        >
          <AppText style={[styles.spinButtonText, { fontFamily: titleFont }]}>{isRevealing ? '색을 고르는 중…' : '오늘의 색 돌리기'}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

function WavyPaper({ color }: { color: string }) {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern height={40} id="roulette-waves" patternUnits="userSpaceOnUse" width={40}>
          <Path d="M0 20c5 0 5-5 10-5s5 5 10 5 5-5 10-5 5 5 10 5" fill="none" stroke={color} strokeWidth={1} />
        </Pattern>
      </Defs>
      <Rect fill="url(#roulette-waves)" height="100%" width="100%" />
    </Svg>
  );
}

function WheelArtwork({ colors, palette }: { colors: ThemeColors; palette: readonly MissionRevealColor[] }) {
  return (
    <Svg height="100%" viewBox="0 0 100 100" width="100%">
      <Circle cx={50} cy={50} fill={colors.surface} r={49.5} />
      {palette.map((color, index) => <Path d={createWheelSectorPath(index, palette.length)} fill={color.accent} key={color.id} stroke={colors.ink} strokeWidth={0.48} />)}
      <Circle cx={50} cy={50} fill={colors.surface} r={13} stroke={colors.ink} strokeWidth={0.8} />
      <SvgText fill={colors.ink} fontFamily="Bricolage Grotesque" fontSize={5} fontWeight="700" letterSpacing={0.35} textAnchor="middle" x={50} y={49}>COLOR</SvgText>
      <SvgText fill={colors.ink} fontFamily="monospace" fontSize={4.3} letterSpacing={0.8} textAnchor="middle" x={50} y={54}>LOG</SvgText>
    </Svg>
  );
}

function WheelPointer({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <Svg height={36} viewBox="0 0 36 36" width={36}>
      <Path d="M18 31 4.5 5h27L18 31Z" fill={fill} stroke={stroke} strokeLinejoin="round" strokeWidth={1.5} />
    </Svg>
  );
}

function createWheelSectorPath(index: number, total: number): string {
  const startAngle = -90 + ((360 / total) * index);
  const endAngle = -90 + ((360 / total) * (index + 1));
  const start = getWheelPoint(startAngle);
  const end = getWheelPoint(endAngle);
  return `M 50 50 L ${start.x} ${start.y} A 50 50 0 0 1 ${end.x} ${end.y} Z`;
}

function getWheelPoint(angle: number): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180;
  return { x: Number((50 + (50 * Math.cos(radians))).toFixed(3)), y: Number((50 + (50 * Math.sin(radians))).toFixed(3)) };
}

function MenuIcon({ color }: { color: string }) {
  return <Svg height={22} viewBox="0 0 24 24" width={22}><Path d="M4 8h16M4 12h11M4 16h16" fill="none" stroke={color} strokeLinecap="round" strokeWidth={1.8} /></Svg>;
}

function BellIcon({ color }: { color: string }) {
  return <Svg height={22} viewBox="0 0 24 24" width={22}><Path d="M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-8 11h4" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} /></Svg>;
}

function useMissionRevealStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  page: { backgroundColor: colors.canvas, flex: 1 },
  navBar: { alignItems: 'center', backgroundColor: colors.canvas, borderBottomColor: colors.ink, borderBottomWidth: 1.5, flexDirection: 'row', justifyContent: 'space-between', minHeight: 56, paddingBottom: 13, paddingHorizontal: 16 },
  navBrand: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  wordmark: { color: colors.ink, fontSize: 17, fontWeight: '700', letterSpacing: -0.5, lineHeight: 21 },
  content: { alignItems: 'center', flex: 1, justifyContent: 'flex-start', paddingBottom: 26, paddingHorizontal: 24, paddingTop: 84 },
  copy: { alignItems: 'center', marginBottom: 28, width: '100%' },
  title: { color: colors.ink, fontSize: 40, fontWeight: '800', letterSpacing: -1.45, lineHeight: 41, maxWidth: 320, textAlign: 'center' },
  markerLine: { backgroundColor: colors.ink, borderRadius: 4, height: 2, marginBottom: 5, marginTop: 7, transform: [{ rotate: '-1deg' }], width: 160 },
  subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  wheelFrame: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.ink, borderRadius: 4, borderWidth: 2, height: 288, justifyContent: 'center', overflow: 'hidden', position: 'relative', width: 288 },
  wheel: { borderColor: colors.ink, borderRadius: 136, borderWidth: 1.5, height: 272, overflow: 'hidden', width: 272 },
  pointer: { alignItems: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  resultCard: { alignItems: 'center', borderColor: colors.black, borderWidth: 1.5, bottom: 24, gap: 2, left: 24, paddingHorizontal: 14, paddingVertical: 9, position: 'absolute', right: 24 },
  resultEyebrow: { color: colors.black, fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.8, lineHeight: 11 },
  resultName: { color: colors.black, fontSize: 20, fontWeight: '800', letterSpacing: -0.5, lineHeight: 25 },
  spinButton: { alignItems: 'center', backgroundColor: colors.ink, boxShadow: `6px 6px 0px ${colors.black}`, justifyContent: 'center', marginTop: 34, minHeight: 72, paddingHorizontal: 32, width: '100%' },
  spinButtonPressed: { boxShadow: `0px 0px 0px ${colors.black}`, transform: [{ translateX: 6 }, { translateY: 6 }] },
  spinButtonDisabled: { opacity: 0.55 },
  spinButtonText: { color: colors.surface, fontSize: 17, fontWeight: '700', lineHeight: 22, textAlign: 'center' },
  });
}
