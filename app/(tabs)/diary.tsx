import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/src/components/feedback/EmptyState';
import { Screen } from '@/src/components/layout/Screen';
import { AppText } from '@/src/components/ui/AppText';
import { Surface } from '@/src/components/ui/Surface';
import { spacing } from '@/src/design/tokens';

export default function DiaryScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="caption">나만의 색 기록</AppText>
        <AppText variant="title1">다이어리</AppText>
      </View>
      <Surface>
        <AppText variant="title3">이번 달</AppText>
        <AppText color="secondary">이번 달의 기록을 준비하고 있어요.</AppText>
      </Surface>
      <EmptyState title="아직 기록이 없어요" description="오늘의 색을 한 장 발견하면 이곳에 차곡차곡 쌓여요." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[1] },
});
