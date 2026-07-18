import { CameraView, type FlashMode, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { colors, spacing } from '@/src/design/tokens';
import { useSessionBootstrap } from '@/src/features/auth/hooks/useSessionBootstrap';
import { saveCapturedPhotoForReview } from '@/src/features/camera/api/localPhotoRepository';

export type CaptureContext = {
  missionId: string;
  dateKey: string;
  position: number;
  colorNameEn: string;
};

export function CameraCaptureScreen({ captureContext }: { captureContext: CaptureContext }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<FlashMode>('auto');
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sessionState = useSessionBootstrap();

  const refreshCameraPermission = useCallback((): void => {
    void getPermission().catch(() => undefined);
  }, [getPermission]);

  useEffect(() => {
    refreshCameraPermission();
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') refreshCameraPermission();
    });
    return () => subscription.remove();
  }, [refreshCameraPermission]);

  if (!permission) return <View style={styles.permissionBackdrop} />;
  if (!permission.granted) {
    const openPermission = async (): Promise<void> => {
      if (permission.canAskAgain) {
        await requestPermission();
        refreshCameraPermission();
        return;
      }

      await Linking.openSettings();
    };
    return <CameraPermissionPrompt canAskAgain={permission.canAskAgain} onCancel={() => router.back()} onOpen={() => void openPermission()} />;
  }

  const takePhoto = async (): Promise<void> => {
    if (!cameraRef.current || !isReady || isCapturing) return;
    if (sessionState.status !== 'ready' || !sessionState.session) {
      setErrorMessage('로그인 정보를 확인하지 못했어요. 오늘 화면에서 다시 시도해 주세요.');
      return;
    }
    setIsCapturing(true);
    setErrorMessage(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: false, exif: false, quality: 1, skipProcessing: false });
      const savedPhoto = await saveCapturedPhotoForReview({
        sourceUri: photo.uri,
        sourceWidth: photo.width,
        sourceHeight: photo.height,
        userId: sessionState.session.user.id,
        missionId: captureContext.missionId,
        dateKey: captureContext.dateKey,
        position: captureContext.position,
      });
      router.replace({
        pathname: '/photo-review',
        params: {
          photoId: savedPhoto.id,
          colorNameEn: captureContext.colorNameEn,
        },
      });
    } catch {
      setErrorMessage('사진을 찍지 못했어요. 잠시 후 다시 시도해 주세요.');
      setIsCapturing(false);
    }
  };

  return (
    <View style={styles.cameraPage}>
      <CameraView
        active
        animateShutter
        facing="back"
        flash={flash}
        mode="picture"
        onCameraReady={() => setIsReady(true)}
        onMountError={() => setErrorMessage('카메라를 시작하지 못했어요.')}
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.cameraTopBar, { paddingTop: Math.max(insets.top, spacing[3]) }]}>
        <CameraControl accessibilityLabel="카메라 닫기" onPress={() => router.back()}><CloseIcon /></CameraControl>
        <AppText style={styles.cameraTitle}>오늘의 색 · {captureContext.position}/9</AppText>
        <CameraControl accessibilityLabel={`플래시 ${flash}`} onPress={() => setFlash(getNextFlashMode(flash))}><FlashIcon mode={flash} /></CameraControl>
      </View>
      <View pointerEvents="none" style={styles.squareGuideArea}>
        <View accessibilityLabel="정사각형 사진 저장 가이드" style={styles.squareGuide}>
          <AppText style={styles.squareGuideLabel}>SQUARE FRAME · 정사각형으로 저장돼요</AppText>
        </View>
      </View>
      <View style={[styles.cameraBottomBar, { paddingBottom: Math.max(insets.bottom, spacing[6]) }]}>
        {errorMessage ? <AppText accessibilityLiveRegion="polite" style={styles.cameraError}>{errorMessage}</AppText> : null}
        <AppText style={styles.captureHint}>오늘 발견한 색을 프레임에 담아 보세요.</AppText>
        <Pressable
          accessibilityLabel="사진 촬영"
          accessibilityRole="button"
          accessibilityState={{ disabled: !isReady || isCapturing }}
          disabled={!isReady || isCapturing}
          onPress={() => void takePhoto()}
          style={({ pressed }) => [styles.shutterOuter, pressed && styles.shutterPressed, (!isReady || isCapturing) && styles.controlDisabled]}>
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
    </View>
  );
}

function CameraPermissionPrompt({ canAskAgain, onCancel, onOpen }: { canAskAgain: boolean; onCancel: () => void; onOpen: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.permissionBackdrop, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View pointerEvents="none" style={styles.permissionBackdropBlocks}>
        <View style={[styles.permissionBackdropBlock, styles.permissionBackdropBlockOne]} />
        <View style={[styles.permissionBackdropBlock, styles.permissionBackdropBlockTwo]} />
        <View style={[styles.permissionBackdropBlock, styles.permissionBackdropBlockThree]} />
        <View style={[styles.permissionBackdropBlock, styles.permissionBackdropBlockFour]} />
      </View>
      <View style={styles.permissionCardShadow} />
      <View accessibilityViewIsModal style={styles.permissionCard}>
        <View style={styles.permissionSketch}>
          <Rect fill="#F5F5F5" height={82} rotation={3} stroke={colors.ink} strokeWidth={1.5} width={72} x={20} y={20} />
          <Path d="M39 67 58 48m-13 22 20-20M39 51l5-5m15 17 5-5" fill="none" stroke={colors.ink} strokeLinecap="round" strokeWidth={4} />
          <Rect fill="#FFF" height={28} rx={4} rotation={12} stroke={colors.ink} strokeWidth={1.5} width={28} x={76} y={8} />
          <Path d="M87 18c5-4 9 1 5 5-3 2-3 3-3 5m-1 5h.1" fill="none" stroke={colors.ink} strokeLinecap="round" strokeWidth={1.5} />
        </View>
        <AppText style={styles.permissionTitle}>We need your eyes!</AppText>
        <AppText style={styles.permissionCopy}>Please allow camera access in settings to start logging colors. We use the lens to pick up the digital ink from the world around you.</AppText>
        <View style={styles.permissionDivider} />
        <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.permissionButton, pressed && styles.shutterPressed]}>
          <AppText style={styles.permissionButtonText}>{canAskAgain ? 'Allow Camera' : 'Open Settings'}</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={onCancel} style={styles.cancelButton}><AppText style={styles.cancelText}>Cancel</AppText></Pressable>
      </View>
    </View>
  );
}

function CameraControl({ accessibilityLabel, children, onPress }: { accessibilityLabel: string; children: React.ReactNode; onPress: () => void }) {
  return <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.cameraControl, pressed && styles.shutterPressed]}>{children}</Pressable>;
}

function CloseIcon() {
  return <Svg height={24} viewBox="0 0 24 24" width={24}><Path d="m6 6 12 12M18 6 6 18" stroke="#FFF" strokeLinecap="round" strokeWidth={2} /></Svg>;
}

function FlashIcon({ mode }: { mode: FlashMode }) {
  return <View style={styles.flashGroup}><Svg height={24} viewBox="0 0 24 24" width={24}><Path d="m13.4 2-7 11h5l-.8 9 7-12h-5L13.4 2Z" fill="none" stroke="#FFF" strokeLinejoin="round" strokeWidth={1.7} /></Svg><AppText style={styles.flashLabel}>{mode === 'auto' ? 'A' : mode === 'on' ? 'ON' : 'OFF'}</AppText></View>;
}

function getNextFlashMode(mode: FlashMode): FlashMode {
  if (mode === 'auto') return 'on';
  if (mode === 'on') return 'off';
  return 'auto';
}

const styles = StyleSheet.create({
  cameraPage: { backgroundColor: colors.black, flex: 1 },
  cameraTopBar: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.34)', flexDirection: 'row', justifyContent: 'space-between', left: 0, paddingBottom: spacing[3], paddingHorizontal: spacing[4], position: 'absolute', right: 0, top: 0 },
  squareGuideArea: { alignItems: 'center', bottom: 172, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 98 },
  squareGuide: { alignItems: 'flex-start', alignSelf: 'center', aspectRatio: 1, borderColor: 'rgba(255,255,255,0.92)', borderWidth: 2, justifyContent: 'flex-end', maxWidth: 420, padding: 10, width: '88%' },
  squareGuideLabel: { backgroundColor: 'rgba(0,0,0,0.56)', color: colors.white, fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.45, paddingHorizontal: 6, paddingVertical: 4 },
  cameraTitle: { color: colors.white, fontFamily: 'monospace', fontSize: 12, letterSpacing: 0.8 },
  cameraControl: { alignItems: 'center', height: 48, justifyContent: 'center', width: 48 },
  flashGroup: { alignItems: 'center' },
  flashLabel: { color: colors.white, fontSize: 8, fontWeight: '700', marginTop: -4 },
  cameraBottomBar: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', bottom: 0, gap: spacing[3], left: 0, paddingHorizontal: spacing[4], paddingTop: spacing[4], position: 'absolute', right: 0 },
  captureHint: { color: colors.white, fontSize: 12 },
  cameraError: { backgroundColor: 'rgba(0,0,0,0.72)', color: colors.white, fontSize: 12, padding: spacing[2] },
  shutterOuter: { alignItems: 'center', borderColor: colors.white, borderRadius: 39, borderWidth: 3, height: 78, justifyContent: 'center', width: 78 },
  shutterInner: { backgroundColor: colors.white, borderRadius: 31, height: 62, width: 62 },
  shutterPressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  controlDisabled: { opacity: 0.45 },
  permissionBackdrop: { alignItems: 'center', backgroundColor: '#A8A8A8', flex: 1, justifyContent: 'center', overflow: 'hidden', paddingHorizontal: 20 },
  permissionBackdropBlocks: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  permissionBackdropBlock: { backgroundColor: 'rgba(235,235,235,0.2)', position: 'absolute', top: 30 },
  permissionBackdropBlockOne: { height: 158, left: 29, transform: [{ rotate: '1.5deg' }], width: 34 },
  permissionBackdropBlockTwo: { height: 195, left: '32%', transform: [{ rotate: '-1deg' }], width: 38 },
  permissionBackdropBlockThree: { height: 170, right: '29%', transform: [{ rotate: '2deg' }], width: 33 },
  permissionBackdropBlockFour: { height: 204, right: 28, transform: [{ rotate: '-2deg' }], width: 37 },
  permissionCardShadow: { backgroundColor: colors.ink, height: 560, marginLeft: 4, marginTop: 5, maxWidth: 352, position: 'absolute', transform: [{ rotate: '-1deg' }], width: '100%' },
  permissionCard: { alignItems: 'center', backgroundColor: '#FAFAFA', borderColor: colors.ink, borderWidth: 2, minHeight: 560, maxWidth: 352, paddingBottom: spacing[5], paddingHorizontal: 38, paddingTop: spacing[5], transform: [{ rotate: '-1deg' }], width: '100%' },
  permissionSketch: { height: 144, marginTop: 2, width: 122 },
  permissionTitle: { color: colors.ink, fontSize: 17, fontStyle: 'italic', fontWeight: '700', marginTop: -1 },
  permissionCopy: { color: '#666', fontSize: 11, lineHeight: 16, marginTop: spacing[3], textAlign: 'center' },
  permissionDivider: { backgroundColor: '#BDBDBD', height: 1, marginTop: spacing[6], marginVertical: spacing[5], width: '100%' },
  permissionButton: { alignItems: 'center', backgroundColor: colors.black, minHeight: 64, justifyContent: 'center', width: '100%' },
  permissionButtonText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  cancelButton: { alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  cancelText: { color: colors.ink, fontSize: 12 },
});
