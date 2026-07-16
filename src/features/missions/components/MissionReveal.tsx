import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { useFonts } from 'expo-font';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { type DailyMission } from '@/src/features/missions/model/dailyMission';

type MissionRevealProps = { mission: DailyMission; reduceMotion: boolean; onRevealed: () => Promise<void> };

const WHEEL_LABELS = [
  { label: 'Joy', rotation: 22 },
  { label: 'Calm', rotation: 67 },
  { label: 'Power', rotation: 112 },
  { label: 'Wisdom', rotation: 157 },
  { label: 'Hope', rotation: 202 },
  { label: 'Love', rotation: 247 },
  { label: 'Truth', rotation: 292 },
  { label: 'Energy', rotation: 337 },
] as const;

export function MissionReveal({ mission, reduceMotion, onRevealed }: MissionRevealProps) {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const [isRevealing, setIsRevealing] = useState(false);
  const insets = useSafeAreaInsets();
  const rotation = useSharedValue(0);
  const wheelStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const displayFont = fontsLoaded ? 'BricolageGrotesque_800ExtraBold' : undefined;
  const titleFont = fontsLoaded ? 'BricolageGrotesque_700Bold' : undefined;

  const finishReveal = useCallback(() => {
    void onRevealed().catch(() => setIsRevealing(false));
  }, [onRevealed]);

  const handleReveal = (): void => {
    if (isRevealing) return;
    setIsRevealing(true);
    rotation.value = 0;
    rotation.value = withTiming(
      reduceMotion ? 0 : 1_440,
      { duration: reduceMotion ? 180 : 2_200, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishReveal)();
        else runOnJS(setIsRevealing)(false);
      },
    );
  };

  return (
    <View style={styles.page}>
      <WavyPaper />
      <View style={[styles.navBar, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.navBrand}><MenuIcon /><AppText style={[styles.wordmark, { fontFamily: titleFont }]}>Color Log</AppText></View>
        <BellIcon />
      </View>

      <View style={styles.content}>
        <View style={styles.copy}>
          <AppText style={[styles.title, { fontFamily: displayFont }]}>오늘의 컬러 룰렛</AppText>
          <View style={styles.markerLine} />
          <AppText style={[styles.subtitle, { fontFamily: fontsLoaded ? 'BricolageGrotesque_400Regular' : undefined }]}>Discover your energy today.</AppText>
        </View>

        <View accessibilityLabel={`오늘의 ${mission.color.nameKo} 룰렛`} style={styles.wheelFrame}>
          <Animated.View style={[styles.wheel, wheelStyle]}>
            <WheelArtwork />
          </Animated.View>
          <View pointerEvents="none" style={styles.pointer}>
            <View style={styles.pointerStem} />
            <View style={styles.pointerTriangle} />
            <View style={styles.pointerDisc}><BrushIcon /></View>
          </View>
        </View>

        <Pressable
          accessibilityLabel="오늘의 색 룰렛 돌리기"
          accessibilityRole="button"
          accessibilityState={{ busy: isRevealing, disabled: isRevealing }}
          disabled={isRevealing}
          onPress={handleReveal}
          style={({ pressed }) => [styles.spinButton, isRevealing && styles.spinButtonDisabled, pressed && !isRevealing && styles.spinButtonPressed]}
        >
          <AppText style={[styles.spinButtonText, { fontFamily: titleFont }]}>{isRevealing ? 'Spinning…' : 'Spin to find today\'s light!'}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

function WavyPaper() {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern height={40} id="roulette-waves" patternUnits="userSpaceOnUse" width={40}>
          <Path d="M0 20c5 0 5-5 10-5s5 5 10 5 5-5 10-5 5 5 10 5" fill="none" stroke="#E2E2E2" strokeWidth={1} />
        </Pattern>
      </Defs>
      <Rect fill="url(#roulette-waves)" height="100%" width="100%" />
    </Svg>
  );
}

function WheelArtwork() {
  return (
    <Svg height="100%" viewBox="0 0 100 100" width="100%">
      <Circle cx={50} cy={50} fill="#FFFFFF" r={49.2} />
      <G fill="none" stroke="#000000" strokeWidth={0.5}>
        <Path d="M50 50 100 50A50 50 0 0 1 85.35 85.35Z" />
        <Path d="M50 50 85.35 85.35A50 50 0 0 1 50 100Z" />
        <Path d="M50 50 50 100A50 50 0 0 1 14.65 85.35Z" />
        <Path d="M50 50 14.65 85.35A50 50 0 0 1 0 50Z" />
        <Path d="M50 50 0 50A50 50 0 0 1 14.65 14.65Z" />
        <Path d="M50 50 14.65 14.65A50 50 0 0 1 50 0Z" />
        <Path d="M50 50 50 0A50 50 0 0 1 85.35 14.65Z" />
        <Path d="M50 50 85.35 14.65A50 50 0 0 1 100 50Z" />
      </G>
      {WHEEL_LABELS.map(({ label, rotation: labelRotation }) => (
        <SvgText fill="#000000" fontFamily="Bricolage Grotesque" fontSize={5} key={label} transform={`rotate(${labelRotation} 50 50)`} x={75} y={40}>{label}</SvgText>
      ))}
    </Svg>
  );
}

function MenuIcon() {
  return <Svg height={22} viewBox="0 0 24 24" width={22}><Path d="M4 8h16M4 12h11M4 16h16" fill="none" stroke="#000000" strokeLinecap="round" strokeWidth={1.8} /></Svg>;
}

function BellIcon() {
  return <Svg height={22} viewBox="0 0 24 24" width={22}><Path d="M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-8 11h4" fill="none" stroke="#000000" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} /></Svg>;
}

function BrushIcon() {
  return <Svg height={25} viewBox="0 0 24 24" width={25}><Path d="m5 19 2.2-.6L18.5 7.1 16.9 5.5 5.6 16.8 5 19Zm12.7-13.5 1.1-1.1a1.1 1.1 0 0 1 1.6 1.6l-1.1 1.1-1.6-1.6Z" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} /></Svg>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#F9F9F9', flex: 1 },
  navBar: { alignItems: 'center', backgroundColor: '#F9F9F9', borderBottomColor: '#000000', borderBottomWidth: 1.5, flexDirection: 'row', justifyContent: 'space-between', minHeight: 56, paddingBottom: 13, paddingHorizontal: 16 },
  navBrand: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  wordmark: { color: '#000000', fontSize: 17, fontWeight: '700', letterSpacing: -0.5, lineHeight: 21 },
  content: { alignItems: 'center', flex: 1, justifyContent: 'flex-start', paddingBottom: 26, paddingHorizontal: 24, paddingTop: 84 },
  copy: { alignItems: 'center', marginBottom: 28, width: '100%' },
  title: { color: '#000000', fontSize: 40, fontWeight: '800', letterSpacing: -1.45, lineHeight: 41, maxWidth: 320, textAlign: 'center' },
  markerLine: { backgroundColor: '#000000', borderRadius: 4, height: 2, marginBottom: 5, marginTop: 7, transform: [{ rotate: '-1deg' }], width: 160 },
  subtitle: { color: '#5D5F5F', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  wheelFrame: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#000000', borderRadius: 4, borderWidth: 2, height: 288, justifyContent: 'center', position: 'relative', width: 288 },
  wheel: { backgroundColor: '#FFFFFF', borderColor: '#000000', borderRadius: 136, borderWidth: 1.5, height: 272, overflow: 'hidden', width: 272 },
  pointer: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  pointerStem: { backgroundColor: '#000000', height: 100, position: 'absolute', top: 17, width: 3 },
  pointerTriangle: { backgroundColor: '#000000', height: 20, position: 'absolute', top: 105, transform: [{ rotate: '45deg' }], width: 20 },
  pointerDisc: { alignItems: 'center', backgroundColor: '#000000', borderRadius: 19, height: 38, justifyContent: 'center', position: 'absolute', top: 124, width: 38 },
  spinButton: { alignItems: 'center', backgroundColor: '#000000', boxShadow: '6px 6px 0px #000000', justifyContent: 'center', marginTop: 34, minHeight: 72, paddingHorizontal: 32, width: '100%' },
  spinButtonPressed: { boxShadow: '0px 0px 0px #000000', transform: [{ translateX: 6 }, { translateY: 6 }] },
  spinButtonDisabled: { opacity: 0.55 },
  spinButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', lineHeight: 22, textAlign: 'center' },
});
