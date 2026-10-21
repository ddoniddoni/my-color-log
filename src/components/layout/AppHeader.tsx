import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { headerMetrics, spacing } from '@/src/design/tokens';
import { useOptionalAppLanguage } from '@/src/lib/localization/LanguageProvider';

type HeaderAction = {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: 'back' | 'settings';
  onPress: () => void;
};

type AppHeaderProps = {
  title: string;
  leadingAction?: HeaderAction;
  trailingAction?: HeaderAction;
};

export function AppHeader({ title, leadingAction, trailingAction }: AppHeaderProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { backgroundColor: colors.canvas, borderBottomColor: colors.border, paddingTop: insets.top }]}>
      <View style={styles.row}>
        {leadingAction ? <HeaderButton action={leadingAction} /> : null}
        <AppText accessibilityRole="header" variant="title2" style={[styles.title, { color: colors.ink }]}>{title}</AppText>
        {trailingAction ? <HeaderButton action={trailingAction} /> : null}
      </View>
    </View>
  );
}

function HeaderButton({ action }: { action: HeaderAction }) {
  const { colors } = useAppTheme();
  const { t } = useOptionalAppLanguage();

  return (
    <Pressable
      accessibilityLabel={t(action.accessibilityLabel)}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(action.disabled) }}
      disabled={action.disabled}
      onPress={action.onPress}
      style={({ pressed }) => [styles.button, pressed && { backgroundColor: colors.surfaceMuted }, action.disabled && styles.disabled]}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg height={headerMetrics.iconSize} width={headerMetrics.iconSize} viewBox="0 0 24 24">
          {action.icon === 'back' ? (
            <Path d="m14.5 5-7 7 7 7" fill="none" stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
          ) : (
            <>
              <Circle cx={12} cy={12} r={3} fill="none" stroke={colors.ink} strokeWidth={1.8} />
              <Path d="m9 3-1 2.3-2.5.3-2 3.4 1.5 2-.2 2.5L3.5 15l2 3.4 2.5.3 1 2.3h6l1-2.3 2.5-.3 2-3.4-1.3-1.5-.2-2.5 1.5-2-2-3.4-2.5-.3L15 3Z" fill="none" stroke={colors.ink} strokeLinejoin="round" strokeWidth={1.4} />
            </>
          )}
        </Svg>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { borderBottomWidth: StyleSheet.hairlineWidth },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing[3], minHeight: headerMetrics.minHeight, paddingHorizontal: headerMetrics.horizontalPadding, paddingVertical: headerMetrics.verticalPadding },
  title: { flex: 1, letterSpacing: -0.5 },
  button: { alignItems: 'center', borderRadius: headerMetrics.buttonSize / 2, flexShrink: 0, height: headerMetrics.buttonSize, justifyContent: 'center', width: headerMetrics.buttonSize },
  disabled: { opacity: 0.4 },
});
