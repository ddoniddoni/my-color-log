import { useState, type PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Screen } from '@/src/components/layout/Screen';
import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { radius, spacing, typography } from '@/src/design/tokens';
import { useAppLanguage } from '@/src/lib/localization/LanguageProvider';

export function PasswordRecoveryForm({ children, title, description }: PropsWithChildren<{ title: string; description: string }>) {
  const theme = useAppTheme();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <Screen keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
        <AppText variant="title2">Color Log</AppText>
        <View style={[styles.card, { backgroundColor: theme.colors.paper, borderColor: theme.colors.ink }]}>
          <AppText accessibilityRole="header" variant="title1">{title}</AppText>
          <AppText color="secondary">{description}</AppText>
          {children}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

export function RecoveryInput({ label, error, secureTextEntry, ...props }: TextInputProps & { label: string; error?: boolean }) {
  const [visible, setVisible] = useState(false);
  const theme = useAppTheme();
  const { t } = useAppLanguage();
  return (
    <View style={styles.field}>
      <AppText variant="bodyStrong">{label}</AppText>
      <View style={[styles.inputRow, { borderColor: error ? theme.colors.danger : theme.colors.borderStrong }]}>
        <TextInput
          {...props}
          accessibilityLabel={t(label)}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={secureTextEntry && !visible}
          style={[styles.input, { color: theme.colors.textPrimary }]}
        />
        {secureTextEntry ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t(visible ? '비밀번호 숨기기' : '비밀번호 표시')} accessibilityState={{ selected: visible }} onPress={() => setVisible((value) => !value)} style={styles.visibility}>
            <AppText variant="callout">{visible ? '숨기기' : '표시'}</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function RecoveryErrorText({ children }: PropsWithChildren) {
  const theme = useAppTheme();
  return <AppText accessibilityLiveRegion="polite" style={{ color: theme.colors.danger }}>{children}</AppText>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { justifyContent: 'center' },
  card: { gap: spacing[5], borderWidth: 1, borderRadius: radius.md, padding: spacing[5] },
  field: { gap: spacing[2] },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, minHeight: 54 },
  input: { ...typography.body, flex: 1, minWidth: 0, paddingVertical: spacing[3] },
  visibility: { minHeight: 44, minWidth: 44, paddingHorizontal: spacing[2], alignItems: 'center', justifyContent: 'center' },
});
