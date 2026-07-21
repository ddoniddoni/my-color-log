type PhotoAccessibilityStatus = 'failed' | 'synced' | 'syncing';

type PhotoAccessibilityLabelInput = {
  caption?: string | null;
  colorName?: string;
  ownerName?: string;
  position: number;
  status?: PhotoAccessibilityStatus;
};

const statusLabels: Record<Exclude<PhotoAccessibilityStatus, 'synced'>, string> = {
  failed: '업로드 실패',
  syncing: '동기화 중',
};

export function getPhotoAccessibilityLabel({ caption, colorName, ownerName, position, status }: PhotoAccessibilityLabelInput): string {
  const labelParts = [
    `${ownerName ? `${ownerName}의 ` : ''}${position}번째 사진`,
    colorName ? `${colorName} 색` : null,
    caption?.trim() ? `메모 ${caption.trim()}` : null,
    status && status !== 'synced' ? statusLabels[status] : null,
  ];

  return labelParts.filter((part): part is string => part !== null).join(', ');
}
