import { StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { spacing } from '@/src/design/tokens';

type EmptyStateProps = { title: string; description: string };

export function EmptyState({ title, description }: EmptyStateProps) {
  return <View style={styles.container}><AppText variant="title3">{title}</AppText><AppText color="secondary">{description}</AppText></View>;
}

const styles = StyleSheet.create({ container: { alignItems: 'flex-start', gap: spacing[2], paddingVertical: spacing[6] } });
