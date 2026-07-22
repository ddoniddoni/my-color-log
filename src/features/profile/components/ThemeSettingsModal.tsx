import { Pressable, StyleSheet, View } from 'react-native';

import { AppModal } from '@/src/components/ui/AppModal';
import { AppText } from '@/src/components/ui/AppText';
import { getThemePreferenceLabel, useAppTheme } from '@/src/design/ThemeProvider';
import { radius, spacing } from '@/src/design/tokens';
import { type ThemePreference } from '@/src/design/themePreference';

type ThemeSettingsModalProps = {
  isSaving: boolean;
  onClose: () => void;
  onSelect: (preference: ThemePreference) => void;
  preference: ThemePreference;
  visible: boolean;
};

const options: readonly ThemePreference[] = ['system', 'light', 'dark'];

export function ThemeSettingsModal({ isSaving, onClose, onSelect, preference, visible }: ThemeSettingsModalProps) {
  const theme = useAppTheme();

  return (
    <AppModal accessibilityLabel="화면 테마 설정 닫기" contentStyle={styles.card} isBusy={isSaving} onClose={onClose} visible={visible}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <AppText style={[styles.eyebrow, { color: theme.colors.textSecondary }]}>APPEARANCE</AppText>
          <AppText accessibilityRole="header" style={[styles.title, { color: theme.colors.ink }]}>화면 테마</AppText>
          <AppText style={[styles.description, { color: theme.colors.textSecondary }]}>기기의 화면 분위기에 맞춰 Color Log를 볼 수 있어요.</AppText>
        </View>
        <Pressable accessibilityLabel="화면 테마 설정 닫기" accessibilityRole="button" accessibilityState={{ disabled: isSaving }} disabled={isSaving} onPress={onClose} style={[styles.closeButton, { borderColor: theme.colors.ink }]}>
          <AppText style={[styles.closeText, { color: theme.colors.ink }]}>×</AppText>
        </Pressable>
      </View>

      <View accessibilityRole="radiogroup" style={styles.options}>
        {options.map((option) => {
          const selected = preference === option;
          return (
            <Pressable
              accessibilityLabel={`${getThemePreferenceLabel(option)} 테마`}
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
                <AppText style={[styles.optionTitle, { color: theme.colors.ink }]}>{getThemePreferenceLabel(option)}</AppText>
                <AppText style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>{getDescription(option)}</AppText>
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

function getDescription(preference: ThemePreference): string {
  if (preference === 'dark') return '어두운 배경으로 편안하게 봐요.';
  if (preference === 'light') return '밝은 종이 느낌으로 봐요.';
  return '기기 설정에 따라 자동으로 바뀌어요.';
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
