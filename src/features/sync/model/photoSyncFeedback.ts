import { type NetworkStatus } from '@/src/features/sync/model/networkStatus';
import type { AppLanguage } from '@/src/lib/localization/languagePreference';

type PhotoSyncFeedbackInput = {
  isSyncing: boolean;
  networkStatus: NetworkStatus;
  pendingPhotoCount: number;
  totalPhotoCount: number;
  language?: AppLanguage;
};

export function getPhotoSyncFeedback({ isSyncing, language = 'ko', networkStatus, pendingPhotoCount, totalPhotoCount }: PhotoSyncFeedbackInput): string {
  if (language === 'en') {
    if (pendingPhotoCount > 0 && networkStatus === 'offline') {
      return `You’re offline. ${pendingPhotoCount} photos are saved on this device and will upload automatically when you reconnect.`;
    }
    if (pendingPhotoCount > 0 && networkStatus === 'unknown') {
      return `${pendingPhotoCount} photos are safely stored on this device while we check your connection.`;
    }
    if (isSyncing) {
      return `Your photos are on this device. Safely uploading ${Math.max(1, pendingPhotoCount)} now.`;
    }
    if (totalPhotoCount === 0) return 'Your discovered color is safely kept on this device first.';
    return `You collected ${totalPhotoCount}/9 photos today. Long-press a photo to change its order.`;
  }
  if (pendingPhotoCount > 0 && networkStatus === 'offline') {
    return `오프라인이에요. 사진 ${pendingPhotoCount}장을 기기에 보관했어요. 연결되면 자동으로 올릴게요.`;
  }

  if (pendingPhotoCount > 0 && networkStatus === 'unknown') {
    return `사진 ${pendingPhotoCount}장을 기기에 안전하게 보관했어요. 연결을 확인하고 있어요.`;
  }

  if (isSyncing) {
    return `사진은 기기에 보관됐어요. ${Math.max(1, pendingPhotoCount)}장을 안전하게 올리는 중이에요.`;
  }

  if (totalPhotoCount === 0) return '발견한 색은 먼저 기기에 안전하게 보관해요.';
  return `${totalPhotoCount}/9장의 오늘을 모았어요. 사진을 길게 눌러 순서를 바꿀 수 있어요.`;
}
