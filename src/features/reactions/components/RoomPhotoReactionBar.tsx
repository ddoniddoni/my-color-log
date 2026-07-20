import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { colors } from '@/src/design/tokens';
import { useRoomPhotoReactions } from '@/src/features/reactions/hooks/useRoomPhotoReactions';
import { ROOM_PHOTO_REACTION_CHOICES } from '@/src/features/reactions/model/roomPhotoReaction';

type RoomPhotoReactionBarProps = {
  isOwnPhoto: boolean;
  photoId: string;
  roomId: string;
  userId: string;
};

export function RoomPhotoReactionBar({ isOwnPhoto, photoId, roomId, userId }: RoomPhotoReactionBarProps) {
  const reactions = useRoomPhotoReactions({ photoId, roomId, userId });
  const summaries = reactions.data ?? [];

  if (reactions.isError) return <AppText style={styles.error}>반응을 불러오지 못했어요.</AppText>;

  return (
    <View style={styles.wrap}>
      <AppText style={styles.label}>{isOwnPhoto ? 'MEMBER REACTIONS' : 'LEAVE A REACTION'}</AppText>
      <View accessibilityLabel="사진 반응" style={styles.row}>
        {ROOM_PHOTO_REACTION_CHOICES.map((choice) => {
          const summary = summaries.find((item) => item.emoji === choice.emoji);
          const selected = summary?.reactedByMe === true;
          const disabled = isOwnPhoto || reactions.isPending || reactions.isSaving;
          return (
            <Pressable
              accessibilityHint={isOwnPhoto ? '내 사진에는 반응을 남길 수 없어요.' : undefined}
              accessibilityLabel={`${choice.label}${summary && summary.count > 0 ? ` ${summary.count}개` : ''}`}
              accessibilityRole="button"
              accessibilityState={{ disabled, selected }}
              disabled={disabled}
              key={choice.emoji}
              onPress={() => { void reactions.toggle(choice.emoji); }}
              style={({ pressed }) => [styles.button, selected && styles.buttonSelected, pressed && !disabled && styles.buttonPressed, disabled && !isOwnPhoto && styles.buttonLoading]}>
              <AppText style={[styles.symbol, selected && styles.symbolSelected]}>{choice.symbol}</AppText>
              {summary && summary.count > 0 ? <AppText style={[styles.count, selected && styles.countSelected]}>{summary.count}</AppText> : null}
            </Pressable>
          );
        })}
      </View>
      {!isOwnPhoto ? <AppText style={styles.hint}>한 사진에 한 가지 반응을 남길 수 있어요.</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopColor: 'rgba(0, 0, 0, 0.18)', borderTopWidth: 1, gap: 8, marginTop: 2, paddingTop: 11 },
  label: { color: 'rgba(0, 0, 0, 0.58)', fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.8 },
  row: { flexDirection: 'row', gap: 7 },
  button: { alignItems: 'center', borderColor: 'rgba(0, 0, 0, 0.46)', borderWidth: 1, flex: 1, flexDirection: 'row', gap: 3, justifyContent: 'center', minHeight: 42, paddingHorizontal: 3 },
  buttonSelected: { backgroundColor: colors.black, borderColor: colors.black },
  buttonPressed: { opacity: 0.62 },
  buttonLoading: { opacity: 0.48 },
  symbol: { color: colors.black, fontSize: 17, fontWeight: '700', lineHeight: 20 },
  symbolSelected: { color: colors.white },
  count: { color: colors.black, fontFamily: 'monospace', fontSize: 11, fontWeight: '700' },
  countSelected: { color: colors.white },
  hint: { color: 'rgba(0, 0, 0, 0.55)', fontSize: 11, lineHeight: 15 },
  error: { color: colors.danger, fontSize: 11, lineHeight: 16 },
});
