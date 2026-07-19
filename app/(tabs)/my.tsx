import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { LoadingSkeleton } from '@/src/components/feedback/LoadingSkeleton';
import { Screen } from '@/src/components/layout/Screen';
import { AppText } from '@/src/components/ui/AppText';
import { deleteCurrentAccount } from '@/src/features/auth/api/accountRepository';
import { signOutCurrentSession } from '@/src/features/auth/api/authRepository';
import { AccountDeletionModal } from '@/src/features/auth/components/AccountDeletionModal';
import { useSessionBootstrap } from '@/src/features/auth/hooks/useSessionBootstrap';
import { MyProfileCanvas } from '@/src/features/profile/components/MyProfileCanvas';
import { ProfileNicknameModal } from '@/src/features/profile/components/ProfileNicknameModal';
import { useProfile } from '@/src/features/profile/hooks/useProfile';
import { useUpdateProfileNickname } from '@/src/features/profile/hooks/useUpdateProfileNickname';
import { useMyRooms } from '@/src/features/rooms/hooks/useActiveRoom';
import { spacing } from '@/src/design/tokens';

export default function MyScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sessionState = useSessionBootstrap();
  const userId = sessionState.status === 'ready' ? sessionState.session?.user.id : undefined;
  const profileQuery = useProfile(userId);
  const roomsQuery = useMyRooms(userId ?? null);
  const [isAccountDeletionVisible, setIsAccountDeletionVisible] = useState(false);
  const [isProfileEditVisible, setIsProfileEditVisible] = useState(false);
  const updateNicknameMutation = useUpdateProfileNickname(userId ?? '');
  const signOutMutation = useMutation({
    mutationFn: signOutCurrentSession,
    onError: () => Alert.alert('로그아웃하지 못했어요', '잠시 후 다시 시도해 주세요.'),
    onSuccess: () => {
      queryClient.clear();
      router.replace('/(onboarding)/email');
    },
  });
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('account_delete_failed');
      await deleteCurrentAccount(userId);
    },
    onError: () => Alert.alert('계정을 삭제하지 못했어요', '연결을 확인한 뒤 다시 시도해 주세요.'),
    onSuccess: () => {
      queryClient.clear();
      setIsAccountDeletionVisible(false);
      router.replace('/(onboarding)/email');
    },
  });

  if (sessionState.status === 'loading') return <MyLoadingScreen />;
  if (sessionState.status === 'error') return <MyProfileError onRetry={sessionState.retry} />;
  if (!sessionState.session) return <Redirect href="/(onboarding)/email" />;
  if (profileQuery.isPending) return <MyLoadingScreen />;
  if (profileQuery.isError) return <MyProfileError onRetry={() => void profileQuery.refetch()} />;
  if (!profileQuery.data) return <MyProfileError onRetry={() => void profileQuery.refetch()} />;

  const email = sessionState.session.user.email ?? '연결된 이메일 계정';

  return (
    <>
      <MyProfileCanvas
        deletingAccount={deleteAccountMutation.isPending}
        email={email}
        nickname={profileQuery.data.nickname}
        onDeleteAccountPress={() => setIsAccountDeletionVisible(true)}
        onNotificationsPress={showNotificationsNotice}
        onProfileEditPress={() => setIsProfileEditVisible(true)}
        onPrivacyPress={showPrivacyNotice}
        onRoomsPress={() => router.push('/(tabs)/room')}
        onSignOutPress={() => confirmSignOut(signOutMutation.mutate)}
        rooms={(roomsQuery.data ?? []).map((room) => ({ emoji: room.emoji, id: room.id, memberCount: room.members.length, name: room.name }))}
        roomsStatus={roomsQuery.isPending ? 'loading' : roomsQuery.isError ? 'error' : 'ready'}
        signingOut={signOutMutation.isPending}
      />
      <ProfileNicknameModal
        isSaving={updateNicknameMutation.isPending}
        nickname={profileQuery.data.nickname}
        onClose={() => setIsProfileEditVisible(false)}
        onSave={(nickname) => updateNicknameMutation.mutate(nickname, {
          onError: () => Alert.alert('닉네임을 저장하지 못했어요', '연결을 확인한 뒤 다시 시도해 주세요.'),
          onSuccess: () => setIsProfileEditVisible(false),
        })}
        visible={isProfileEditVisible}
      />
      <AccountDeletionModal
        isDeleting={deleteAccountMutation.isPending}
        onClose={() => setIsAccountDeletionVisible(false)}
        onConfirm={() => deleteAccountMutation.mutate()}
        visible={isAccountDeletionVisible}
      />
    </>
  );
}

function MyLoadingScreen() {
  return <Screen contentContainerStyle={styles.loading}><LoadingSkeleton style={styles.avatarSkeleton} /><LoadingSkeleton style={styles.nameSkeleton} /><LoadingSkeleton style={styles.cardSkeleton} /></Screen>;
}

function MyProfileError({ onRetry }: { onRetry: () => void }) {
  return <Screen contentContainerStyle={styles.error}><View style={styles.errorCopy}><AppText variant="title2">내 정보를 불러올 수 없어요</AppText><AppText color="secondary">연결되면 다시 시도할 수 있어요.</AppText></View><AppText accessibilityRole="button" onPress={onRetry} style={styles.retry}>다시 시도</AppText></Screen>;
}

function confirmSignOut(onConfirm: () => void): void {
  Alert.alert('로그아웃할까요?', '이 기기에서만 로그아웃돼요.', [
    { style: 'cancel', text: '취소' },
    { onPress: onConfirm, style: 'destructive', text: '로그아웃' },
  ]);
}

function showNotificationsNotice(): void {
  Alert.alert('알림 설정은 준비 중이에요', '알림 권한과 일일 알림 기능을 연결하고 있어요.');
}

function showPrivacyNotice(): void {
  Alert.alert('사진과 친구방', '내 사진은 기본적으로 비공개예요. 참여 중인 친구방에서만 같은 날짜의 개인 기록을 공유해 볼 수 있고, 방을 나가도 내 다이어리 사진은 그대로 유지돼요.');
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: spacing[4], justifyContent: 'center' },
  avatarSkeleton: { borderRadius: 999, height: 72, width: 72 },
  nameSkeleton: { height: 24, width: 116 },
  cardSkeleton: { height: 96, marginTop: spacing[6], width: '100%' },
  error: { gap: spacing[4], justifyContent: 'center' },
  errorCopy: { gap: spacing[2] },
  retry: { color: '#171714', fontSize: 16, fontWeight: '700', textDecorationLine: 'underline' },
});
