import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { colors, spacing } from '@/src/design/tokens';
import { confirmCapturedPhoto, discardCapturedPhoto } from '@/src/features/camera/api/localPhotoRepository';
import { useQueuedPhoto } from '@/src/features/sync/hooks/useQueuedPhoto';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';
import { queryKeys } from '@/src/lib/query/queryKeys';

export type PhotoReviewContext = {
  photoId: string;
  colorNameEn: string;
};

export function PhotoReviewScreen({ reviewContext }: { reviewContext: PhotoReviewContext }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const photoQuery = useQueuedPhoto(reviewContext.photoId);
  const [caption, setCaption] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const colorTag = `#${reviewContext.colorNameEn.replaceAll(' ', '').toUpperCase()}`;
  const photo = photoQuery.data;

  const retake = async (): Promise<void> => {
    if (!photo) return;
    setIsSaving(true);
    try {
      await discardCapturedPhoto(photo);
      router.replace({
        pathname: '/camera',
        params: {
          missionId: photo.missionId,
          dateKey: photo.dateKey,
          position: String(photo.position),
          colorNameEn: reviewContext.colorNameEn,
        },
      });
    } catch {
      setErrorMessage('사진을 정리하지 못했어요. 잠시 후 다시 시도해 주세요.');
      setIsSaving(false);
    }
  };

  const savePhoto = async (): Promise<void> => {
    if (!photo || isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const confirmedPhoto = await confirmCapturedPhoto(photo, caption);
      queryClient.setQueryData<PendingPhoto[]>(queryKeys.pendingPhotos(photo.userId, photo.dateKey), (currentQueue) => [
        ...(currentQueue ?? []).filter((queuedPhoto) => queuedPhoto.id !== confirmedPhoto.id),
        confirmedPhoto,
      ].sort((left, right) => left.position - right.position));
      router.replace('/(tabs)');
    } catch {
      setErrorMessage('사진을 기록 목록에 추가하지 못했어요. 다시 시도해 주세요.');
      setIsSaving(false);
    }
  };

  const closeReview = async (): Promise<void> => {
    if (!photo) {
      router.replace('/(tabs)');
      return;
    }
    setIsSaving(true);
    try {
      await discardCapturedPhoto(photo);
      router.replace('/(tabs)');
    } catch {
      setErrorMessage('사진을 정리하지 못했어요. 잠시 후 다시 시도해 주세요.');
      setIsSaving(false);
    }
  };

  if (photoQuery.isPending) {
    return <View style={styles.loadingPage}><AppText style={styles.loadingText}>사진을 안전하게 준비하고 있어요.</AppText></View>;
  }

  if (photoQuery.isError || !photo) {
    return <View style={styles.loadingPage}><AppText style={styles.loadingText}>사진을 불러오지 못했어요.</AppText><Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)')} style={styles.backButton}><AppText style={styles.backButtonText}>오늘로 돌아가기</AppText></Pressable></View>;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <View style={[styles.brandBar, { paddingTop: Math.max(insets.top, 6) }]}>
        <View style={styles.brandGroup}><ScribbleMark /><AppText style={styles.brandText}>Color Log</AppText></View>
        <Pressable accessibilityLabel="촬영 결과 닫기" accessibilityRole="button" disabled={isSaving} hitSlop={10} onPress={() => void closeReview()} style={styles.closeButton}><CloseIcon /></Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 18) }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <View>
            <AppText style={styles.title}>Check your{`\n`}catch!</AppText>
            <View style={styles.titleUnderline} />
          </View>
          <View pointerEvents="none" style={styles.headerSparkle}><SparkleIcon /></View>
        </View>
        <View style={styles.photoStageWrapper}>
          <View pointerEvents="none" style={styles.photoStageShadow} />
          <View style={styles.photoStage}>
            <Image cachePolicy="memory-disk" contentFit="cover" source={{ uri: photo.localUri }} style={styles.photoBlur} />
            <View pointerEvents="none" style={styles.photoDimmer} />
            <View pointerEvents="none" style={styles.photoPreviewPaper}>
              <Image accessibilityLabel="촬영한 오늘의 색 사진" cachePolicy="memory-disk" contentFit="cover" source={{ uri: photo.localUri }} style={styles.photoPreview} />
              <AppText style={styles.photoFileName}>오늘의 발견</AppText>
            </View>
            <View pointerEvents="none" style={styles.photoReviewBadge}><AppText style={styles.photoReviewBadgeText}>촬영 결과 확인</AppText></View>
            <View pointerEvents="none" style={styles.cropMark}><CropIcon /></View>
            <View pointerEvents="none" style={styles.resetMark}><AgainIcon /></View>
          </View>
        </View>

        <View style={styles.colorLabel}><AppText numberOfLines={1} style={styles.colorLabelText}>FOUND {colorTag}</AppText></View>

        <View style={styles.memoGroup}>
          <AppText style={styles.memoLabel}>ADD A MEMO</AppText>
          <TextInput
            accessibilityLabel="사진 메모"
            maxLength={80}
            onChangeText={setCaption}
            placeholder="Found this in the back garden..."
            placeholderTextColor="#BDBDBD"
            style={styles.memoInput}
            value={caption}
          />
        </View>

        <View style={styles.tags}><Tag label="#nature" /><Tag label="#dailylog" /><Tag label={colorTag.toLowerCase()} /></View>

        {errorMessage ? <AppText accessibilityLiveRegion="polite" style={styles.errorText}>{errorMessage}</AppText> : null}

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={isSaving} onPress={() => void retake()} style={({ pressed }) => [styles.actionButton, styles.againButton, pressed && styles.pressed, isSaving && styles.disabled]}><View style={styles.actionContent}><AgainIcon /><AppText style={styles.againText}>Again</AppText></View></Pressable>
          <Pressable accessibilityRole="button" disabled={isSaving} onPress={() => void savePhoto()} style={({ pressed }) => [styles.actionButton, styles.useButton, pressed && styles.pressed, isSaving && styles.disabled]}><View style={styles.actionContent}><CheckIcon /><AppText style={styles.useText}>{isSaving ? 'Saving...' : 'Use'}</AppText></View></Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Tag({ label }: { label: string }) {
  return <View style={styles.tag}><AppText style={styles.tagText}>{label}</AppText></View>;
}

function ScribbleMark() {
  return <Svg height={24} viewBox="0 0 24 24" width={24}><Path d="M6 18 18 6M7 9l3-3m4 12 4-4M5 14l5-5m4 1 4-4" fill="none" stroke={colors.ink} strokeLinecap="round" strokeWidth={2.2} /></Svg>;
}

function SparkleIcon() {
  return <Svg height={62} viewBox="0 0 62 62" width={62}><Path d="M31 2c4 17 11 24 29 29-18 5-25 12-29 29C27 43 20 36 2 31 20 26 27 19 31 2Z" fill="#F0F0F0" /><Path d="M31 15c2 9 6 13 16 16-10 3-14 7-16 16-2-9-6-13-16-16 10-3 14-7 16-16Z" fill="#FAFAFA" /></Svg>;
}

function CloseIcon() {
  return <Svg height={22} viewBox="0 0 24 24" width={22}><Path d="m6 6 12 12M18 6 6 18" stroke={colors.ink} strokeLinecap="round" strokeWidth={1.5} /></Svg>;
}

function CropIcon() {
  return <Svg height={22} viewBox="0 0 24 24" width={22}><Path d="M7 3v14a2 2 0 0 0 2 2h12M3 7h12a2 2 0 0 1 2 2v12" fill="none" stroke={colors.ink} strokeLinecap="round" strokeWidth={1.5} /></Svg>;
}

function AgainIcon() {
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Circle cx={12} cy={12} fill="none" r={8} stroke={colors.ink} strokeWidth={1.5} /><Path d="m8 8-2 3 3 1" fill="none" stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} /></Svg>;
}

function CheckIcon() {
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d="m5 12 4 4L19 6" fill="none" stroke={colors.white} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} /></Svg>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#F9F9F9', flex: 1 },
  loadingPage: { alignItems: 'center', backgroundColor: '#F9F9F9', flex: 1, gap: spacing[4], justifyContent: 'center', padding: spacing[6] },
  loadingText: { color: colors.ink, fontSize: 15, textAlign: 'center' },
  backButton: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1.5, minHeight: 46, justifyContent: 'center', paddingHorizontal: spacing[5] },
  backButtonText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  brandBar: { alignItems: 'center', borderBottomColor: colors.ink, borderBottomWidth: 2, flexDirection: 'row', justifyContent: 'space-between', minHeight: 55, paddingBottom: 6, paddingHorizontal: spacing[4] },
  brandGroup: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  brandText: { color: colors.ink, fontFamily: 'monospace', fontSize: 15, fontStyle: 'italic', fontWeight: '700' },
  closeButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  content: { paddingHorizontal: spacing[5], paddingTop: spacing[4] },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerSparkle: { opacity: 0.72, position: 'absolute', right: 20, top: 2 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.65, lineHeight: 28 },
  titleUnderline: { backgroundColor: colors.ink, height: 1.5, marginTop: 6, width: 160 },
  photoStageWrapper: { height: 294, marginTop: spacing[4], position: 'relative' },
  photoStageShadow: { backgroundColor: colors.ink, bottom: 0, left: 7, position: 'absolute', right: -7, top: 7, transform: [{ rotate: '1deg' }] },
  photoStage: { alignItems: 'center', backgroundColor: '#D8D8D8', borderColor: colors.ink, borderWidth: 1.5, bottom: 7, justifyContent: 'center', left: 0, overflow: 'hidden', position: 'absolute', right: 0, top: 0 },
  photoBlur: { height: '100%', opacity: 0.6, width: '100%' },
  photoDimmer: { backgroundColor: 'rgba(255,255,255,0.5)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  photoPreviewPaper: { alignItems: 'center', backgroundColor: colors.white, borderColor: '#ECECEC', borderWidth: 1, padding: 8, position: 'absolute', width: 144 },
  photoPreview: { height: 136, width: 126 },
  photoFileName: { color: '#8C8C8C', fontFamily: 'monospace', fontSize: 7, marginTop: 5 },
  photoReviewBadge: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 7, boxShadow: '0px 1px 2px rgba(0,0,0,0.18)', justifyContent: 'center', minHeight: 24, paddingHorizontal: 14, position: 'absolute', top: 10 },
  photoReviewBadgeText: { color: colors.ink, fontSize: 8, fontWeight: '700' },
  cropMark: { alignItems: 'center', backgroundColor: '#FFF', borderColor: colors.ink, borderWidth: 1, bottom: 12, height: 36, justifyContent: 'center', position: 'absolute', right: 12, width: 36 },
  resetMark: { alignItems: 'center', backgroundColor: '#FFF', borderColor: colors.ink, borderWidth: 1, bottom: 12, height: 36, justifyContent: 'center', left: 12, width: 36 },
  colorLabel: { alignItems: 'center', backgroundColor: colors.black, borderRadius: 8, marginTop: 10, minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing[3] },
  colorLabelText: { color: colors.white, fontFamily: 'monospace', fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
  memoGroup: { marginTop: spacing[4] },
  memoLabel: { color: colors.ink, fontFamily: 'monospace', fontSize: 9, marginBottom: 6 },
  memoInput: { borderBottomColor: colors.ink, borderBottomWidth: 1, color: colors.ink, fontSize: 13, minHeight: 42, paddingHorizontal: 0, paddingVertical: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: spacing[3] },
  tag: { borderColor: colors.ink, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: colors.ink, fontFamily: 'monospace', fontSize: 9 },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: spacing[3] },
  actions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[4] },
  actionButton: { alignItems: 'center', borderColor: colors.ink, borderWidth: 2, flex: 1, minHeight: 54, justifyContent: 'center' },
  actionContent: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  againButton: { backgroundColor: colors.white },
  useButton: { backgroundColor: colors.black },
  againText: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  useText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  pressed: { opacity: 0.82, transform: [{ translateY: 2 }] },
  disabled: { opacity: 0.45 },
});
