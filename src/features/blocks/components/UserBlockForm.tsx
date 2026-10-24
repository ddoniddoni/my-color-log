import { ScrollView, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/src/design/ThemeProvider';
import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { type UserBlockController } from '@/src/features/blocks/hooks/useUserBlocks';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';

// Content only: renders inside the existing native modal, including on iOS.
export function UserBlockForm({ action }: { action: UserBlockController }) {
  const { colors } = useAppTheme();
  const { format } = useAppLanguage();
  if (!action.target) return null;
  const { nickname, shouldBlock } = action.target;
  return <ScrollView contentContainerStyle={styles.content}>
    <AppText accessibilityRole="header" variant="title2" localize={false}>{format(shouldBlock ? '{name} 님을 차단할까요?' : '{name} 님의 차단을 해제할까요?', { name: nickname })}</AppText>
    <AppText>{shouldBlock
      ? '함께 있는 모든 방에서 서로의 사진·반응·새 사진 알림이 보이지 않아요. 방 멤버십과 개인 다이어리는 유지돼요.'
      : '함께 있는 방에서 사진·반응·새 사진 알림을 다시 볼 수 있어요. 상대도 나를 차단했다면 상대가 해제할 때까지 보이지 않아요.'}</AppText>
    <AppText color="secondary" variant="caption">차단 여부를 상대에게 알림으로 보내지 않아요.</AppText>
    {action.error ? <AppText accessibilityLiveRegion="polite" style={{ color: colors.danger }}>{action.error}</AppText> : null}
    <View style={styles.actions}>
      <Button label={action.isPending ? '저장 중…' : shouldBlock ? '차단하기' : '차단 해제'} disabled={action.isPending} onPress={() => void action.submit()} />
      <Button label="취소" variant="secondary" disabled={action.isPending} onPress={action.close} />
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({ content: { gap: 16, padding: 20 }, actions: { gap: 10 } });
