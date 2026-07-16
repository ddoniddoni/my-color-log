import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/src/components/layout/Screen';
import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { Surface } from '@/src/components/ui/Surface';
import { colors, spacing } from '@/src/design/tokens';

const slides = [
  { title: '매일 하나의 색을 발견해요.', description: '오늘 스쳐 간 색을 사진으로 가볍게 남겨보세요.' },
  { title: '사진은 나만의 다이어리에 쌓여요.', description: '한 장만 남겨도 오늘의 기록이에요.' },
  { title: '친구방에서는 같은 미션으로 서로 다른 하루가 보여요.', description: '내 사진은 언제나 내 다이어리에 그대로 남아요.' },
] as const;

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();
  const slide = slides[currentIndex];
  const isLastSlide = currentIndex === slides.length - 1;

  const handleNext = (): void => {
    if (isLastSlide) router.replace('/(onboarding)/email');
    else setCurrentIndex((index) => index + 1);
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.progress} accessibilityLabel={`${currentIndex + 1} / ${slides.length} 단계`}>
        {slides.map((slide, index) => <View key={slide.title} style={[styles.progressDot, index === currentIndex && styles.progressDotActive]} />)}
      </View>
      <Surface style={styles.artwork}><View style={styles.colorDisc} /><View style={styles.colorDiscSmall} /></Surface>
      <View style={styles.copy}><AppText variant="title1">{slide.title}</AppText><AppText color="secondary">{slide.description}</AppText></View>
      <Button label={isLastSlide ? '이메일로 시작하기' : '다음'} onPress={handleNext} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'space-between' },
  progress: { flexDirection: 'row', gap: spacing[2] },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderStrong },
  progressDotActive: { width: 24, backgroundColor: colors.textPrimary },
  artwork: { minHeight: 260, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  colorDisc: { width: 172, height: 172, borderRadius: 86, backgroundColor: '#D9B7B7' },
  colorDiscSmall: { position: 'absolute', right: 36, bottom: 38, width: 62, height: 62, borderRadius: 31, backgroundColor: '#F0D9B8' },
  copy: { gap: spacing[3] },
});
