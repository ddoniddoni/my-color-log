import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/src/components/feedback/EmptyState';
import { Screen } from '@/src/components/layout/Screen';
import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { spacing } from '@/src/design/tokens';

export default function RoomScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="caption">같은 미션, 서로 다른 하루</AppText>
        <AppText variant="title1">친구방</AppText>
      </View>
      <EmptyState
        title="아직 함께하는 방이 없어요"
        description="초대한 사람끼리만 보는 비공개 방에서, 같은 오늘의 색을 모아보세요."
      />
      <View style={styles.actions}>
        <Button label="친구방 만들기" disabled />
        <Button label="초대 코드 입력" variant="secondary" disabled />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing[1] },
  actions: { gap: spacing[2] },
});
