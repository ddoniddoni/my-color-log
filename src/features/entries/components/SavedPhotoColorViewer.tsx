import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { spacing } from '@/src/design/tokens';
import { ColorIsolationPreview, isColorIsolationPreviewAvailable } from '@/src/features/camera/components/ColorIsolationPreview';
import { isColorHex } from '@/src/features/camera/model/colorIsolation';
import { type TodayPhoto } from '../model/todayPhotos';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';

export function SavedPhotoColorViewer({ photo, colorHex, colorName, disabled, enabled, onEnabledChange }: { photo: TodayPhoto; colorHex: string; colorName: { ko: string; en: string }; disabled: boolean; enabled: boolean; onEnabledChange: (enabled: boolean) => Promise<void> }) {
  const { colors } = useAppTheme();
  const { t, format, language } = useAppLanguage();
  const [size, setSize] = useState(0);
  const [failed, setFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const applied = photo.colorIsolationApplied === true;
  const available = isViewingAvailable(photo.uri, colorHex, size);
  const checked = applied || (enabled && !failed);
  const toggleDisabled = disabled || saving || applied || !available;
  const label = format('{position}번째 오늘의 사진', { position: photo.position });
  const description = saveFailed ? '보기 설정을 저장하지 못했어요. 다시 시도해 주세요.' : viewingDescription({ applied, failed, uri: photo.uri, colorHex });
  const change = async (value: boolean) => {
    if (toggleDisabled) return;
    setSaveFailed(false);
    setSaving(true);
    try { await onEnabledChange(value); setFailed(false); }
    catch { setSaveFailed(true); }
    finally { setSaving(false); }
  };

  return (
    <View>
      <View style={[styles.frame, { backgroundColor: colors.surfaceMuted, borderColor: colors.ink }]}>
        <View accessible accessibilityLabel={label} accessibilityRole="image" onLayout={(event) => setSize(event.nativeEvent.layout.width)} style={styles.imageArea}>
          <SavedPhotoImage colorHex={colorHex} enabled={checked && !applied && available} onError={() => setFailed(true)} size={size} uri={photo.uri} />
        </View>
        <View style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.ink }]}><AppText>{photo.position} / 9</AppText></View>
      </View>
      <View style={styles.control}>
        <View style={styles.controlText}><AppText>오늘의 색만 보기</AppText><AppText localize={false} color="secondary">{language === 'ko' ? colorName.ko : colorName.en}</AppText><AppText accessibilityLiveRegion="polite" color="secondary" style={styles.description}>{description}</AppText></View>
        <Switch accessibilityLabel={t('오늘의 색만 보기')} accessibilityState={{ checked, disabled: toggleDisabled, busy: saving }} disabled={toggleDisabled} onValueChange={(value) => void change(value)} style={styles.switch} value={checked} />
      </View>
    </View>
  );
}

function isViewingAvailable(uri: string | null, colorHex: string, size: number): boolean {
  return isColorHex(colorHex) && isColorIsolationPreviewAvailable && Boolean(uri) && size > 0;
}

function SavedPhotoImage({ colorHex, enabled, onError, size, uri }: { colorHex: string; enabled: boolean; onError: () => void; size: number; uri: string | null }) {
  if (enabled && uri) return <ColorIsolationPreview colorHex={colorHex} mode="isolate" onError={onError} size={size} uri={uri} />;
  return <Image cachePolicy="memory-disk" contentFit="cover" source={uri ? { uri } : undefined} style={styles.photo} />;
}

function viewingDescription({ applied, failed, uri, colorHex }: { applied: boolean; failed: boolean; uri: string | null; colorHex: string }): string {
  if (applied) return '색 강조가 적용된 채 저장된 사진이에요.';
  if (failed) return '색 강조를 불러오지 못했어요. 저장된 사진을 표시해요. 다시 켜서 재시도해 주세요.';
  if (!uri) return '사진을 불러온 뒤 색 강조를 사용할 수 있어요.';
  if (!isColorHex(colorHex)) return '색 정보를 다시 불러와 주세요.';
  if (!isColorIsolationPreviewAvailable) return '이 기기에서는 저장된 사진으로 표시해요.';
  return '이 기기의 9칸에도 반영돼요. 끄면 저장된 사진으로 돌아가요.';
}

const styles = StyleSheet.create({
  frame: { borderWidth: 1.5, overflow: 'hidden' },
  imageArea: { aspectRatio: 1, width: '100%', overflow: 'hidden' },
  photo: { height: '100%', width: '100%' },
  badge: { borderWidth: 1, bottom: 8, right: 8, paddingHorizontal: 8, paddingVertical: 4, position: 'absolute' },
  control: { alignItems: 'center', flexDirection: 'row', gap: spacing[2], marginTop: spacing[3], minHeight: 44 },
  controlText: { flex: 1, gap: spacing[1] },
  switch: { minHeight: 44, minWidth: 44 },
  description: { fontSize: 12, lineHeight: 18 },
});
