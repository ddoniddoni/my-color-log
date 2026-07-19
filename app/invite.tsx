import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { FullScreenStatus } from '@/src/components/feedback/FullScreenStatus';
import { useSessionBootstrap } from '@/src/features/auth/hooks/useSessionBootstrap';
import { getInviteCodeFromParam } from '@/src/features/rooms/model/roomInviteLink';
import { useProfile } from '@/src/features/profile/hooks/useProfile';

export default function InviteScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const inviteCode = getInviteCodeFromParam(code);
  const sessionState = useSessionBootstrap();
  const userId = sessionState.status === 'ready' ? sessionState.session?.user.id : undefined;
  const profileQuery = useProfile(userId);

  if (!inviteCode) {
    return <FullScreenStatus title="초대 링크를 확인해 주세요" description="친구에게 새 초대 링크를 받아 다시 열어 주세요." actionLabel="친구방으로 가기" onAction={() => router.replace('/(tabs)/room')} />;
  }
  if (sessionState.status === 'loading') return <FullScreenStatus title="초대를 준비하고 있어요" description="계정을 확인하고 있어요." />;
  if (sessionState.status === 'error') return <FullScreenStatus title="초대를 열 수 없어요" description="연결 상태를 확인한 뒤 다시 시도해 주세요." actionLabel="다시 시도" onAction={sessionState.retry} />;
  if (!sessionState.session) return <Redirect href={{ pathname: '/(onboarding)/email', params: { inviteCode } }} />;
  if (profileQuery.isPending) return <FullScreenStatus title="초대를 준비하고 있어요" description="프로필을 확인하고 있어요." />;
  if (profileQuery.isError) return <FullScreenStatus title="초대를 열 수 없어요" description="연결되면 다시 시도할 수 있어요." actionLabel="다시 시도" onAction={() => void profileQuery.refetch()} />;
  if (!profileQuery.data?.isOnboarded) return <Redirect href={{ pathname: '/(onboarding)/nickname', params: { inviteCode } }} />;

  return <Redirect href={{ pathname: '/(tabs)/room', params: { inviteCode } }} />;
}
