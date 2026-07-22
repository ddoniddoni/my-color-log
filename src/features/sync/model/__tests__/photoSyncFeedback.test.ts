import { getPhotoSyncFeedback } from '@/src/features/sync/model/photoSyncFeedback';

describe('photo sync feedback', () => {
  it('explains that photos are safely waiting on the device while offline', () => {
    expect(getPhotoSyncFeedback({
      isSyncing: false,
      networkStatus: 'offline',
      pendingPhotoCount: 2,
      totalPhotoCount: 2,
    })).toBe('오프라인이에요. 사진 2장을 기기에 보관했어요. 연결되면 자동으로 올릴게요.');
  });

  it('announces the active automatic upload after reconnection', () => {
    expect(getPhotoSyncFeedback({
      isSyncing: true,
      networkStatus: 'online',
      pendingPhotoCount: 1,
      totalPhotoCount: 1,
    })).toBe('사진은 기기에 보관됐어요. 1장을 안전하게 올리는 중이에요.');
  });
});
