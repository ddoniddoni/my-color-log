import { Redirect } from 'expo-router';

import { FullScreenStatus } from '@/src/components/feedback/FullScreenStatus';
import { useSessionBootstrap } from '@/src/features/auth/hooks/useSessionBootstrap';
import { getStartupDestination } from '@/src/features/auth/model/startupRoute';
import { useProfile } from '@/src/features/profile/hooks/useProfile';

export default function StartupScreen() {
  const sessionState = useSessionBootstrap();
  const userId = sessionState.status === 'ready' ? sessionState.session?.user.id : undefined;
  const profileQuery = useProfile(userId);

  if (sessionState.status === 'loading') return <FullScreenStatus title="기록을 준비하고 있어요" description="안전하게 이전 상태를 확인하고 있어요." />;
  if (sessionState.status === 'error') return <FullScreenStatus title="시작할 수 없어요" description="연결 상태를 확인한 뒤 다시 시도해 주세요." actionLabel="다시 시도" onAction={sessionState.retry} />;
  if (!sessionState.session) return <Redirect href="/(onboarding)" />;
  if (profileQuery.isPending) return <FullScreenStatus title="기록을 준비하고 있어요" description="내 다이어리를 불러오고 있어요." />;
  if (profileQuery.isError) return <FullScreenStatus title="프로필을 불러올 수 없어요" description="연결되면 다시 시도할 수 있어요." actionLabel="다시 시도" onAction={() => void profileQuery.refetch()} />;

  return <Redirect href={getStartupDestination(true, profileQuery.data)} />;
}
