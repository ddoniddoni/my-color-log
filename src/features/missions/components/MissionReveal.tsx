import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { useFonts } from 'expo-font';
import { useRef } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { AppHeader } from '@/src/components/layout/AppHeader';
import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { radius, spacing, type ThemeColors } from '@/src/design/tokens';
import { useColorRevealAnimation } from '@/src/features/missions/hooks/useColorRevealAnimation';
import type { DailyMission, MissionRevealColor } from '@/src/features/missions/model/dailyMission';
import { MISSION_REVEAL_SLOT_COUNT } from '@/src/features/missions/model/missionRevealWheel';
import { formatDateKey } from '@/src/lib/localization/dateFormat';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';

type MissionRevealProps = {
  mission: DailyMission;
  palette: readonly MissionRevealColor[];
  reduceMotion: boolean;
  isNewDay: boolean;
  onStart: () => void;
  onRevealed: () => Promise<void>;
  onContinue: () => void;
};

export function MissionReveal({ mission, palette, reduceMotion, isNewDay, onStart, onRevealed, onContinue }: MissionRevealProps) {
  const { colors } = useAppTheme();
  const { language, t, format } = useAppLanguage();
  const [fontsLoaded] = useFonts({ BricolageGrotesque_700Bold });
  const { width, height, fontScale } = useWindowDimensions();
  const contentRef = useRef<ScrollView>(null);
  const compact = height < 700;
  const targetIndex = palette.findIndex((color) => color.id === mission.color.id);
  const reveal = useColorRevealAnimation({ targetIndex, reduceMotion, onStart, onRevealed });
  const size = Math.max(160, Math.min(width - spacing[6] * 2, compact ? 184 : fontScale > 1.3 ? 232 : 272));
  const colorName = language === 'ko' ? mission.color.nameKo : mission.color.nameEn;
  const validPalette = targetIndex >= 0 && palette.length === MISSION_REVEAL_SLOT_COUNT;

  return (
    <View style={[styles.page, { backgroundColor: colors.canvas }]}>
      <AppHeader title="오늘" />

      <ScrollView ref={contentRef} contentContainerStyle={[styles.content, compact && styles.contentCompact]} showsVerticalScrollIndicator={false}
        onContentSizeChange={() => { if (reveal.hasResult) contentRef.current?.scrollToEnd({ animated: !reduceMotion }); }}>
        <View style={[styles.heading, compact && styles.headingCompact]}>
          <AppText localize={false} color="secondary" variant="caption" style={styles.date}>{formatDateKey(mission.challengeDate, language, 'shortWithWeekday')}</AppText>
          <AppText color="secondary" variant="caption" style={styles.eyebrow}>{isNewDay ? '새로운 하루가 시작됐어요' : '하루에 하나, 나만의 발견'}</AppText>
          <AppText accessibilityRole="header" variant="display" style={[styles.title, compact && styles.titleCompact]}>{'하루의 시작,\n하나의 색.'}</AppText>
        </View>

        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={reveal.hasResult ? format('오늘의 색은 {colorName}', { colorName }) : t('오늘의 색을 여는 컬러 디스크')}
          style={[styles.discStage, { height: size, width: size }]}>
          <ColorDisc colors={colors} mission={mission} palette={palette} progress={reveal.progress} rotation={reveal.rotation} reduceMotion={reduceMotion} />
          <DiscClock progress={reveal.progress} fontFamily={fontsLoaded ? 'BricolageGrotesque_700Bold' : undefined} />
        </View>

        <RevealDescription mission={mission} reveal={reveal} reduceMotion={reduceMotion} />
      </ScrollView>

      <RevealFooter reveal={reveal} validPalette={validPalette} onContinue={onContinue} />
    </View>
  );
}

function RevealDescription({ mission, reveal, reduceMotion }: {
  mission: DailyMission;
  reveal: Pick<ReturnType<typeof useColorRevealAnimation>, 'phase' | 'hasResult' | 'progress'>;
  reduceMotion: boolean;
}) {
  const { language } = useAppLanguage();
  const { progress } = reveal;
  const style = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: reduceMotion ? 0 : 10 * (1 - progress.value) }] }));
  return (
    <View style={styles.description}>
      {reveal.hasResult ? (
        <Animated.View accessibilityLiveRegion="polite" style={[styles.result, style]}>
          <AppText localize={false} variant="title1" style={styles.colorName}>{language === 'ko' ? mission.color.nameKo : mission.color.nameEn}</AppText>
          {language === 'ko' ? <AppText localize={false} color="secondary" variant="caption" style={styles.englishName}>{mission.color.nameEn}</AppText> : null}
          <AppText localize={false} color="secondary" style={styles.prompt}>{language === 'ko' ? mission.promptKo : `Find a scene touched by ${mission.color.nameEn}.`}</AppText>
        </Animated.View>
      ) : (
        <View style={styles.result}>
          <AppText style={styles.prompt}>{reveal.phase === 'turning' ? '오늘의 장면을 물들일 색이 열려요.' : '오늘은 어떤 색을 만나게 될까요?'}</AppText>
          <AppText color="secondary" variant="caption" style={styles.prompt}>매일 자정, 새로운 색이 열려요.</AppText>
        </View>
      )}
    </View>
  );
}

function RevealFooter({ reveal, validPalette, onContinue }: {
  reveal: Pick<ReturnType<typeof useColorRevealAnimation>, 'phase' | 'hasResult' | 'begin' | 'retry'>;
  validPalette: boolean;
  onContinue: () => void;
}) {
  const { colors } = useAppTheme();
  const busy = reveal.phase === 'turning' || reveal.phase === 'saving';
  const label = reveal.phase === 'error' ? '다시 저장하기'
    : reveal.hasResult ? '이 색으로 기록하기'
      : reveal.phase === 'turning' ? '오늘의 색이 열리고 있어요' : '오늘의 색 열기';
  return (
    <View style={[styles.footer, { borderTopColor: colors.border }]}>
      {reveal.phase === 'error' ? <AppText accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>공개 상태를 저장하지 못했어요. 같은 색으로 다시 저장해 주세요.</AppText> : null}
      {!validPalette ? <AppText accessibilityRole="alert" color="secondary" style={styles.error}>색 정보를 다시 불러와 주세요.</AppText> : null}
      <Button accessibilityState={{ busy }} disabled={busy || !validPalette} label={label}
        onPress={reveal.phase === 'ready' ? onContinue : reveal.phase === 'error' ? () => void reveal.retry() : reveal.begin}
        style={styles.action} />
    </View>
  );
}

function ColorDisc({ colors, mission, palette, progress, rotation, reduceMotion }: {
  colors: ThemeColors; mission: DailyMission; palette: readonly MissionRevealColor[];
  progress: SharedValue<number>; rotation: SharedValue<number>; reduceMotion: boolean;
}) {
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.8 - progress.value * 0.65, transform: [{ rotate: `${rotation.value}deg` }] }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scale: reduceMotion ? 1 : 0.9 + progress.value * 0.1 }] }));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden aria-hidden>
      <Svg height="100%" width="100%" viewBox="0 0 300 300">
        <Circle cx={150} cy={150} r={148} stroke={colors.border} strokeWidth={0.8} fill="none" />
        <Circle cx={150} cy={150} r={112} fill={colors.surface} stroke={colors.border} strokeWidth={0.8} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
        <Svg height="100%" width="100%" viewBox="0 0 300 300">
          {palette.map((color, index) => <Path key={color.id} d={ringArc(index, palette.length)} fill="none" stroke={color.accent} strokeLinecap="round" strokeWidth={7} />)}
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, fillStyle]}>
        <Svg height="100%" width="100%" viewBox="0 0 300 300">
          <Defs>
            <RadialGradient id="color-light" cx="30%" cy="22%" rx="85%" ry="85%">
              <Stop offset="0" stopColor={colors.white} stopOpacity={0.24} />
              <Stop offset="1" stopColor={colors.white} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={150} cy={150} r={112} fill={mission.color.accent} />
          <Circle cx={150} cy={150} r={112} fill="url(#color-light)" />
          <Circle cx={150} cy={150} r={112} fill="none" stroke={colors.borderStrong} strokeWidth={1} />
          <Circle cx={150} cy={150} r={104} fill="none" stroke={mission.color.onAccent} strokeWidth={0.6} strokeOpacity={0.25} />
        </Svg>
      </Animated.View>
      <View style={[styles.indexMark, { backgroundColor: colors.ink }]} />
    </View>
  );
}

function DiscClock({ progress, fontFamily }: { progress: SharedValue<number>; fontFamily: string | undefined }) {
  const style = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  return (
    <Animated.View pointerEvents="none" style={[styles.discClock, style]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden aria-hidden>
      <AppText localize={false} maxFontSizeMultiplier={1.3} style={[styles.midnight, { fontFamily }]}>00:00</AppText>
      <AppText color="secondary" variant="caption">새로운 색의 시작</AppText>
    </Animated.View>
  );
}

function ringArc(index: number, count: number): string {
  const point = (degrees: number) => `${150 + 130 * Math.cos(degrees * Math.PI / 180)} ${150 + 130 * Math.sin(degrees * Math.PI / 180)}`;
  const start = -90 + index * 360 / count + 3;
  const end = -90 + (index + 1) * 360 / count - 3;
  return `M ${point(start)} A 130 130 0 0 1 ${point(end)}`;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  date: { fontVariant: ['tabular-nums'] },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6], paddingTop: spacing[5], paddingBottom: spacing[6] },
  contentCompact: { paddingTop: spacing[3], paddingBottom: spacing[4] },
  heading: { alignItems: 'center', gap: spacing[3], marginBottom: spacing[8] },
  headingCompact: { gap: spacing[2], marginBottom: spacing[5] },
  eyebrow: { textAlign: 'center', letterSpacing: 0.3 },
  title: { textAlign: 'center', letterSpacing: -1.2 },
  titleCompact: { fontSize: 28, lineHeight: 36 },
  discStage: { alignItems: 'center', justifyContent: 'center' },
  discClock: { alignItems: 'center', gap: spacing[1], maxWidth: '70%' },
  midnight: { fontSize: 46, lineHeight: 56, fontWeight: '700', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  indexMark: { position: 'absolute', top: 2, left: '50%', width: 2, height: 10, borderRadius: radius.pill, marginLeft: -1 },
  description: { width: '100%', maxWidth: 360, paddingTop: spacing[6] },
  result: { alignItems: 'center', gap: spacing[2] },
  colorName: { textAlign: 'center', letterSpacing: -0.8 },
  englishName: { letterSpacing: 1 },
  prompt: { textAlign: 'center' },
  footer: { paddingHorizontal: spacing[6], paddingTop: spacing[4], paddingBottom: spacing[5], borderTopWidth: StyleSheet.hairlineWidth },
  action: { minHeight: 58, borderRadius: radius.pill, paddingVertical: spacing[3] },
  error: { textAlign: 'center', marginBottom: spacing[3] },
});
