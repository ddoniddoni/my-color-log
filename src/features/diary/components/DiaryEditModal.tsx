import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { spacing, type ThemeColors } from '@/src/design/tokens';
import { DAILY_NOTE_MAX_LENGTH, PHOTO_CAPTION_MAX_LENGTH } from '@/src/features/diary/model/diaryEdits';
import { type DiaryEntry, type DiaryPhoto } from '@/src/features/diary/model/diaryMonth';

export type DiaryEditTarget =
  | { entry: DiaryEntry; kind: 'note' }
  | { entry: DiaryEntry; kind: 'caption'; photo: DiaryPhoto };

type DiaryEditModalProps = {
  isSaving: boolean;
  onClose: () => void;
  onSave: (value: string) => Promise<void>;
  target: DiaryEditTarget | null;
};

export function DiaryEditModal({ isSaving, onClose, onSave, target }: DiaryEditModalProps) {
  const styles = useDiaryEditStyles();
  return (
    <Modal animationType="fade" onRequestClose={() => !isSaving && onClose()} statusBarTranslucent transparent visible={target !== null}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable accessibilityLabel="메모 편집 닫기" accessibilityRole="button" accessibilityState={{ disabled: isSaving }} disabled={isSaving} onPress={onClose} style={StyleSheet.absoluteFill} />
        {target ? <DiaryEditForm key={getTargetKey(target)} isSaving={isSaving} onClose={onClose} onSave={onSave} target={target} /> : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DiaryEditForm({ isSaving, onClose, onSave, target }: Omit<DiaryEditModalProps, 'target'> & { target: DiaryEditTarget }) {
  const { colors } = useAppTheme();
  const styles = useDiaryEditStyles();
  const [value, setValue] = useState(() => getInitialValue(target));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isPhotoCaption = target.kind === 'caption';
  const maximumLength = isPhotoCaption ? PHOTO_CAPTION_MAX_LENGTH : DAILY_NOTE_MAX_LENGTH;
  const title = isPhotoCaption ? '사진 메모 수정' : '오늘의 메모';
  const description = isPhotoCaption ? '이 사진에 남길 짧은 문장을 적어 보세요.' : '그날의 장면이나 기분을 한 줄로 남겨 보세요.';

  const save = async (): Promise<void> => {
    if (isSaving) return;
    setErrorMessage(null);
    try {
      await onSave(value);
      onClose();
    } catch {
      setErrorMessage('메모를 저장하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.');
    }
  };

  return (
    <View accessibilityViewIsModal style={styles.card}>
          <View style={styles.header}>
            <View><AppText style={styles.eyebrow}>{isPhotoCaption ? 'PHOTO CAPTION' : 'DAILY NOTE'}</AppText><AppText style={styles.title}>{title}</AppText></View>
            <Pressable accessibilityLabel="메모 편집 닫기" accessibilityRole="button" accessibilityState={{ disabled: isSaving }} disabled={isSaving} hitSlop={4} onPress={onClose} style={styles.closeButton}><CloseIcon /></Pressable>
          </View>
          <AppText style={styles.description}>{description}</AppText>
          <TextInput
            accessibilityLabel={title}
            editable={!isSaving}
            maxLength={maximumLength}
            multiline
            onChangeText={setValue}
            placeholder={isPhotoCaption ? '예: 비 온 뒤 창가에 남은 색' : '예: 퇴근길에 만난 따뜻한 주황'}
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            textAlignVertical="top"
            value={value}
          />
          <AppText accessibilityLiveRegion="polite" style={styles.count}>{value.length} / {maximumLength}</AppText>
          {errorMessage ? <AppText accessibilityLiveRegion="polite" style={styles.error}>{errorMessage}</AppText> : null}
          <View style={styles.actions}>
            <Pressable accessibilityLabel="메모 편집 취소" accessibilityRole="button" accessibilityState={{ disabled: isSaving }} disabled={isSaving} onPress={onClose} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed, isSaving && styles.disabled]}><AppText style={styles.cancelText}>취소</AppText></Pressable>
            <Pressable accessibilityLabel="메모 저장" accessibilityRole="button" accessibilityState={{ busy: isSaving, disabled: isSaving }} disabled={isSaving} onPress={() => void save()} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, isSaving && styles.disabled]}><AppText style={styles.saveText}>{isSaving ? '저장 중...' : '저장'}</AppText></Pressable>
          </View>
    </View>
  );
}

function getInitialValue(target: DiaryEditTarget | null): string {
  if (!target) return '';
  return target.kind === 'caption' ? target.photo.caption ?? '' : target.entry.note ?? '';
}

function getTargetKey(target: DiaryEditTarget): string {
  return target.kind === 'caption' ? `caption-${target.photo.id}` : `note-${target.entry.id}`;
}

function CloseIcon() {
  const { colors } = useAppTheme();
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d="m6 6 12 12M18 6 6 18" fill="none" stroke={colors.ink} strokeLinecap="round" strokeWidth={1.8} /></Svg>;
}

function useDiaryEditStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: colors.overlay, flex: 1, justifyContent: 'center', padding: spacing[4] },
  card: { backgroundColor: colors.surface, borderColor: colors.ink, borderWidth: 2, boxShadow: '7px 7px 0px colors.black', maxWidth: 360, padding: spacing[4], width: '100%' },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.6 },
  title: { color: colors.ink, fontSize: 21, fontWeight: '800', lineHeight: 29, marginTop: 2 },
  closeButton: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1, height: 36, justifyContent: 'center', width: 36 },
  description: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: spacing[3] },
  input: { backgroundColor: colors.surface, borderColor: colors.ink, borderWidth: 1.5, color: colors.ink, fontSize: 15, lineHeight: 22, marginTop: spacing[3], minHeight: 118, padding: spacing[3] },
  count: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 10, marginTop: 6, textAlign: 'right' },
  error: { color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: spacing[2] },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  cancelButton: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1.5, flex: 1, justifyContent: 'center', minHeight: 46 },
  saveButton: { alignItems: 'center', backgroundColor: colors.ink, boxShadow: '3px 3px 0px colors.black', flex: 1, justifyContent: 'center', minHeight: 46 },
  cancelText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  saveText: { color: colors.surface, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.76, transform: [{ translateY: 1 }] },
  disabled: { opacity: 0.45 },
  });
}
