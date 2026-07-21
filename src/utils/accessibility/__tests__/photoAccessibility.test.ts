import { getPhotoAccessibilityLabel } from '@/src/utils/accessibility/photoAccessibility';

describe('photo accessibility label', () => {
  it('announces position, color, caption, and upload status', () => {
    expect(getPhotoAccessibilityLabel({
      caption: '따뜻한 벽',
      colorName: '살구 오렌지',
      position: 2,
      status: 'syncing',
    })).toBe('2번째 사진, 살구 오렌지 색, 메모 따뜻한 벽, 동기화 중');
  });

  it('includes the owner and omits empty optional details', () => {
    expect(getPhotoAccessibilityLabel({
      caption: '   ',
      ownerName: 'ddoni',
      position: 1,
      status: 'synced',
    })).toBe('ddoni의 1번째 사진');
  });
});
