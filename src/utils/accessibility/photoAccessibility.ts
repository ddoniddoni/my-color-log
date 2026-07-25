import type { AppLanguage } from '@/src/lib/localization/languagePreference';

type PhotoAccessibilityStatus = 'failed' | 'pending' | 'synced' | 'syncing';

type PhotoAccessibilityLabelInput = {
  caption?: string | null;
  colorName?: string;
  ownerName?: string;
  position: number;
  language?: AppLanguage;
  status?: PhotoAccessibilityStatus;
};

const statusLabels: Record<Exclude<PhotoAccessibilityStatus, 'synced'>, string> = {
  failed: '업로드 실패',
  pending: '업로드 대기',
  syncing: '동기화 중',
};

export function getPhotoAccessibilityLabel({ caption, colorName, language = 'ko', ownerName, position, status }: PhotoAccessibilityLabelInput): string {
  if (language === 'en') {
    const statusLabel = status && status !== 'synced'
      ? { failed: 'Upload failed', pending: 'Waiting to upload', syncing: 'Syncing' }[status]
      : null;
    return [
      `${ownerName ? `${ownerName}’s ` : ''}photo ${position}`,
      colorName ? `${colorName} color` : null,
      caption?.trim() ? `Note: ${caption.trim()}` : null,
      statusLabel,
    ].filter((part): part is string => part !== null).join(', ');
  }
  const labelParts = [
    `${ownerName ? `${ownerName}의 ` : ''}${position}번째 사진`,
    colorName ? `${colorName} 색` : null,
    caption?.trim() ? `메모 ${caption.trim()}` : null,
    status && status !== 'synced' ? statusLabels[status] : null,
  ];

  return labelParts.filter((part): part is string => part !== null).join(', ');
}
