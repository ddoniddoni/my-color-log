import { Pressable, StyleSheet, View } from 'react-native';

import { AppModal } from '@/src/components/ui/AppModal';
import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { radius, spacing } from '@/src/design/tokens';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';
import { type AppLanguage } from '@/src/lib/localization/languagePreference';

type LanguageSettingsModalProps = {
  isSaving: boolean;
  onClose: () => void;
  onSelect: (language: AppLanguage) => void;
  visible: boolean;
};

const options: readonly AppLanguage[] = ['ko', 'en'];

export function LanguageSettingsModal({ isSaving, onClose, onSelect, visible }: LanguageSettingsModalProps) {
  const theme = useAppTheme();
  const { language, t } = useAppLanguage();

  return (
    <AppModal accessibilityLabel={t('언어 설정 닫기')} contentStyle={styles.card} isBusy={isSaving} onClose={onClose} visible={visible}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <AppText style={[styles.eyebrow, { color: theme.colors.textSecondary }]}>언어</AppText>
          <AppText accessibilityRole="header" style={[styles.title, { color: theme.colors.ink }]}>언어</AppText>
          <AppText style={[styles.description, { color: theme.colors.textSecondary }]}>Color Log에 표시할 언어를 선택해 주세요.</AppText>
        </View>
        <Pressable accessibilityLabel={t('언어 설정 닫기')} accessibilityRole="button" accessibilityState={{ disabled: isSaving }} disabled={isSaving} onPress={onClose} style={[styles.closeButton, { borderColor: theme.colors.ink }]}>
          <AppText style={[styles.closeText, { color: theme.colors.ink }]}>×</AppText>
        </Pressable>
      </View>

      <View accessibilityRole="radiogroup" style={styles.options}>
        {options.map((option) => {
          const selected = language === option;
          const title = option === 'ko' ? '한국어' : 'English';
          const description = option === 'ko' ? '한국어로 표시해요.' : '영어로 표시해요.';
          return (
            <Pressable
              accessibilityLabel={title}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: isSaving }}
              disabled={isSaving}
              key={option}
              onPress={() => onSelect(option)}
              style={[
                styles.option,
                { backgroundColor: selected ? theme.colors.surfaceMuted : theme.colors.surface, borderColor: selected ? theme.colors.ink : theme.colors.borderStrong },
                selected && styles.optionSelected,
              ]}>
              <View style={styles.optionCopy}>
                <AppText localize={false} style={[styles.optionTitle, { color: theme.colors.ink }]}>{title}</AppText>
                <AppText style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>{description}</AppText>
              </View>
              <View style={[styles.radio, { borderColor: theme.colors.ink }, selected && { backgroundColor: theme.colors.ink }]}>
                {selected ? <View style={[styles.radioDot, { backgroundColor: theme.colors.surface }]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[4], padding: spacing[5] },
  header: { flexDirection: 'row', gap: spacing[3], justifyContent: 'space-between' },
  copy: { flex: 1, gap: spacing[1] },
  eyebrow: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.8, lineHeight: 14 },
  title: { fontSize: 22, fontWeight: '800', lineHeight: 29 },
  description: { fontSize: 13, lineHeight: 19 },
  closeButton: { alignItems: 'center', borderWidth: 1.5, height: 40, justifyContent: 'center', width: 40 },
  closeText: { fontSize: 26, fontWeight: '300', lineHeight: 29 },
  options: { gap: spacing[2] },
  option: { alignItems: 'center', borderRadius: radius.sm, borderWidth: 1.5, flexDirection: 'row', gap: spacing[3], justifyContent: 'space-between', minHeight: 70, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  optionSelected: { borderWidth: 2 },
  optionCopy: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 15, fontWeight: '800', lineHeight: 21 },
  optionDescription: { fontSize: 11, lineHeight: 16 },
  radio: { alignItems: 'center', borderRadius: 12, borderWidth: 1.5, height: 24, justifyContent: 'center', width: 24 },
  radioDot: { borderRadius: 4, height: 8, width: 8 },
});
