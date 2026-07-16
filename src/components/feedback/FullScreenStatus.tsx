import { StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { Button } from '@/src/components/ui/Button';
import { colors, spacing } from '@/src/design/tokens';

type FullScreenStatusProps = { title: string; description: string; actionLabel?: string; onAction?: () => void };

export function FullScreenStatus({ title, description, actionLabel, onAction }: FullScreenStatusProps) {
  return <View style={styles.container}><AppText variant="title2">{title}</AppText><AppText color="secondary">{description}</AppText>{actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}</View>;
}

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', gap: spacing[4], padding: spacing[5], backgroundColor: colors.canvas } });
