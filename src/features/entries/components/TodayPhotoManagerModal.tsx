import { Image } from 'expo-image';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { colors, spacing } from '@/src/design/tokens';
import { type PhotoMoveDirection } from '@/src/features/entries/model/photoManagement';
import { type TodayPhoto } from '@/src/features/entries/model/todayPhotos';

type TodayPhotoManagerModalProps = {
  moveAvailability: Record<PhotoMoveDirection, boolean>;
  operation: 'idle' | 'deleting' | 'moving';
  onClose: () => void;
  onDelete: (photo: TodayPhoto) => Promise<{ storageCleanupPending: boolean }>;
  onMove: (photo: TodayPhoto, direction: PhotoMoveDirection) => Promise<void>;
  selectedPhoto: TodayPhoto | null;
  visible: boolean;
};

export function TodayPhotoManagerModal({
  moveAvailability,
  operation,
  onClose,
  onDelete,
  onMove,
  selectedPhoto,
  visible,
}: TodayPhotoManagerModalProps) {
  const isBusy = operation !== 'idle';

  const move = async (direction: PhotoMoveDirection): Promise<void> => {
    if (!selectedPhoto || isBusy) return;
    try {
      await onMove(selectedPhoto, direction);
    } catch {
      Alert.alert('순서를 바꾸지 못했어요', '연결을 확인한 뒤 다시 시도해 주세요.');
    }
  };

  const deletePhoto = (): void => {
    if (!selectedPhoto || isBusy) return;
    Alert.alert(
      '이 사진을 지울까요?',
      '오늘 기록과 친구방 보드에서 바로 사라져요. 이 작업은 되돌릴 수 없어요.',
      [
        { style: 'cancel', text: '취소' },
        {
          style: 'destructive',
          text: '사진 지우기',
          onPress: () => {
            void onDelete(selectedPhoto)
              .then(({ storageCleanupPending }) => {
                onClose();
                if (storageCleanupPending) Alert.alert('사진을 삭제했어요', '표시와 접근 권한은 바로 정리됐어요. 파일 정리는 연결되면 다시 시도할게요.');
              })
              .catch(() => Alert.alert('사진을 지우지 못했어요', '연결을 확인한 뒤 다시 시도해 주세요.'));
          },
        },
      ],
    );
  };

  return (
    <Modal animationType="fade" onRequestClose={() => !isBusy && onClose()} statusBarTranslucent transparent visible={visible && selectedPhoto !== null}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="사진 관리 닫기" onPress={() => !isBusy && onClose()} style={StyleSheet.absoluteFill} />
        {selectedPhoto ? <View accessibilityViewIsModal style={styles.card}>
          <View style={styles.heading}>
            <View><AppText style={styles.eyebrow}>TODAY&apos;S PHOTO</AppText><AppText style={styles.title}>사진 관리</AppText></View>
            <Pressable accessibilityLabel="사진 관리 닫기" accessibilityRole="button" disabled={isBusy} onPress={onClose} style={styles.closeButton}><CloseIcon /></Pressable>
          </View>

          <View style={styles.photoFrame}>
            <Image accessibilityLabel={`${selectedPhoto.position}번째 오늘의 사진`} cachePolicy="memory-disk" contentFit="cover" source={{ uri: selectedPhoto.uri }} style={styles.photo} />
            <View style={styles.positionBadge}><AppText style={styles.positionText}>{selectedPhoto.position} / 9</AppText></View>
          </View>

          <View style={styles.descriptionBlock}>
            <AppText style={styles.description}>길게 눌러 연 사진이에요. 앞·뒤 칸으로 옮겨 9칸 기록의 순서를 바꿀 수 있어요.</AppText>
            {selectedPhoto.caption ? <AppText style={styles.memo}>“{selectedPhoto.caption}”</AppText> : null}
          </View>

          <View style={styles.moveRow}>
            <MoveButton direction="backward" disabled={!moveAvailability.backward || isBusy} label="앞 칸" onPress={() => void move('backward')} />
            <MoveButton direction="forward" disabled={!moveAvailability.forward || isBusy} label="뒤 칸" onPress={() => void move('forward')} />
          </View>

          <Pressable accessibilityLabel="이 사진 지우기" accessibilityRole="button" disabled={isBusy} onPress={deletePhoto} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed, isBusy && styles.disabled]}>
            <TrashIcon />
            <AppText style={styles.deleteText}>{operation === 'deleting' ? '사진을 지우는 중...' : '사진 지우기'}</AppText>
          </Pressable>
        </View> : null}
      </View>
    </Modal>
  );
}

function MoveButton({ direction, disabled, label, onPress }: { direction: PhotoMoveDirection; disabled: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={`${label}으로 사진 순서 변경`} accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.moveButton, pressed && styles.pressed, disabled && styles.disabled]}><Chevron direction={direction} /><AppText style={styles.moveText}>{label}</AppText></Pressable>;
}

function CloseIcon() {
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d="m6 6 12 12M18 6 6 18" fill="none" stroke={colors.ink} strokeLinecap="round" strokeWidth={1.8} /></Svg>;
}

function Chevron({ direction }: { direction: PhotoMoveDirection }) {
  const path = direction === 'backward' ? 'm14.5 5-6 7 6 7' : 'm9.5 5 6 7-6 7';
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d={path} fill="none" stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></Svg>;
}

function TrashIcon() {
  return <Svg height={18} viewBox="0 0 24 24" width={18}><Path d="M5 7h14m-9-3h4m-7 3 1 13h8l1-13" fill="none" stroke={colors.danger} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} /></Svg>;
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.36)', flex: 1, justifyContent: 'center', padding: spacing[4] },
  card: { backgroundColor: '#FAFAFA', borderColor: colors.ink, borderWidth: 1.5, maxWidth: 360, padding: spacing[4], width: '100%' },
  heading: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[3] },
  eyebrow: { color: '#5D5F5F', fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.6 },
  title: { color: colors.ink, fontSize: 21, fontWeight: '800', lineHeight: 29, marginTop: 2 },
  closeButton: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  photoFrame: { backgroundColor: '#E4E4E4', borderColor: colors.ink, borderWidth: 1.5, height: 240, overflow: 'hidden', position: 'relative' },
  photo: { height: '100%', width: '100%' },
  positionBadge: { backgroundColor: colors.white, borderColor: colors.ink, borderWidth: 1, bottom: 8, paddingHorizontal: 8, paddingVertical: 4, position: 'absolute', right: 8 },
  positionText: { color: colors.ink, fontFamily: 'monospace', fontSize: 10 },
  descriptionBlock: { gap: 7, marginTop: spacing[3] },
  description: { color: '#525252', fontSize: 12, lineHeight: 18 },
  memo: { color: colors.ink, fontSize: 13, fontStyle: 'italic', lineHeight: 19 },
  moveRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  moveButton: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1.5, flex: 1, flexDirection: 'row', gap: 4, justifyContent: 'center', minHeight: 46 },
  moveText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  deleteButton: { alignItems: 'center', borderColor: colors.danger, borderWidth: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', marginTop: spacing[3], minHeight: 46 },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.76, transform: [{ translateY: 1 }] },
  disabled: { opacity: 0.35 },
});
