import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque';
import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';

const SURFACE = '#F9F9F9';
const INK = '#000000';
const SECONDARY = '#5D5F5F';
const ONBOARDING_IMAGE = require('../../assets/images/onboarding-color-discovery.png');

const slides = [
  {
    title: '매일 새로운 색을\n발견해요',
    description: '일상 속 스쳐 지나가는 순간들을\n당신만의 특별한 팔레트로 기록해보세요.',
  },
  {
    title: '사진은 나만의\n다이어리에 쌓여요',
    description: '한 장만 남겨도 오늘의 기록이에요.\n시간이 지날수록 나만의 색이 모여요.',
  },
  {
    title: '같은 색으로\n서로 다른 하루를 봐요',
    description: '친구방에서는 같은 미션을 함께해요.\n내 사진은 언제나 내 다이어리에 남아요.',
  },
] as const;

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
  });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const slide = slides[currentIndex];
  const isLastSlide = currentIndex === slides.length - 1;
  const regularFont = fontsLoaded ? 'BricolageGrotesque_600SemiBold' : undefined;
  const strongFont = fontsLoaded ? 'BricolageGrotesque_700Bold' : undefined;

  const handleNext = (): void => {
    if (isLastSlide) {
      router.replace('/(onboarding)/email');
      return;
    }

    setCurrentIndex((index) => index + 1);
  };

  return (
    <View style={styles.page}>
      <PaperDotPattern />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) }]}>
        <AppText style={[styles.wordmark, { fontFamily: strongFont }]}>Color Log</AppText>
        <Pressable
          accessibilityLabel="온보딩 건너뛰기"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.replace('/(onboarding)/email')}
          style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
        >
          <AppText style={styles.closeMark}>×</AppText>
        </Pressable>
      </View>

      <View style={styles.main}>
        <View style={styles.illustration} accessibilityLabel="오늘의 색을 발견하는 장면">
          <View style={styles.illustrationFrame}>
            <Image resizeMode="contain" source={ONBOARDING_IMAGE} style={styles.illustrationImage} />
          </View>
          <View pointerEvents="none" style={styles.sparkle}><Sparkle /></View>
          <View pointerEvents="none" style={styles.wave}><Wave /></View>
        </View>

        <View style={styles.copy}>
          <AppText style={[styles.title, { fontFamily: strongFont }]}>{slide.title}</AppText>
          <AppText style={[styles.description, { fontFamily: regularFont }]}>{slide.description}</AppText>
        </View>

        <View accessibilityLabel={`${currentIndex + 1} / ${slides.length} 단계`} style={styles.progress}>
          {slides.map((item, index) => (
            <View key={item.title} style={[styles.progressDot, index === currentIndex ? styles.progressDotActive : styles.progressDotInactive]} />
          ))}
        </View>
      </View>

      <View style={[styles.bottomAction, { paddingBottom: Math.max(insets.bottom, 48) }]}>
        <Pressable
          accessibilityLabel={isLastSlide ? '이메일로 시작하기' : '다음 온보딩 화면'}
          accessibilityRole="button"
          onPress={handleNext}
          style={({ pressed }) => [styles.nextButton, pressed && styles.nextButtonPressed]}
        >
          <AppText style={[styles.nextButtonText, { fontFamily: regularFont }]}>{isLastSlide ? '이메일로 시작하기' : 'NEXT'}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

function PaperDotPattern() {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern height={20} id="onboarding-paper-dots" patternUnits="userSpaceOnUse" width={20}>
          <Circle cx={0.5} cy={0.5} fill="#D1D1D1" r={0.5} />
        </Pattern>
      </Defs>
      <Rect fill="url(#onboarding-paper-dots)" height="100%" width="100%" />
    </Svg>
  );
}

function Sparkle() {
  return (
    <Svg height={36} viewBox="0 0 36 36" width={36}>
      <Path d="m18 0 4.4 13.6L36 18l-13.6 4.4L18 36l-4.4-13.6L0 18l13.6-4.4L18 0Z" fill={INK} />
    </Svg>
  );
}

function Wave() {
  return (
    <Svg height={20} viewBox="0 0 60 20" width={60}>
      <Path d="M1 11C8 2 15 2 22 11s14 9 21 0 14-9 16 0" fill="none" stroke={INK} strokeLinecap="round" strokeWidth={2} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: SURFACE, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 24, paddingHorizontal: 16 },
  wordmark: { color: INK, fontSize: 24, fontStyle: 'italic', fontWeight: '700', letterSpacing: -0.72, lineHeight: 29, transform: [{ rotate: '-1.5deg' }] },
  closeButton: { alignItems: 'center', backgroundColor: SURFACE, borderColor: INK, borderRadius: 20, borderWidth: 2, height: 40, justifyContent: 'center', width: 40 },
  closeButtonPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  closeMark: { color: INK, fontSize: 27, fontWeight: '400', lineHeight: 30, marginTop: -2 },
  main: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingBottom: 80, paddingHorizontal: 16 },
  illustration: { height: 320, marginBottom: 48, maxWidth: 320, position: 'relative', width: '100%' },
  illustrationFrame: { alignItems: 'center', borderColor: INK, borderWidth: 3, flex: 1, justifyContent: 'center', padding: 16, transform: [{ rotate: '1.2deg' }] },
  illustrationImage: { height: '100%', width: '100%' },
  sparkle: { position: 'absolute', right: -8, top: -16, transform: [{ rotate: '12deg' }] },
  wave: { bottom: 16, left: -24, opacity: 0.4, position: 'absolute', transform: [{ rotate: '-12deg' }] },
  copy: { alignItems: 'center', gap: 16, marginBottom: 48 },
  title: { color: INK, fontSize: 24, fontWeight: '700', letterSpacing: -0.48, lineHeight: 29, textAlign: 'center', transform: [{ rotate: '-1.5deg' }] },
  description: { color: SECONDARY, fontSize: 16, fontWeight: '600', lineHeight: 24, paddingHorizontal: 16, textAlign: 'center' },
  progress: { flexDirection: 'row', gap: 12 },
  progressDot: { borderColor: INK, borderRadius: 6, borderWidth: 2, height: 12, width: 12 },
  progressDotActive: { backgroundColor: INK },
  progressDotInactive: { backgroundColor: SURFACE },
  bottomAction: { bottom: 0, left: 0, paddingHorizontal: 16, position: 'absolute', right: 0 },
  nextButton: { alignItems: 'center', alignSelf: 'center', backgroundColor: INK, boxShadow: '4px 4px 0px #000000', justifyContent: 'center', maxWidth: 320, minHeight: 49, width: '100%' },
  nextButtonPressed: { boxShadow: 'none', transform: [{ translateX: 4 }, { translateY: 4 }] },
  nextButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', letterSpacing: 1.4, lineHeight: 17, textTransform: 'uppercase' },
});
