import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { AppModal } from '@/src/components/ui/AppModal';
import { AppText } from '@/src/components/ui/AppText';
import { colors, spacing } from '@/src/design/tokens';

type PhotoSourceModalProps = {
  errorMessage: string | null;
  isImporting: boolean;
  onCamera: () => void;
  onClose: () => void;
  onGallery: () => void;
  visible: boolean;
};

export function PhotoSourceModal({ errorMessage, isImporting, onCamera, onClose, onGallery, visible }: PhotoSourceModalProps) {
  return (
    <AppModal accessibilityLabel="사진 추가 방법 닫기" contentStyle={styles.card} isBusy={isImporting} onClose={onClose} visible={visible}>
          <View style={styles.header}>
            <View>
              <AppText style={styles.eyebrow}>ADD TO TODAY</AppText>
              <AppText accessibilityRole="header" style={styles.title}>오늘의 장면 추가</AppText>
              <AppText style={styles.description}>새로 찍거나, 이미 발견한 사진을 골라 보세요.</AppText>
            </View>
            <Pressable accessibilityLabel="사진 추가 방법 닫기" accessibilityRole="button" disabled={isImporting} onPress={onClose} style={styles.closeButton}><AppText style={styles.closeButtonText}>×</AppText></Pressable>
          </View>

          <Pressable accessibilityLabel="카메라로 사진 찍기" accessibilityRole="button" disabled={isImporting} onPress={onCamera} style={({ pressed }) => [styles.sourceButton, pressed && styles.pressed, isImporting && styles.disabled]}>
            <View style={styles.sourceIcon}><CameraIcon /></View>
            <View style={styles.sourceCopy}><AppText style={styles.sourceTitle}>사진 찍기</AppText><AppText style={styles.sourceDescription}>지금 발견한 색을 바로 남겨요.</AppText></View>
            <AppText style={styles.sourceArrow}>→</AppText>
          </Pressable>

          <Pressable accessibilityLabel="갤러리에서 사진 선택" accessibilityRole="button" accessibilityState={{ busy: isImporting, disabled: isImporting }} disabled={isImporting} onPress={onGallery} style={({ pressed }) => [styles.sourceButton, pressed && styles.pressed, isImporting && styles.disabled]}>
            <View style={styles.sourceIcon}><GalleryIcon /></View>
            <View style={styles.sourceCopy}><AppText style={styles.sourceTitle}>{isImporting ? '사진 불러오는 중…' : '갤러리에서 선택'}</AppText><AppText style={styles.sourceDescription}>선택 후 정사각형 구도를 다시 맞춰요.</AppText></View>
            <AppText style={styles.sourceArrow}>→</AppText>
          </Pressable>

          {errorMessage ? <AppText accessibilityLiveRegion="polite" style={styles.errorText}>{errorMessage}</AppText> : null}
    </AppModal>
  );
}

function CameraIcon() {
  return <Svg height={24} viewBox="0 0 24 24" width={24}><Rect fill="none" height={12} rx={1.5} stroke={colors.ink} strokeWidth={1.6} width={17} x={3.5} y={7.5} /><Path d="M8 7.5 9.4 5h5.2L16 7.5" fill="none" stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} /><Circle cx={12} cy={13.5} fill="none" r={3.2} stroke={colors.ink} strokeWidth={1.6} /></Svg>;
}

function GalleryIcon() {
  return <Svg height={24} viewBox="0 0 24 24" width={24}><Rect fill="none" height={15} rx={1.3} stroke={colors.ink} strokeWidth={1.6} width={18} x={3} y={4.5} /><Circle cx={9} cy={10} fill="none" r={1.6} stroke={colors.ink} strokeWidth={1.4} /><Path d="m5.5 17 4.1-4 3.1 2.8 2.4-2.3 3.3 3.5" fill="none" stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} /></Svg>;
}

const styles = StyleSheet.create({
  card: { padding: spacing[4] },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[3] },
  eyebrow: { color: 'rgba(0, 0, 0, 0.58)', fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.85 },
  title: { color: colors.black, fontSize: 22, fontWeight: '800', letterSpacing: -0.7, lineHeight: 29, marginTop: 1 },
  description: { color: 'rgba(0, 0, 0, 0.62)', fontSize: 12, lineHeight: 18, marginTop: 2 },
  closeButton: { alignItems: 'center', borderColor: colors.black, borderWidth: 1.5, height: 44, justifyContent: 'center', marginLeft: spacing[2], width: 44 },
  closeButtonText: { color: colors.black, fontSize: 27, fontWeight: '300', lineHeight: 30 },
  sourceButton: { alignItems: 'center', borderColor: colors.black, borderTopWidth: 1.5, flexDirection: 'row', minHeight: 78, paddingVertical: spacing[2] },
  sourceIcon: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  sourceCopy: { flex: 1, paddingHorizontal: spacing[2] },
  sourceTitle: { color: colors.black, fontSize: 15, fontWeight: '800' },
  sourceDescription: { color: 'rgba(0, 0, 0, 0.62)', fontSize: 11, lineHeight: 16, marginTop: 2 },
  sourceArrow: { color: colors.black, fontSize: 24, fontWeight: '400', paddingHorizontal: 4 },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: spacing[3] },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
});
