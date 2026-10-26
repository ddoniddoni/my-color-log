import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { ColorIsolationPreview } from '@/src/features/camera/components/ColorIsolationPreview';

// Mounted only for explicitly selected photos. The default grid uses Expo Image.
export function PhotoColorThumbnail({ uri, colorHex }: { uri: string; colorHex: string }) {
  const { colors } = useAppTheme();
  const [size, setSize] = useState(0);
  const [failed, setFailed] = useState(false);
  return <View onLayout={(event) => setSize(event.nativeEvent.layout.width)} style={styles.photo}>
    {size > 0 && !failed
      ? <ColorIsolationPreview colorHex={colorHex} mode="isolate" maxDimension={384} onError={() => setFailed(true)} size={size} uri={uri} />
      : <Image cachePolicy="memory-disk" contentFit="cover" source={{ uri }} style={styles.photo} />}
    {failed ? <View style={[styles.notice, { backgroundColor: colors.surface }]}><AppText variant="caption">색 강조 재시도</AppText></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: '100%' },
  notice: { position: 'absolute', bottom: 0 },
});
