import { useCallback, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { spacing } from '@/src/design/tokens';
import { useUserPhotoQueue } from '@/src/features/sync/hooks/useUserPhotoQueue';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';

export function PhotoDraftRecovery({ userId }: { userId: string | null }) {
  const queue = useUserPhotoQueue(userId);
  const draft = queue.data?.find((photo) => photo.status === 'local_saved');
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();
  const theme = useAppTheme();
  const { format } = useAppLanguage();
  const { refetch } = queue;
  useFocusEffect(useCallback(() => {
    setDismissed(false);
    void refetch();
  }, [refetch, setDismissed]));
  if (!draft) return null;
  return (
    <Modal animationType="fade" transparent visible={!dismissed} onRequestClose={() => setDismissed(true)}>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.canvas }]}>
        <View accessibilityViewIsModal style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <AppText variant="title2">확인을 마치지 않은 사진이 있어요</AppText>
          <AppText color="secondary">{format('{date} 사진을 이 기기에 안전하게 보관하고 있어요. 확인 후 기록에 추가해 주세요.', { date: draft.dateKey })}</AppText>
          <Button label="사진 이어서 확인" onPress={() => {
            setDismissed(true);
            router.push({ pathname: '/photo-review', params: {
              photoId: draft.id,
              ...(draft.reviewColor ? { colorHex: draft.reviewColor.hex, colorNameEn: draft.reviewColor.nameEn } : {}),
            } });
          }} />
          <Button label="나중에 확인" variant="secondary" onPress={() => setDismissed(true)} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing[5] },
  card: { gap: spacing[4], padding: spacing[5] },
});
