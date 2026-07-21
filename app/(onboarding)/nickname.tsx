import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { getStoredSession } from '@/src/features/auth/api/authRepository';
import { completeProfile } from '@/src/features/profile/api/profileRepository';
import { validateNickname } from '@/src/features/profile/model/profile';
import { getInviteCodeFromParam } from '@/src/features/rooms/model/roomInviteLink';
import { queryKeys } from '@/src/lib/query/queryKeys';
import { getDeviceTimeZone } from '@/src/lib/localization/deviceTimeZone';

export default function NicknameScreen() {
  const [nickname, setNickname] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { inviteCode: inviteCodeParam } = useLocalSearchParams<{ inviteCode?: string | string[] }>();
  const inviteCode = getInviteCodeFromParam(inviteCodeParam);
  const queryClient = useQueryClient();
  const validation = validateNickname(nickname);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!validation.isValid) throw new Error('invalid_nickname');
      const session = await getStoredSession();
      if (!session?.user) throw new Error('missing_authenticated_session');
      return completeProfile(session.user.id, validation.value, getDeviceTimeZone());
    },
    onSuccess: async (profile) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile(profile.id) });
      if (inviteCode) {
        router.replace({ pathname: '/(tabs)/room', params: { inviteCode } });
        return;
      }
      router.replace('/(tabs)');
    },
  });

  const handleSubmit = (): void => {
    setHasSubmitted(true);
    if (validation.isValid) mutation.mutate();
  };
  const showValidation = hasSubmitted && !validation.isValid;
  const bodyFont = fontsLoaded ? 'BricolageGrotesque_400Regular' : undefined;
  const boldFont = fontsLoaded ? 'BricolageGrotesque_700Bold' : undefined;
  const heavyFont = fontsLoaded ? 'BricolageGrotesque_800ExtraBold' : undefined;

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', default: undefined })} style={styles.flex}>
      <View style={styles.page}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
          <AppText style={[styles.wordmark, { fontFamily: heavyFont }]}>Oneul-Bit</AppText>
          <View style={styles.memberBadge}>
            <AppText style={[styles.memberText, { fontFamily: bodyFont }]}>New Member</AppText>
            <View style={styles.memberAvatar}><FaceIcon /></View>
          </View>
        </View>

        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <SketchAvatar />

            <View style={styles.copy}>
              <AppText style={[styles.title, { fontFamily: boldFont }]}>What&apos;s your name?</AppText>
              <View pointerEvents="none" style={styles.titleMarker} />
              <AppText style={[styles.description, { fontFamily: bodyFont }]}>This is how you&apos;ll appear in your journal.</AppText>
            </View>

            <View style={styles.nicknameField}>
              <TextInput
                accessibilityLabel="닉네임"
                autoCapitalize="none"
                maxLength={12}
                onChangeText={setNickname}
                onSubmitEditing={handleSubmit}
                placeholder="Type here..."
                placeholderTextColor="#555555"
                returnKeyType="done"
                style={[styles.input, { fontFamily: boldFont, textAlign: 'center' }, showValidation && styles.inputError]}
                value={nickname}
              />
              <View style={styles.markerTrack}>
                <View style={[styles.markerProgress, { width: `${Math.round((nickname.trim().length / 12) * 100)}%` }]} />
              </View>
              <View pointerEvents="none" style={styles.fieldStar}><StarIcon /></View>
            </View>

            <View style={[styles.counter, showValidation && styles.counterError]}>
              <AppText style={styles.counterText}>{nickname.trim().length} / 12</AppText>
            </View>
            {showValidation ? <AppText accessibilityLiveRegion="polite" style={styles.validationText}>{validation.message}</AppText> : null}
            {mutation.isError && hasSubmitted ? <AppText accessibilityLiveRegion="polite" style={styles.validationText}>연결을 확인한 뒤 다시 시도해 주세요.</AppText> : null}

            <View style={styles.actions}>
              <Pressable
                accessibilityLabel="닉네임으로 시작하기"
                accessibilityRole="button"
                accessibilityState={{ busy: mutation.isPending, disabled: mutation.isPending }}
                disabled={mutation.isPending}
                onPress={handleSubmit}
                style={({ pressed }) => [styles.startButton, mutation.isPending && styles.startButtonDisabled, pressed && !mutation.isPending && styles.startButtonPressed]}
              >
                <AppText style={[styles.startText, { fontFamily: boldFont }]}>{mutation.isPending ? 'Starting…' : 'Start'}</AppText>
                <View pointerEvents="none" style={styles.buttonStar}><StarIcon /></View>
              </Pressable>
              <AppText style={[styles.laterText, { fontFamily: bodyFont }]}>I&apos;ll do this later</AppText>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function SketchAvatar() {
  return (
    <View accessible accessibilityLabel="프로필 그림" accessibilityRole="image" style={styles.avatarGroup}>
      <View pointerEvents="none" style={styles.avatarScribble}><AvatarScribble /></View>
      <View style={styles.avatar}>
        <View style={styles.eyes}><View style={styles.eye} /><View style={styles.eye} /></View>
        <View style={styles.smile} />
        <View style={styles.avatarPencil}><PenIcon /></View>
      </View>
    </View>
  );
}

function FaceIcon() {
  return <Svg height={18} viewBox="0 0 24 24" width={18}><Circle cx={12} cy={12} fill="none" r={8} stroke="#1B1C1A" strokeWidth={1.5} /><Circle cx={9} cy={10} fill="#1B1C1A" r={1} /><Circle cx={15} cy={10} fill="#1B1C1A" r={1} /><Path d="M8.5 14c1 1.5 2.2 2.2 3.5 2.2s2.5-.7 3.5-2.2" fill="none" stroke="#1B1C1A" strokeLinecap="round" strokeWidth={1.5} /></Svg>;
}

function PenIcon() {
  return <Svg height={17} viewBox="0 0 24 24" width={17}><Path d="m5 19 2.2-.6L18.5 7.1 16.9 5.5 5.6 16.8 5 19Zm12.7-13.5 1.1-1.1a1.1 1.1 0 0 1 1.6 1.6l-1.1 1.1-1.6-1.6Z" fill="none" stroke="#1B1C1A" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} /></Svg>;
}

function StarIcon() {
  return <Svg height={28} viewBox="0 0 24 24" width={28}><Path d="m12 3 2.1 5.9L20 9l-4.8 3.7 1.6 5.9-4.8-3.5-4.8 3.5 1.6-5.9L4 9l5.9-.1L12 3Z" fill="none" stroke="#1B1C1A" strokeLinejoin="round" strokeWidth={1.5} /></Svg>;
}

function AvatarScribble() {
  return <Svg height={180} viewBox="0 0 100 100" width={180}><Path d="M10 50Q25 10 50 50t40 0M20 60q20 30 60 0" fill="none" stroke="#1B1C1A" strokeWidth={1.5} /></Svg>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { backgroundColor: '#FAF9F5', flex: 1 },
  header: { alignItems: 'center', backgroundColor: '#FAF9F5', borderBottomColor: '#1B1C1A', borderBottomWidth: 3, boxShadow: '4px 4px 0px #1B1C1A', flexDirection: 'row', justifyContent: 'space-between', minHeight: 42, paddingBottom: 8, paddingHorizontal: 16 },
  wordmark: { color: '#1B1C1A', fontSize: 24, fontWeight: '800', letterSpacing: -0.9, lineHeight: 29, transform: [{ rotate: '-2deg' }] },
  memberBadge: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  memberText: { color: '#5D3F3B', fontSize: 9, fontStyle: 'italic', lineHeight: 12 },
  memberAvatar: { alignItems: 'center', borderColor: '#1B1C1A', borderRadius: 16, borderWidth: 1.5, height: 32, justifyContent: 'center', width: 32 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingTop: 40 },
  content: { alignItems: 'center', gap: 40, maxWidth: 448, width: '100%' },
  avatarGroup: { height: 166, position: 'relative', width: 166 },
  avatarScribble: { left: -20, opacity: 0.18, position: 'absolute', top: -20 },
  avatar: { alignItems: 'center', backgroundColor: '#FAF9F5', borderColor: '#1B1C1A', borderRadius: 80, borderWidth: 2.5, boxShadow: '6px 6px 0px #1B1C1A', height: 160, justifyContent: 'center', position: 'absolute', width: 160 },
  eyes: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  eye: { backgroundColor: '#1B1C1A', borderRadius: 7, height: 14, width: 14 },
  smile: { borderBottomColor: '#1B1C1A', borderBottomWidth: 3, borderRadius: 28, height: 28, width: 56 },
  avatarPencil: { alignItems: 'center', backgroundColor: '#FAF9F5', borderColor: '#1B1C1A', borderRadius: 16, borderWidth: 2, bottom: 8, height: 32, justifyContent: 'center', position: 'absolute', right: 8, transform: [{ rotate: '-12deg' }], width: 32 },
  copy: { alignItems: 'center', position: 'relative' },
  title: { color: '#1B1C1A', fontSize: 28, fontWeight: '700', lineHeight: 34, textAlign: 'center', transform: [{ rotate: '1deg' }] },
  titleMarker: { backgroundColor: '#1B1C1A', borderRadius: 4, bottom: 20, height: 4, opacity: 0.1, position: 'absolute', width: 192, zIndex: -1 },
  description: { color: '#5D3F3B', fontSize: 16, fontStyle: 'italic', lineHeight: 24, marginTop: 8, textAlign: 'center' },
  nicknameField: { position: 'relative', width: '100%' },
  input: { alignSelf: 'stretch', color: '#1B1C1A', fontSize: 22, fontWeight: '700', minHeight: 52, paddingHorizontal: 16, textAlign: 'center', textAlignVertical: 'center', width: '100%' },
  inputError: { color: '#B74747' },
  markerTrack: { backgroundColor: '#1B1C1A', height: 1.5, opacity: 0.7, width: '100%' },
  markerProgress: { backgroundColor: '#1B1C1A', height: '100%' },
  fieldStar: { opacity: 0.3, position: 'absolute', right: -34, top: 6, transform: [{ rotate: '-12deg' }] },
  counter: { backgroundColor: '#FAF9F5', borderColor: '#1B1C1A', borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 4, transform: [{ rotate: '1deg' }] },
  counterError: { borderColor: '#B74747' },
  counterText: { color: '#5D3F3B', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 10, lineHeight: 12 },
  validationText: { color: '#B74747', fontSize: 12, lineHeight: 17, marginTop: -24, textAlign: 'center' },
  actions: { alignItems: 'center', gap: 24 },
  startButton: { alignItems: 'center', backgroundColor: '#FAF9F5', borderColor: '#1B1C1A', borderWidth: 3, boxShadow: '8px 8px 0px #1B1C1A', justifyContent: 'center', minHeight: 56, minWidth: 130, paddingHorizontal: 48, position: 'relative', transform: [{ rotate: '-0.8deg' }] },
  startButtonPressed: { boxShadow: '1px 1px 0px #1B1C1A', transform: [{ translateX: 3 }, { translateY: 3 }] },
  startButtonDisabled: { opacity: 0.55 },
  startText: { color: '#1B1C1A', fontSize: 18, fontWeight: '700', lineHeight: 24 },
  buttonStar: { position: 'absolute', right: -22, top: -19, transform: [{ rotate: '12deg' }] },
  laterText: { color: '#5D3F3B', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 10, lineHeight: 13, textDecorationLine: 'underline', textDecorationStyle: 'dashed' },
});
