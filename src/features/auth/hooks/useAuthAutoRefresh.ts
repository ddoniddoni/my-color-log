import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { getSupabaseClient } from '@/src/lib/supabase/client';

export function useAuthAutoRefresh(): void {
  useEffect(() => {
    const supabase = getSupabaseClient();
    const setRefreshState = (status: AppStateStatus): void => {
      if (status === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };

    setRefreshState(AppState.currentState);
    const subscription = AppState.addEventListener('change', setRefreshState);
    return () => subscription.remove();
  }, []);
}
