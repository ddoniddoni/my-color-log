import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/AppText';
import { colors, spacing } from '@/src/design/tokens';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '페이지를 찾을 수 없어요' }} />
      <AppText variant="title2">페이지를 찾을 수 없어요</AppText>
      <Link href="/" accessibilityRole="link"><AppText color="secondary">오늘 화면으로 돌아가기</AppText></Link>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', gap: spacing[3], padding: spacing[5], backgroundColor: colors.canvas } });
