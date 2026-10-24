import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppModal } from '@/src/components/ui/AppModal';
import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { UserBlockForm } from '@/src/features/blocks/components/UserBlockForm';
import { useBlockedUsers, useUserBlockAction } from '@/src/features/blocks/hooks/useUserBlocks';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';

export function BlockedUsersModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { colors } = useAppTheme();
  const { format, t } = useAppLanguage();
  const query = useBlockedUsers(userId);
  const action = useUserBlockAction(userId);
  return <AppModal accessibilityLabel={t('차단 목록 닫기')} isBusy={action.isPending} onClose={action.target ? action.close : onClose} visible>
    {action.target ? <UserBlockForm action={action} /> : <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="title2" accessibilityRole="header">차단한 사용자</AppText>
      {query.isPending ? <AppText accessibilityLiveRegion="polite">차단 목록을 불러오고 있어요.</AppText>
        : query.isError ? <><AppText>차단 목록을 불러오지 못했어요.</AppText><Button label="다시 시도" onPress={() => void query.refetch()} /></>
        : query.data.length === 0 ? <AppText>차단한 사용자가 없어요.</AppText>
        : query.data.map((user) => <View key={user.id} style={styles.row}>
          <AppText localize={false} style={styles.name}>{user.nickname}</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel={format('{name} 님 차단 해제', { name: user.nickname })} onPress={() => action.open({ ...user, shouldBlock: false })} style={styles.button}>
            <AppText style={{ color: colors.danger }}>차단 해제</AppText>
          </Pressable>
        </View>)}
      <Button label="닫기" variant="secondary" onPress={onClose} />
    </ScrollView>}
  </AppModal>;
}
const styles = StyleSheet.create({ content: { gap: 16 }, row: { alignItems: 'center', flexDirection: 'row', gap: 12 }, name: { flex: 1 }, button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 } });
