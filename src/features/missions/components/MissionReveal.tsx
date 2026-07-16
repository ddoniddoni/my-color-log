import { useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { Surface } from '@/src/components/ui/Surface';
import { type DailyMission } from '@/src/features/missions/model/dailyMission';
import { radius, spacing } from '@/src/design/tokens';

type MissionRevealProps = { mission: DailyMission; reduceMotion: boolean; onRevealed: () => Promise<void> };

export function MissionReveal({ mission, reduceMotion, onRevealed }: MissionRevealProps) {
  const [progress] = useState(() => new Animated.Value(0));
  const [isRevealing, setIsRevealing] = useState(false);

  const handleReveal = (): void => {
    if (isRevealing) return;
    setIsRevealing(true);
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: reduceMotion ? 180 : 1_900, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) {
        setIsRevealing(false);
        return;
      }
      void onRevealed().catch(() => setIsRevealing(false));
    });
  };

  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', reduceMotion ? '0deg' : '1080deg'] });
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });

  return (
    <Surface style={[styles.surface, { backgroundColor: mission.color.accentTint, borderColor: mission.color.accentTint }]}>
      <Animated.View style={[styles.disc, { backgroundColor: mission.color.accent, opacity, transform: [{ rotate }] }]} accessibilityLabel="오늘의 색 룰렛" />
      <View style={styles.copy}>
        <AppText variant="caption" style={{ color: mission.color.accentShade }}>오늘의 미션</AppText>
        <AppText variant="title2">오늘의 색을 열어볼까요?</AppText>
        <AppText color="secondary">룰렛은 이미 서버에서 정해진 오늘의 색을 보여줘요.</AppText>
      </View>
      <Button label={isRevealing ? '색을 찾는 중…' : '오늘의 색 열기'} onPress={handleReveal} disabled={isRevealing} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  surface: { alignItems: 'center', gap: spacing[5], paddingVertical: spacing[8] },
  disc: { width: 172, height: 172, borderRadius: radius.pill },
  copy: { alignItems: 'center', gap: spacing[2] },
});
