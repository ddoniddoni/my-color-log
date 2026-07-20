export type TodayJournalLayout = {
  horizontalPadding: number;
  isCompact: boolean;
  mosaicSize: number;
};

type TodayJournalLayoutInput = {
  contentHeight: number;
  contentWidth: number;
};

const COMPACT_CONTENT_HEIGHT = 600;
const COMPACT_RESERVED_HEIGHT = 224;
const STANDARD_RESERVED_HEIGHT = 320;

export function getTodayJournalLayout({ contentHeight, contentWidth }: TodayJournalLayoutInput): TodayJournalLayout {
  const horizontalPadding = contentWidth < 360 ? 16 : 20;
  const isCompact = contentHeight < COMPACT_CONTENT_HEIGHT;
  const maxWidth = Math.max(0, contentWidth - (horizontalPadding * 2));
  const reservedHeight = isCompact ? COMPACT_RESERVED_HEIGHT : STANDARD_RESERVED_HEIGHT;
  const mosaicSize = Math.max(0, Math.min(maxWidth, contentHeight - reservedHeight));

  return { horizontalPadding, isCompact, mosaicSize };
}
