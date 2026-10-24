import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { spacing, type ThemeColors } from '@/src/design/tokens';
import { type RoomReportController } from '@/src/features/reports/hooks/useRoomReport';
import { reportDetailsLimit, roomReportReasons } from '@/src/features/reports/model/roomReport';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';

// Render inside the caller's existing modal: do not stack native iOS modals.
export function RoomReportForm({ report }: { report: RoomReportController }) {
  const { colors } = useAppTheme();
  const { t, format } = useAppLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!report.target) return null;

  if (report.receipt) {
    return <ScrollView contentContainerStyle={styles.success} style={styles.scroll}>
      <AppText accessibilityRole="header" accessibilityLiveRegion="polite" variant="title2">{report.receipt.alreadySubmitted ? '이미 접수한 신고예요' : '신고가 접수됐어요'}</AppText>
      <AppText color="secondary">접수 내용은 운영자가 확인할 수 있어요. 신고 내용은 다른 멤버에게 공개되지 않아요.</AppText>
      <Button label="확인" onPress={report.close} />
    </ScrollView>;
  }

  return <View style={styles.form}>
    <View style={styles.header}>
      <AppText accessibilityRole="header" style={styles.wrappingText} variant="title2">{report.target.kind === 'photo' ? '사진 신고' : '멤버 신고'}</AppText>
      <Pressable accessibilityLabel={t('신고 닫기')} accessibilityRole="button" accessibilityState={{ disabled: report.isPending }} disabled={report.isPending} onPress={report.close} style={styles.closeButton}><AppText localize={false} style={styles.closeText}>×</AppText></Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={styles.scroll}>
      <AppText color="secondary">신고 사유를 선택해 주세요. 신고 내용은 다른 멤버에게 공개되지 않아요.</AppText>
      <View accessibilityLabel={t('신고 사유')} accessibilityRole="radiogroup" style={styles.reasons}>
        {roomReportReasons.map((item) => <Pressable key={item.value} accessibilityLabel={t(item.label)} accessibilityRole="radio" accessibilityState={{ checked: report.reason === item.value, disabled: report.isPending }} disabled={report.isPending} onPress={() => report.setReason(item.value)} style={[styles.reason, report.reason === item.value && styles.selectedReason]}>
          <View style={[styles.radio, report.reason === item.value && styles.selectedRadio]}><AppText localize={false} style={styles.check}>{report.reason === item.value ? '✓' : ''}</AppText></View>
          <AppText style={styles.wrappingText}>{item.label}</AppText>
        </Pressable>)}
      </View>
      <AppText variant="bodyStrong">{report.reason === 'other' ? '상세 내용 · 필수' : '상세 내용 · 선택'}</AppText>
      <TextInput accessibilityLabel={t('신고 상세 내용')} editable={!report.isPending} maxLength={reportDetailsLimit * 2} multiline onChangeText={report.setDetails} placeholder={t('어떤 문제가 있었는지 알려 주세요.')} placeholderTextColor={colors.textTertiary} style={styles.input} textAlignVertical="top" value={report.details} />
      <AppText color="secondary" localize={false} style={styles.count}>{format('{count}/500자', { count: Array.from(report.details.trim()).length })}</AppText>
      <AppText color="secondary" style={styles.hint}>비밀번호나 연락처 등 민감한 정보는 적지 마세요.</AppText>
      {report.error ? <AppText accessibilityLiveRegion="polite" style={styles.error}>{report.error}</AppText> : null}
    </ScrollView>
    <View style={styles.footer}>
      {report.isPending ? <AppText accessibilityLiveRegion="polite" color="secondary">신고를 접수하고 있어요.</AppText> : null}
      <Button accessibilityState={{ busy: report.isPending }} disabled={report.isPending || report.reason === null} label={report.isPending ? '접수 중…' : '신고 등록'} onPress={() => { void report.submit(); }} />
    </View>
  </View>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    form: { flexShrink: 1 },
    header: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing[3], justifyContent: 'space-between', padding: spacing[4] },
    closeButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
    closeText: { fontSize: 28 },
    wrappingText: { flex: 1 },
    scroll: { flexShrink: 1 },
    content: { gap: spacing[3], padding: spacing[4] },
    reasons: { borderColor: colors.border, borderWidth: 1 },
    reason: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing[3], minHeight: 48, padding: spacing[3] },
    selectedReason: { backgroundColor: colors.surfaceMuted },
    radio: { alignItems: 'center', borderColor: colors.textSecondary, borderRadius: 12, borderWidth: 1, flexShrink: 0, height: 24, justifyContent: 'center', width: 24 },
    selectedRadio: { backgroundColor: colors.ink, borderColor: colors.ink },
    check: { color: colors.surface, fontSize: 14 },
    input: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, color: colors.ink, fontSize: 16, minHeight: 96, padding: spacing[3] },
    count: { fontSize: 12, textAlign: 'right' },
    hint: { fontSize: 12, lineHeight: 18 },
    error: { color: colors.danger },
    footer: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing[2], padding: spacing[4] },
    success: { gap: spacing[4], padding: spacing[6] },
  });
}
