import { StyleSheet, View } from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { Surface } from '@/src/components/ui/Surface';
import { spacing } from '@/src/design/tokens';

export default function TodayScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="caption">오늘</AppText>
        <AppText variant="title1">나의 컬러 기록</AppText>
      </View>
      <Surface style={styles.hero}>
        <View style={styles.colorDisc} />
        <View style={styles.heroContent}>
          <AppText variant="caption" color="secondary">오늘의 색</AppText>
          <AppText variant="title2">미션을 준비하고 있어요</AppText>
          <AppText color="secondary">서버에서 오늘의 컬러를 불러오면 여기에서 만나요.</AppText>
        </View>
      </Surface>
      <View style={styles.emptyState}>
        <AppText variant="title3">한 장만 남겨도 오늘의 기록이에요.</AppText>
        <AppText color="secondary">카메라와 로컬 저장 기능은 다음 단계에서 연결돼요.</AppText>
      </View>
      <Button label="첫 번째 색 발견하기" disabled accessibilityHint="카메라 기능 준비 중" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[1] },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  colorDisc: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E9D1D1' },
  heroContent: { flex: 1, gap: spacing[1] },
  emptyState: { gap: spacing[2], paddingVertical: spacing[4] },
});
