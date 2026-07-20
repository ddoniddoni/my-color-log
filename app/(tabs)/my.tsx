import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { LoadingSkeleton } from '@/src/components/feedback/LoadingSkeleton';
import { Screen } from '@/src/components/layout/Screen';
import { AppConfirmationDialog } from '@/src/components/ui/AppConfirmationDialog';
import { AppText } from '@/src/components/ui/AppText';
import { deleteCurrentAccount } from '@/src/features/auth/api/accountRepository';
import { signOutCurrentSession } from '@/src/features/auth/api/authRepository';
import { AccountDeletionModal } from '@/src/features/auth/components/AccountDeletionModal';
import { useSessionBootstrap } from '@/src/features/auth/hooks/useSessionBootstrap';
import { NotificationSettingsModal } from '@/src/features/notifications/components/NotificationSettingsModal';
import { syncRoomPhotoPushNotifications } from '@/src/features/notifications/api/roomPushNotificationRepository';
import { useNotificationSettings } from '@/src/features/notifications/hooks/useNotificationSettings';
import { MyProfileCanvas } from '@/src/features/profile/components/MyProfileCanvas';
import { ProfileNicknameModal } from '@/src/features/profile/components/ProfileNicknameModal';
import { useProfile } from '@/src/features/profile/hooks/useProfile';
import { useUpdateProfileNickname } from '@/src/features/profile/hooks/useUpdateProfileNickname';
import { useMyRooms } from '@/src/features/rooms/hooks/useActiveRoom';
import { spacing } from '@/src/design/tokens';

type MyDialog =
  | { description: string; kind: 'notice'; title: string }
  | { kind: 'sign_out_confirmation' };

export default function MyScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sessionState = useSessionBootstrap();
  const userId = sessionState.status === 'ready' ? sessionState.session?.user.id : undefined;
  const profileQuery = useProfile(userId);
  const roomsQuery = useMyRooms(userId ?? null);
  const [isAccountDeletionVisible, setIsAccountDeletionVisible] = useState(false);
  const [isNotificationSettingsVisible, setIsNotificationSettingsVisible] = useState(false);
  const [isProfileEditVisible, setIsProfileEditVisible] = useState(false);
  const [dialog, setDialog] = useState<MyDialog | null>(null);
  const updateNicknameMutation = useUpdateProfileNickname(userId ?? '');
  const notificationSettings = useNotificationSettings();
  const showNotice = (title: string, description: string): void => setDialog({ description, kind: 'notice', title });
  const signOutMutation = useMutation({
    mutationFn: signOutCurrentSession,
    onError: () => showNotice('로그아웃하지 못했어요', '잠시 후 다시 시도해 주세요.'),
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
    onError: () => showNotice('계정을 삭제하지 못했어요', '연결을 확인한 뒤 다시 시도해 주세요.'),
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
        onNotificationsPress={() => setIsNotificationSettingsVisible(true)}
        onProfileEditPress={() => setIsProfileEditVisible(true)}
        onPrivacyPress={() => showNotice('사진과 친구방', '내 사진은 기본적으로 비공개예요. 참여 중인 친구방에서만 같은 날짜의 개인 기록을 공유해 볼 수 있고, 방을 나가도 내 다이어리 사진은 그대로 유지돼요.')}
        onRoomsPress={() => router.push('/(tabs)/room')}
        onSignOutPress={() => setDialog({ kind: 'sign_out_confirmation' })}
        rooms={(roomsQuery.data ?? []).map((room) => ({ emoji: room.emoji, id: room.id, memberCount: room.members.length, name: room.name }))}
        roomsStatus={roomsQuery.isPending ? 'loading' : roomsQuery.isError ? 'error' : 'ready'}
        signingOut={signOutMutation.isPending}
      />
      <ProfileNicknameModal
        isSaving={updateNicknameMutation.isPending}
        nickname={profileQuery.data.nickname}
        onClose={() => setIsProfileEditVisible(false)}
        onSave={(nickname) => updateNicknameMutation.mutate(nickname, {
          onError: () => showNotice('닉네임을 저장하지 못했어요', '연결을 확인한 뒤 다시 시도해 주세요.'),
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
      <NotificationSettingsModal
        isLoading={notificationSettings.isLoading}
        isSaving={notificationSettings.isSaving}
        onClose={() => setIsNotificationSettingsVisible(false)}
        onSave={async (settings) => {
          try {
            const result = await notificationSettings.save(settings);
            if (result === 'saved') {
              try {
                const pushResult = await syncRoomPhotoPushNotifications(settings.roomPhotoPushEnabled);
                if (pushResult === 'project_id_missing') {
                  showNotice('친구방 푸시 준비 중', '친구방 사진 알림은 EAS 프로젝트 연결과 development build 설치 후 사용할 수 있어요. 아침·저녁 알림 설정은 저장됐어요.');
                } else if (pushResult === 'unavailable') {
                  showNotice('앱 업데이트가 필요해요', '친구방 사진 알림을 사용하려면 최신 development build를 다시 설치해 주세요.');
                } else if (pushResult === 'permission_denied') {
                  showNotice('알림 권한이 필요해요', '기기 설정에서 Color Log의 알림을 허용한 뒤 다시 켜 주세요.');
                }
              } catch {
                showNotice('친구방 알림을 연결하지 못했어요', '알림 설정은 저장됐어요. 잠시 뒤 앱을 다시 열면 한 번 더 연결할게요.');
              }
              return true;
            }
            if (result === 'unavailable') {
              showNotice('앱 업데이트가 필요해요', '알림 기능을 사용하려면 최신 development build를 다시 설치해 주세요.');
              return false;
            }
            showNotice('알림 권한이 필요해요', '기기 설정에서 Color Log의 알림을 허용한 뒤 다시 켜 주세요.');
            return false;
          } catch {
            showNotice('알림을 저장하지 못했어요', '잠시 뒤 다시 시도해 주세요.');
            return false;
          }
        }}
        settings={notificationSettings.settings}
        visible={isNotificationSettingsVisible}
      />
      <AppConfirmationDialog
        cancelLabel={dialog?.kind === 'sign_out_confirmation' ? '취소' : undefined}
        confirmLabel={dialog?.kind === 'sign_out_confirmation' ? '로그아웃' : '확인'}
        description={dialog?.kind === 'sign_out_confirmation' ? '이 기기에서만 로그아웃돼요.' : dialog?.kind === 'notice' ? dialog.description : ''}
        isBusy={signOutMutation.isPending}
        onClose={() => setDialog(null)}
        onConfirm={dialog?.kind === 'sign_out_confirmation' ? () => signOutMutation.mutate() : () => setDialog(null)}
        title={dialog?.kind === 'sign_out_confirmation' ? '로그아웃할까요?' : dialog?.kind === 'notice' ? dialog.title : ''}
        tone={dialog?.kind === 'sign_out_confirmation' ? 'destructive' : 'default'}
        visible={dialog !== null}
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

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: spacing[4], justifyContent: 'center' },
  avatarSkeleton: { borderRadius: 999, height: 72, width: 72 },
  nameSkeleton: { height: 24, width: 116 },
  cardSkeleton: { height: 96, marginTop: spacing[6], width: '100%' },
  error: { gap: spacing[4], justifyContent: 'center' },
  errorCopy: { gap: spacing[2] },
  retry: { color: '#171714', fontSize: 16, fontWeight: '700', textDecorationLine: 'underline' },
});
