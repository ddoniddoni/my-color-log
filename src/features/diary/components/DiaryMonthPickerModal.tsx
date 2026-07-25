import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppModal } from '@/src/components/ui/AppModal';
import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { spacing, type ThemeColors } from '@/src/design/tokens';
import { moveYear, type MonthCursor } from '@/src/features/diary/model/calendar';
import { formatMonthLabel } from '@/src/lib/localization/dateFormat';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';

type DiaryMonthPickerModalProps = {
  cursor: MonthCursor;
  onClose: () => void;
  onSelect: (cursor: MonthCursor) => void;
  visible: boolean;
};

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export function DiaryMonthPickerModal({ cursor, onClose, onSelect, visible }: DiaryMonthPickerModalProps) {
  const { language, t } = useAppLanguage();
  const styles = useDiaryMonthPickerStyles();
  const [pickerYear, setPickerYear] = useState(cursor.year);

  return (
    <AppModal accessibilityLabel={t('연도와 월 선택 닫기')} contentStyle={styles.card} onClose={onClose} visible={visible}>
      <View style={styles.header}>
        <AppText accessibilityRole="header" style={styles.title}>연도와 월 선택</AppText>
        <Pressable accessibilityLabel={t('연도와 월 선택 닫기')} accessibilityRole="button" hitSlop={8} onPress={onClose} style={styles.closeButton}>
          <CloseIcon />
        </Pressable>
      </View>

      <View style={styles.yearControls}>
        <Pressable accessibilityLabel={t('이전 연도 보기')} accessibilityRole="button" hitSlop={8} onPress={() => setPickerYear((year) => moveYear(year, -1))} style={({ pressed }) => [styles.yearControl, pressed && styles.yearControlPressed]}>
          <ChevronIcon direction="left" />
        </Pressable>
        <AppText localize={false} style={styles.yearText}>{pickerYear}</AppText>
        <Pressable accessibilityLabel={t('다음 연도 보기')} accessibilityRole="button" hitSlop={8} onPress={() => setPickerYear((year) => moveYear(year, 1))} style={({ pressed }) => [styles.yearControl, pressed && styles.yearControlPressed]}>
          <ChevronIcon direction="right" />
        </Pressable>
      </View>

      <View style={styles.monthGrid}>
        {MONTHS.map((month) => {
          const selected = cursor.year === pickerYear && cursor.month === month;
          const label = formatMonthLabel(pickerYear, month, language);
          return (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={month}
              onPress={() => onSelect({ month, year: pickerYear })}
              style={({ pressed }) => [styles.monthButton, selected && styles.monthButtonSelected, pressed && styles.monthButtonPressed]}>
              <AppText localize={false} style={[styles.monthText, selected && styles.monthTextSelected]}>{language === 'ko' ? `${month}월` : label.split(' ')[0]}</AppText>
            </Pressable>
          );
        })}
      </View>
    </AppModal>
  );
}

function CloseIcon() {
  const { colors } = useAppTheme();
  return <Svg height={22} viewBox="0 0 24 24" width={22}><Path d="m6 6 12 12M18 6 6 18" fill="none" stroke={colors.ink} strokeLinecap="round" strokeWidth={1.8} /></Svg>;
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  const { colors } = useAppTheme();
  const path = direction === 'left' ? 'm14.5 5-6 7 6 7' : 'm9.5 5 6 7-6 7';
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d={path} fill="none" stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></Svg>;
}

function useDiaryMonthPickerStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: { gap: spacing[5], padding: spacing[5] },
    header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    title: { color: colors.ink, fontSize: 21, fontWeight: '800', letterSpacing: -0.55, lineHeight: 28 },
    closeButton: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1.5, height: 44, justifyContent: 'center', width: 44 },
    yearControls: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    yearControl: { alignItems: 'center', borderColor: colors.ink, borderWidth: 1.5, height: 44, justifyContent: 'center', width: 44 },
    yearControlPressed: { backgroundColor: colors.surfaceMuted, transform: [{ scale: 0.94 }] },
    yearText: { color: colors.ink, fontFamily: 'monospace', fontSize: 22, fontWeight: '700', lineHeight: 28 },
    monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
    monthButton: { alignItems: 'center', borderColor: colors.borderStrong, borderWidth: 1, height: 48, justifyContent: 'center', width: '30.74%' },
    monthButtonSelected: { backgroundColor: colors.ink, borderColor: colors.ink, borderWidth: 1.5 },
    monthButtonPressed: { opacity: 0.72 },
    monthText: { color: colors.ink, fontFamily: 'monospace', fontSize: 13, fontWeight: '700', lineHeight: 17 },
    monthTextSelected: { color: colors.surface },
  });
}
