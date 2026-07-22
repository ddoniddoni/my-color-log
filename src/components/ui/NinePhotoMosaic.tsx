import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { spacing } from '@/src/design/tokens';

export type NinePhotoMosaicPhoto = {
  accessibilityLabel?: string;
  id: string;
  position: number;
  uri: string;
  capturedAt: string;
  status?: 'pending' | 'synced' | 'syncing' | 'failed';
};

type NinePhotoMosaicProps = {
  accessibilityLabel: string;
  photos: NinePhotoMosaicPhoto[];
  onEmptyPress?: () => void;
  onPhotoPress?: (photo: NinePhotoMosaicPhoto) => void;
  onPhotoLongPress?: (photo: NinePhotoMosaicPhoto) => void;
};

export function NinePhotoMosaic({ accessibilityLabel, photos, onEmptyPress, onPhotoLongPress, onPhotoPress }: NinePhotoMosaicProps) {
  const theme = useAppTheme();
  const slots = getNinePhotoMosaicSlots(photos);

  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.mosaic}>
      {Array.from({ length: 3 }, (_, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {slots.slice(rowIndex * 3, (rowIndex + 1) * 3).map((photo, columnIndex) => {
            const index = (rowIndex * 3) + columnIndex;
            const cellStyle = [
              styles.photoCard,
              { borderColor: theme.colors.ink },
              photo
                ? [styles.photoCardFilled, { backgroundColor: theme.colors.surfaceMuted }]
                : [styles.photoCardEmpty, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }],
            ];
            if (!photo) {
              return onEmptyPress ? (
                <Pressable accessibilityLabel={`${index + 1}번째 빈 사진 칸에 사진 추가`} accessibilityRole="button" key={`empty-${index + 1}`} onPress={onEmptyPress} style={cellStyle}>
                  <AppText style={[styles.emptyAddMark, { color: theme.colors.textTertiary }]}>+</AppText>
                </Pressable>
              ) : <View accessibilityLabel={`${index + 1}번째 빈 사진 칸`} accessibilityRole="image" accessible key={`empty-${index + 1}`} style={cellStyle} />;
            }

            const content = (
              <>
                <Image cachePolicy="memory-disk" contentFit="cover" source={{ uri: photo.uri }} style={styles.photoImage} />
                {photo.status && photo.status !== 'synced' ? <View style={[
                  styles.photoStatus,
                  { borderColor: theme.colors.surface },
                  photo.status === 'failed'
                    ? [styles.photoStatusFailed, { backgroundColor: theme.colors.danger }]
                    : photo.status === 'pending'
                      ? [styles.photoStatusPending, { backgroundColor: theme.colors.warning }]
                      : [styles.photoStatusSyncing, { backgroundColor: theme.colors.info }],
                ]}><AppText style={styles.photoStatusText}>{photo.status === 'failed' ? '!' : photo.status === 'pending' ? '…' : '↥'}</AppText></View> : null}
              </>
            );

            return onPhotoPress || onPhotoLongPress ? (
              <Pressable
                accessibilityHint={onPhotoLongPress ? '길게 누르면 사진 순서를 관리할 수 있어요.' : undefined}
                accessibilityLabel={photo.accessibilityLabel ?? `${photo.position}번째 오늘의 색 사진`}
                accessibilityRole="button"
                key={photo.id}
                onLongPress={onPhotoLongPress ? () => onPhotoLongPress(photo) : undefined}
                onPress={onPhotoPress ? () => onPhotoPress(photo) : undefined}
                style={cellStyle}
              >{content}</Pressable>
            ) : <View accessibilityLabel={photo.accessibilityLabel ?? `${photo.position}번째 오늘의 색 사진`} accessibilityRole="image" accessible key={photo.id} style={cellStyle}>{content}</View>;
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
  photoCard: { borderWidth: 1, flex: 1, overflow: 'hidden', position: 'relative' },
  photoCardFilled: {},
  photoCardEmpty: { alignItems: 'center', borderStyle: 'dashed', justifyContent: 'center' },
  emptyAddMark: { fontSize: 28, fontWeight: '300', lineHeight: 32 },
  photoImage: { height: '100%', width: '100%' },
  photoStatus: { alignItems: 'center', borderRadius: 9, borderWidth: 1, height: 18, justifyContent: 'center', left: 5, position: 'absolute', top: 5, width: 18 },
  photoStatusSyncing: {},
  photoStatusPending: {},
  photoStatusFailed: {},
  photoStatusText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
});
