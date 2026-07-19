import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { colors, spacing } from '@/src/design/tokens';

export type NinePhotoMosaicPhoto = {
  id: string;
  position: number;
  uri: string;
  capturedAt: string;
  status?: 'synced' | 'syncing' | 'failed';
};

type NinePhotoMosaicProps = {
  accessibilityLabel: string;
  photos: NinePhotoMosaicPhoto[];
  onEmptyPress?: () => void;
  onPhotoPress?: (photo: NinePhotoMosaicPhoto) => void;
  onPhotoLongPress?: (photo: NinePhotoMosaicPhoto) => void;
};

export function NinePhotoMosaic({ accessibilityLabel, photos, onEmptyPress, onPhotoLongPress, onPhotoPress }: NinePhotoMosaicProps) {
  const slots = getNinePhotoMosaicSlots(photos);

  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.mosaic}>
      {Array.from({ length: 3 }, (_, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {slots.slice(rowIndex * 3, (rowIndex + 1) * 3).map((photo, columnIndex) => {
            const index = (rowIndex * 3) + columnIndex;
            const cellStyle = [styles.photoCard, photo ? styles.photoCardFilled : styles.photoCardEmpty];
            if (!photo) {
              return onEmptyPress ? (
                <Pressable accessibilityLabel={`${index + 1}번째 빈 사진 칸에 사진 추가`} accessibilityRole="button" key={`empty-${index + 1}`} onPress={onEmptyPress} style={cellStyle}>
                  <AppText style={styles.emptyAddMark}>+</AppText>
                </Pressable>
              ) : <View accessibilityLabel={`${index + 1}번째 빈 사진 칸`} key={`empty-${index + 1}`} style={cellStyle} />;
            }

            const content = (
              <>
                <Image cachePolicy="memory-disk" contentFit="cover" source={{ uri: photo.uri }} style={styles.photoImage} />
                {photo.status && photo.status !== 'synced' ? <View style={[styles.photoStatus, photo.status === 'failed' ? styles.photoStatusFailed : styles.photoStatusSyncing]}><AppText style={styles.photoStatusText}>{photo.status === 'failed' ? '!' : '↥'}</AppText></View> : null}
              </>
            );

            return onPhotoPress || onPhotoLongPress ? (
              <Pressable
                accessibilityHint={onPhotoLongPress ? '길게 누르면 사진 순서를 관리할 수 있어요.' : undefined}
                accessibilityLabel={`${photo.position}번째 오늘의 색 사진`}
                accessibilityRole="button"
                key={photo.id}
                onLongPress={onPhotoLongPress ? () => onPhotoLongPress(photo) : undefined}
                onPress={onPhotoPress ? () => onPhotoPress(photo) : undefined}
                style={cellStyle}
              >{content}</Pressable>
            ) : <View accessibilityLabel={`${photo.position}번째 오늘의 색 사진`} key={photo.id} style={cellStyle}>{content}</View>;
          })}
        </View>
      ))}
    </View>
  );
}

function getNinePhotoMosaicSlots(photos: NinePhotoMosaicPhoto[]): (NinePhotoMosaicPhoto | null)[] {
  const photoByPosition = new Map(photos.map((photo) => [photo.position, photo]));
  return Array.from({ length: 9 }, (_, index) => photoByPosition.get(index + 1) ?? null);
}

const styles = StyleSheet.create({
  mosaic: { alignSelf: 'stretch', aspectRatio: 1, gap: spacing[2], width: '100%' },
  row: { flex: 1, flexDirection: 'row', gap: spacing[2] },
  photoCard: { borderColor: colors.ink, borderWidth: 1, flex: 1, overflow: 'hidden', position: 'relative' },
  photoCardFilled: { backgroundColor: '#E4E4E4' },
  photoCardEmpty: { alignItems: 'center', backgroundColor: '#F1F1EF', borderColor: '#B7B7B2', borderStyle: 'dashed', justifyContent: 'center' },
  emptyAddMark: { color: '#8E8D88', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  photoImage: { height: '100%', width: '100%' },
  photoStatus: { alignItems: 'center', borderColor: colors.white, borderRadius: 9, borderWidth: 1, height: 18, justifyContent: 'center', left: 5, position: 'absolute', top: 5, width: 18 },
  photoStatusSyncing: { backgroundColor: colors.info },
  photoStatusFailed: { backgroundColor: colors.danger },
  photoStatusText: { color: colors.white, fontSize: 10, fontWeight: '700' },
});
