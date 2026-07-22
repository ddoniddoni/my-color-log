import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { useAppTheme } from '@/src/design/ThemeProvider';
import { type ThemeColors } from '@/src/design/tokens';
import { getRoomOverview, type ProfileRoomSummary, type RoomSummaryStatus } from '@/src/features/profile/model/roomOverview';

type MyProfileCanvasProps = {
  deletingAccount: boolean;
  email: string;
  nickname: string;
  onDeleteAccountPress: () => void;
  onNotificationsPress: () => void;
  onProfileEditPress: () => void;
  onPrivacyPress: () => void;
  onRoomsPress: () => void;
  onSignOutPress: () => void;
  onThemePress: () => void;
  rooms: readonly ProfileRoomSummary[];
  roomsStatus: RoomSummaryStatus;
  signingOut: boolean;
  themePreferenceLabel: string;
};

export function MyProfileCanvas({
  deletingAccount,
  email,
  nickname,
  onDeleteAccountPress,
  onNotificationsPress,
  onProfileEditPress,
  onPrivacyPress,
  onRoomsPress,
  onSignOutPress,
  onThemePress,
  rooms,
  roomsStatus,
  signingOut,
  themePreferenceLabel,
}: MyProfileCanvasProps) {
  const theme = useAppTheme();
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const insets = useSafeAreaInsets();
  const bodyFont = fontsLoaded ? 'BricolageGrotesque_400Regular' : undefined;
  const boldFont = fontsLoaded ? 'BricolageGrotesque_700Bold' : undefined;

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.surface }]}>
      <View style={[styles.appBarShadow, { backgroundColor: theme.colors.black }]}>
        <View style={[styles.appBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.ink, paddingTop: Math.max(insets.top, 8) }]}>
          <View accessible accessibilityLabel="메뉴" accessibilityRole="image" style={styles.appBarIcon}><MenuIcon color={theme.colors.ink} /></View>
          <AppText style={[styles.brand, { color: theme.colors.ink, fontFamily: boldFont }]}>Color Log</AppText>
          <View accessible accessibilityLabel="설정" accessibilityRole="image" style={styles.appBarIcon}><GearIcon color={theme.colors.ink} /></View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <View accessible accessibilityLabel={`${nickname}의 프로필 그림`} accessibilityRole="image" style={[styles.avatar, { borderColor: theme.colors.ink }]}><DoodleAvatar color={theme.colors.ink} fill={theme.colors.surface} /></View>
          <AppText style={[styles.nickname, { color: theme.colors.ink, fontFamily: boldFont }]}>{nickname}</AppText>
          <AppText numberOfLines={1} style={[styles.email, { color: theme.colors.textSecondary, fontFamily: bodyFont }]}>{email}</AppText>
        </View>

        <RoomSummaryCard bodyFont={bodyFont} boldFont={boldFont} colors={theme.colors} onPress={onRoomsPress} rooms={rooms} status={roomsStatus} />

        <View style={styles.menuList}>
          <MarkerLine colors={theme.colors} strong />
          <MenuRow colors={theme.colors} disabled={deletingAccount} label="프로필 수정" onPress={onProfileEditPress} />
          <MarkerLine colors={theme.colors} />
          <MenuRow colors={theme.colors} disabled={deletingAccount} label="알림 설정" onPress={onNotificationsPress} />
          <MarkerLine colors={theme.colors} />
          <MenuRow colors={theme.colors} detail={themePreferenceLabel} disabled={deletingAccount} label="화면 테마" onPress={onThemePress} />
          <MarkerLine colors={theme.colors} />
          <MenuRow colors={theme.colors} disabled={deletingAccount} label="사진과 친구방" onPress={onPrivacyPress} />
          <MarkerLine colors={theme.colors} />
          <MenuRow colors={theme.colors} destructive disabled={deletingAccount || signingOut} label={signingOut ? '로그아웃 중…' : '로그아웃'} onPress={onSignOutPress} />
          <MarkerLine colors={theme.colors} strong />
        </View>

        <View style={styles.accountManagement}>
          <Pressable accessibilityLabel="계정 삭제" accessibilityRole="button" accessibilityState={{ disabled: deletingAccount }} disabled={deletingAccount} onPress={onDeleteAccountPress} style={({ pressed }) => [styles.accountDelete, pressed && styles.accountDeletePressed, deletingAccount && styles.accountDeleteDisabled]}>
            <AppText style={[styles.accountDeleteText, { color: theme.colors.danger, fontFamily: bodyFont }]}>{deletingAccount ? '계정 삭제 중…' : '계정 삭제'}</AppText>
          </Pressable>
        </View>

        <View pointerEvents="none" style={styles.doodle}><PenDoodle color={theme.colors.ink} /></View>
      </ScrollView>
    </View>
  );
}

function RoomSummaryCard({ bodyFont, boldFont, colors, onPress, rooms, status }: { bodyFont: string | undefined; boldFont: string | undefined; colors: ThemeColors; onPress: () => void; rooms: readonly ProfileRoomSummary[]; status: RoomSummaryStatus }) {
  const overview = getRoomOverview(rooms, status);

  return (
    <Pressable
      accessibilityLabel={overview.accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.roomCard, { backgroundColor: colors.surface, borderColor: colors.ink }, pressed && [styles.roomCardPressed, { backgroundColor: colors.surfaceMuted }]]}>
      <AppText style={[styles.roomLabel, { color: colors.ink }]}>MY ROOMS</AppText>
      <View style={styles.roomValueRow}>
        <View style={styles.roomCopy}>
          <AppText numberOfLines={1} style={[styles.roomTitle, { color: colors.ink, fontFamily: boldFont }]}>{overview.title}</AppText>
          <AppText numberOfLines={2} style={[styles.roomDescription, { color: colors.textSecondary, fontFamily: bodyFont }]}>{overview.description}</AppText>
        </View>
        <ArrowIcon color={colors.ink} />
      </View>
    </Pressable>
  );
}

function MenuRow({ colors, destructive = false, detail, disabled = false, label, onPress }: { colors: ThemeColors; destructive?: boolean; detail?: string; disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && !disabled && styles.menuRowPressed, disabled && styles.menuRowDisabled]}>
      <View style={styles.menuCopy}>
        <AppText style={[styles.menuLabel, { color: destructive ? colors.danger : colors.ink }, disabled && { color: colors.textSecondary }]}>{label}</AppText>
        {detail ? <AppText style={[styles.menuDetail, { color: colors.textSecondary }]}>{detail}</AppText> : null}
      </View>
      {destructive ? <LogoutIcon color={colors.danger} /> : <ArrowIcon color={colors.ink} />}
    </Pressable>
  );
}

function MarkerLine({ colors, strong = false }: { colors: ThemeColors; strong?: boolean }) {
  return <View style={[styles.markerLine, { backgroundColor: colors.ink }, strong ? styles.markerLineStrong : styles.markerLineSoft]} />;
}

function MenuIcon({ color }: { color: string }) {
  return <Svg height={21} viewBox="0 0 24 24" width={21}><Path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke={color} strokeLinecap="round" strokeWidth={2} /></Svg>;
}

function GearIcon({ color }: { color: string }) {
  return <Svg height={21} viewBox="0 0 24 24" width={21}><Circle cx={12} cy={12} fill="none" r={3.1} stroke={color} strokeWidth={1.5} /><Path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2m14.5-6.5-1.4 1.4M7 17l-1.4 1.4m0-12.8L7 7m9.6 9.6 1.4 1.4" fill="none" stroke={color} strokeLinecap="round" strokeWidth={1.5} /></Svg>;
}

function DoodleAvatar({ color, fill }: { color: string; fill: string }) {
  return <Svg height={64} viewBox="0 0 72 72" width={64}><Circle cx={36} cy={36} fill={fill} r={34} stroke={color} strokeWidth={1.5} /><Path d="M22 29c-5-2-4-9 1-10 4-1 6 3 6 6m20 4c5-2 4-9-1-10-4-1-6 3-6 6M23 30c1-9 25-10 27 0v15c-2 9-24 9-27 0V30Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.45} /><Circle cx={31} cy={36} fill={color} r={1.7} /><Circle cx={42} cy={36} fill={color} r={1.7} /><Path d="M32 45c2 1.6 6 1.6 8 0m-8-13 3-2 2 2 3-2" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} /></Svg>;
}

function ArrowIcon({ color }: { color: string }) {
  return <Svg height={21} viewBox="0 0 24 24" width={21}><Path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></Svg>;
}

function LogoutIcon({ color }: { color: string }) {
  return <Svg height={21} viewBox="0 0 24 24" width={21}><Path d="M11 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19H11m2-4 4-3-4-3m4 3H9" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} /></Svg>;
}

function PenDoodle({ color }: { color: string }) {
  return <Svg height={60} viewBox="0 0 60 64" width={60}><Path d="m13 47 7-2 29-29-5-5-29 29-2 7Zm30-36 4-4a4 4 0 0 1 6 6l-4 4M11 54c9-2 22 2 34-1" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.1} /></Svg>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  appBarShadow: { paddingBottom: 3 },
  appBar: { alignItems: 'center', borderBottomWidth: 1.5, flexDirection: 'row', justifyContent: 'space-between', minHeight: 50, paddingBottom: 8, paddingHorizontal: 16 },
  appBarIcon: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  brand: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4, lineHeight: 26, transform: [{ rotate: '-1deg' }] },
  content: { alignItems: 'stretch', gap: 28, paddingBottom: 132, paddingHorizontal: 16, paddingTop: 34 },
  profileSection: { alignItems: 'center', gap: 4 },
  avatar: { alignItems: 'center', borderRadius: 999, borderWidth: 1.5, height: 70, justifyContent: 'center', marginBottom: 4, width: 70 },
  nickname: { fontSize: 18, fontWeight: '700', letterSpacing: -0.4, lineHeight: 24 },
  email: { fontFamily: 'monospace', fontSize: 10, lineHeight: 14, maxWidth: '78%' },
  roomCard: { borderWidth: 3, gap: 10, padding: 16 },
  roomCardPressed: { transform: [{ scale: 0.99 }] },
  roomLabel: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1, lineHeight: 12, textTransform: 'uppercase' },
  roomValueRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  roomCopy: { flex: 1, gap: 4 },
  roomTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.5, lineHeight: 24 },
  roomDescription: { fontSize: 11, lineHeight: 16 },
  menuList: { gap: 0 },
  markerLine: { height: 2, transform: [{ rotate: '-0.5deg' }], width: '100%' },
  markerLineStrong: { opacity: 0.22 },
  markerLineSoft: { opacity: 0.1 },
  menuRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 50, paddingVertical: 10 },
  menuRowPressed: { paddingLeft: 6, transform: [{ scale: 0.99 }] },
  menuRowDisabled: { opacity: 0.48 },
  menuCopy: { flex: 1, gap: 1 },
  menuLabel: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 18, fontWeight: '700', letterSpacing: -0.45, lineHeight: 24 },
  menuDetail: { fontFamily: 'monospace', fontSize: 10, lineHeight: 14 },
  accountManagement: { alignItems: 'center', paddingTop: 2 },
  accountDelete: { alignItems: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  accountDeletePressed: { opacity: 0.64 },
  accountDeleteDisabled: { opacity: 0.48 },
  accountDeleteText: { fontFamily: 'monospace', fontSize: 11, lineHeight: 14, textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  doodle: { alignSelf: 'center', marginTop: -2, opacity: 0.2 },
});
