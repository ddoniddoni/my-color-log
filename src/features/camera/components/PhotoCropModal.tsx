import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { spacing, type ThemeColors } from '@/src/design/tokens';
import {
  createPhotoCropAdjustment,
  getSquareCropForAdjustment,
  MAX_PHOTO_CROP_ZOOM,
  MIN_PHOTO_CROP_ZOOM,
  movePhotoCropFocus,
  normalizePhotoCropAdjustment,
  PHOTO_CROP_ZOOM_STEP,
  type PhotoCropMoveDirection,
} from '@/src/features/camera/model/photoCrop';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';

type PhotoCropModalProps = {
  isApplying: boolean;
  onApply: (crop: ReturnType<typeof getSquareCropForAdjustment>) => void;
  onClose: () => void;
  photo: PendingPhoto;
};

export function PhotoCropModal({ isApplying, onApply, onClose, photo }: PhotoCropModalProps) {
  const styles = usePhotoCropStyles();
  const { t } = useAppLanguage();
  const { height, width } = useWindowDimensions();
  const [adjustment, setAdjustment] = useState(createPhotoCropAdjustment);
  const crop = useMemo(
    () => getSquareCropForAdjustment(adjustment, photo.width, photo.height),
    [adjustment, photo.height, photo.width],
  );
  const previewSide = Math.min(Math.max(width - 48, 180), 360, Math.max(height - 370, 180));
  const previewScale = previewSide / crop.width;
  const previewImageStyle = {
    height: photo.height * previewScale,
    left: -crop.originX * previewScale,
    top: -crop.originY * previewScale,
    width: photo.width * previewScale,
  } as const;

  const changeZoom = (delta: number): void => {
    setAdjustment((current) => normalizePhotoCropAdjustment(
      { ...current, zoom: current.zoom + delta },
      photo.width,
      photo.height,
    ));
  };

  const moveFocus = (direction: PhotoCropMoveDirection): void => {
    setAdjustment((current) => movePhotoCropFocus(current, direction, photo.width, photo.height));
  };

  return (
    <Modal animationType="slide" onRequestClose={() => { if (!isApplying) onClose(); }} statusBarTranslucent transparent visible>
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <AppText style={styles.eyebrow}>CROP & COMPOSE</AppText>
              <AppText style={styles.title}>사진 구도 맞추기</AppText>
              <AppText style={styles.description}>확대하고 방향 버튼으로 정사각형 안의 장면을 옮겨 보세요.</AppText>
            </View>
            <Pressable accessibilityLabel={t('사진 자르기 닫기')} accessibilityRole="button" accessibilityState={{ disabled: isApplying }} disabled={isApplying} hitSlop={8} onPress={onClose} style={styles.closeButton}>
              <AppText style={styles.closeButtonText}>×</AppText>
            </Pressable>
          </View>

          <View style={[styles.previewFrame, { height: previewSide, width: previewSide }]}>
            <Image cachePolicy="none" contentFit="fill" source={{ uri: photo.localUri }} style={[styles.previewImage, previewImageStyle]} />
            <View pointerEvents="none" style={styles.previewGuide}>
              <View style={[styles.guideCorner, styles.guideTopLeft]} />
              <View style={[styles.guideCorner, styles.guideTopRight]} />
              <View style={[styles.guideCorner, styles.guideBottomLeft]} />
              <View style={[styles.guideCorner, styles.guideBottomRight]} />
            </View>
          </View>

          <View style={styles.zoomControls}>
            <Pressable accessibilityLabel={t('사진 축소')} accessibilityRole="button" accessibilityState={{ disabled: isApplying || adjustment.zoom <= MIN_PHOTO_CROP_ZOOM }} disabled={isApplying || adjustment.zoom <= MIN_PHOTO_CROP_ZOOM} onPress={() => changeZoom(-PHOTO_CROP_ZOOM_STEP)} style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed, (isApplying || adjustment.zoom <= MIN_PHOTO_CROP_ZOOM) && styles.disabled]}>
              <AppText style={styles.zoomButtonText}>−</AppText>
            </Pressable>
            <AppText style={styles.zoomLabel}>{Math.round(adjustment.zoom * 100)}%</AppText>
            <Pressable accessibilityLabel={t('사진 확대')} accessibilityRole="button" accessibilityState={{ disabled: isApplying || adjustment.zoom >= MAX_PHOTO_CROP_ZOOM }} disabled={isApplying || adjustment.zoom >= MAX_PHOTO_CROP_ZOOM} onPress={() => changeZoom(PHOTO_CROP_ZOOM_STEP)} style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed, (isApplying || adjustment.zoom >= MAX_PHOTO_CROP_ZOOM) && styles.disabled]}>
              <AppText style={styles.zoomButtonText}>+</AppText>
            </Pressable>
          </View>

          <View style={styles.directionControls}>
            <CropDirectionButton direction="up" disabled={isApplying || adjustment.zoom === MIN_PHOTO_CROP_ZOOM} onPress={moveFocus} />
            <View style={styles.directionMiddle}>
              <CropDirectionButton direction="left" disabled={isApplying || adjustment.zoom === MIN_PHOTO_CROP_ZOOM} onPress={moveFocus} />
              <View accessible accessibilityLabel={t('정사각형 자르기 프레임')} accessibilityRole="image" style={styles.directionCenter}><CropFrameIcon /></View>
              <CropDirectionButton direction="right" disabled={isApplying || adjustment.zoom === MIN_PHOTO_CROP_ZOOM} onPress={moveFocus} />
            </View>
            <CropDirectionButton direction="down" disabled={isApplying || adjustment.zoom === MIN_PHOTO_CROP_ZOOM} onPress={moveFocus} />
          </View>

          <View style={styles.actions}>
            <Pressable accessibilityLabel={t('사진 자르기 취소')} accessibilityRole="button" accessibilityState={{ disabled: isApplying }} disabled={isApplying} onPress={onClose} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed, isApplying && styles.disabled]}><AppText style={styles.cancelButtonText}>취소</AppText></Pressable>
            <Pressable accessibilityLabel={t('사진 구도 적용')} accessibilityRole="button" accessibilityState={{ busy: isApplying, disabled: isApplying }} disabled={isApplying} onPress={() => onApply(crop)} style={({ pressed }) => [styles.applyButton, pressed && styles.pressed, isApplying && styles.disabled]}><AppText style={styles.applyButtonText}>{isApplying ? '적용 중...' : '구도 적용'}</AppText></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CropDirectionButton({ direction, disabled, onPress }: { direction: PhotoCropMoveDirection; disabled: boolean; onPress: (direction: PhotoCropMoveDirection) => void }) {
  const styles = usePhotoCropStyles();
  const { t } = useAppLanguage();
  const label = direction === 'up' ? '자르기 영역 위로 이동' : direction === 'down' ? '자르기 영역 아래로 이동' : direction === 'left' ? '자르기 영역 왼쪽으로 이동' : '자르기 영역 오른쪽으로 이동';

  return (
    <Pressable accessibilityLabel={t(label)} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={() => onPress(direction)} style={({ pressed }) => [styles.directionButton, pressed && styles.pressed, disabled && styles.disabled]}>
      <DirectionArrow direction={direction} />
    </Pressable>
  );
}

function DirectionArrow({ direction }: { direction: PhotoCropMoveDirection }) {
  const { colors } = useAppTheme();
  const rotation = direction === 'up' ? '0deg' : direction === 'right' ? '90deg' : direction === 'down' ? '180deg' : '-90deg';
  return <View style={{ transform: [{ rotate: rotation }] }}><Svg height={20} viewBox="0 0 24 24" width={20}><Path d="m6 14 6-6 6 6" fill="none" stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} /></Svg></View>;
}

function CropFrameIcon() {
  const { colors } = useAppTheme();
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d="M7 3v14a2 2 0 0 0 2 2h12M3 7h12a2 2 0 0 1 2 2v12" fill="none" stroke={colors.ink} strokeLinecap="round" strokeWidth={1.5} /></Svg>;
}

function usePhotoCropStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: colors.overlay, flex: 1, justifyContent: 'center', padding: spacing[3] },
  card: { backgroundColor: colors.surface, borderColor: colors.ink, borderWidth: 2, boxShadow: `7px 7px 0px ${colors.black}`, maxWidth: 408, padding: spacing[4], width: '100%' },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[4] },
  headerCopy: { flex: 1, paddingRight: spacing[2] },
  eyebrow: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.9 },
  title: { color: colors.ink, fontSize: 21, fontWeight: '800', letterSpacing: -0.65, lineHeight: 28, marginTop: 2 },
  description: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 3 },
  closeButton: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1.5, height: 36, justifyContent: 'center', width: 36 },
  closeButtonText: { color: colors.ink, fontSize: 26, fontWeight: '300', lineHeight: 30 },
  previewFrame: { alignSelf: 'center', backgroundColor: colors.black, borderColor: colors.ink, borderWidth: 2, overflow: 'hidden' },
  previewImage: { position: 'absolute' },
  previewGuide: { borderColor: colors.surface, borderWidth: 1, bottom: 10, left: 10, position: 'absolute', right: 10, top: 10 },
  guideCorner: { borderColor: colors.surface, height: 16, position: 'absolute', width: 16 },
  guideTopLeft: { borderLeftWidth: 2, borderTopWidth: 2, left: -1, top: -1 },
  guideTopRight: { borderRightWidth: 2, borderTopWidth: 2, right: -1, top: -1 },
  guideBottomLeft: { borderBottomWidth: 2, borderLeftWidth: 2, bottom: -1, left: -1 },
  guideBottomRight: { borderBottomWidth: 2, borderRightWidth: 2, bottom: -1, right: -1 },
  zoomControls: { alignItems: 'center', flexDirection: 'row', gap: spacing[3], justifyContent: 'center', marginTop: spacing[3] },
  zoomButton: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1.5, height: 44, justifyContent: 'center', width: 44 },
  zoomButtonText: { color: colors.ink, fontSize: 24, fontWeight: '500', lineHeight: 28 },
  zoomLabel: { color: colors.ink, fontFamily: 'monospace', fontSize: 13, fontWeight: '700', textAlign: 'center', width: 56 },
  directionControls: { alignItems: 'center', gap: 3, marginTop: spacing[3] },
  directionMiddle: { flexDirection: 'row', gap: 3 },
  directionButton: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  directionCenter: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.ink, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  cancelButton: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1.5, flex: 1, justifyContent: 'center', minHeight: 50 },
  cancelButtonText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  applyButton: { alignItems: 'center', backgroundColor: colors.ink, boxShadow: `3px 3px 0px ${colors.black}`, flex: 1, justifyContent: 'center', minHeight: 50 },
  applyButtonText: { color: colors.surface, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },
  });
}
