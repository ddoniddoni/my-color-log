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
import { colors } from '@/src/design/tokens';

type MyProfileCanvasProps = {
  deletingAccount: boolean;
  email: string;
  nickname: string;
  onDeleteAccountPress: () => void;
  onNotificationsPress: () => void;
  onProfileEditPress: () => void;
  onSignOutPress: () => void;
  signingOut: boolean;
};

export function MyProfileCanvas({
  deletingAccount,
  email,
  nickname,
  onDeleteAccountPress,
  onNotificationsPress,
  onProfileEditPress,
  onSignOutPress,
  signingOut,
}: MyProfileCanvasProps) {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const insets = useSafeAreaInsets();
  const bodyFont = fontsLoaded ? 'BricolageGrotesque_400Regular' : undefined;
  const boldFont = fontsLoaded ? 'BricolageGrotesque_700Bold' : undefined;

  return (
    <View style={styles.page}>
      <View style={styles.appBarShadow}>
        <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <View accessibilityLabel="메뉴" accessibilityRole="image" style={styles.appBarIcon}><MenuIcon /></View>
          <AppText style={[styles.brand, { fontFamily: boldFont }]}>Color Log</AppText>
          <View accessibilityLabel="설정은 준비 중이에요" accessibilityRole="image" style={styles.appBarIcon}><GearIcon /></View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <View accessibilityLabel={`${nickname}의 프로필 그림`} accessibilityRole="image" style={styles.avatar}><DoodleAvatar /></View>
          <AppText style={[styles.nickname, { fontFamily: boldFont }]}>{nickname}</AppText>
          <AppText numberOfLines={1} style={[styles.email, { fontFamily: bodyFont }]}>{email}</AppText>
        </View>

        <View accessibilityLabel="친구방 초대 코드가 아직 없어요" style={styles.inviteCard}>
          <AppText style={styles.inviteLabel}>친구방 초대 코드</AppText>
          <View style={styles.inviteValueRow}>
            <AppText style={[styles.inviteValue, { fontFamily: boldFont }]}>아직 만든 방이 없어요</AppText>
            <View accessibilityLabel="초대 코드 기능 준비 중" accessibilityRole="image" style={styles.copyGroup}><CopyIcon /><AppText style={styles.copyText}>준비 중</AppText></View>
          </View>
          <AppText style={[styles.inviteHint, { fontFamily: bodyFont }]}>친구방을 만들면 6자리 초대 코드가 생겨요.</AppText>
        </View>

        <View style={styles.menuList}>
          <MarkerLine strong />
          <MenuRow disabled={deletingAccount} label="프로필 수정" onPress={onProfileEditPress} />
          <MarkerLine />
          <MenuRow disabled={deletingAccount} label="알림 설정" onPress={onNotificationsPress} />
          <MarkerLine />
          <MenuRow destructive disabled={deletingAccount || signingOut} label={signingOut ? '로그아웃 중…' : '로그아웃'} onPress={onSignOutPress} />
          <MarkerLine strong />
        </View>

        <View style={styles.accountManagement}>
          <Pressable accessibilityLabel="계정 삭제" accessibilityRole="button" accessibilityState={{ disabled: deletingAccount }} disabled={deletingAccount} onPress={onDeleteAccountPress} style={({ pressed }) => [styles.accountDelete, pressed && styles.accountDeletePressed, deletingAccount && styles.accountDeleteDisabled]}>
            <AppText style={[styles.accountDeleteText, { fontFamily: bodyFont }]}>{deletingAccount ? '계정 삭제 중…' : '계정 삭제'}</AppText>
          </Pressable>
        </View>

        <View pointerEvents="none" style={styles.doodle}><PenDoodle /></View>
      </ScrollView>
    </View>
  );
}

function MenuRow({ destructive = false, disabled = false, label, onPress }: { destructive?: boolean; disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && !disabled && styles.menuRowPressed, disabled && styles.menuRowDisabled]}>
      <AppText style={[styles.menuLabel, destructive && styles.destructiveText, disabled && styles.menuLabelDisabled]}>{label}</AppText>
      {destructive ? <LogoutIcon /> : <ArrowIcon />}
    </Pressable>
  );
}

function MarkerLine({ strong = false }: { strong?: boolean }) {
  return <View style={[styles.markerLine, strong ? styles.markerLineStrong : styles.markerLineSoft]} />;
}

function MenuIcon() {
  return <Svg height={21} viewBox="0 0 24 24" width={21}><Path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke={colors.black} strokeLinecap="round" strokeWidth={2} /></Svg>;
}

function GearIcon() {
  return <Svg height={21} viewBox="0 0 24 24" width={21}><Circle cx={12} cy={12} fill="none" r={3.1} stroke={colors.black} strokeWidth={1.5} /><Path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2m14.5-6.5-1.4 1.4M7 17l-1.4 1.4m0-12.8L7 7m9.6 9.6 1.4 1.4" fill="none" stroke={colors.black} strokeLinecap="round" strokeWidth={1.5} /></Svg>;
}

function DoodleAvatar() {
  return <Svg height={64} viewBox="0 0 72 72" width={64}><Circle cx={36} cy={36} fill="#F9F9F9" r={34} stroke={colors.black} strokeWidth={1.5} /><Path d="M22 29c-5-2-4-9 1-10 4-1 6 3 6 6m20 4c5-2 4-9-1-10-4-1-6 3-6 6M23 30c1-9 25-10 27 0v15c-2 9-24 9-27 0V30Z" fill="none" stroke={colors.black} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.45} /><Circle cx={31} cy={36} fill={colors.black} r={1.7} /><Circle cx={42} cy={36} fill={colors.black} r={1.7} /><Path d="M32 45c2 1.6 6 1.6 8 0m-8-13 3-2 2 2 3-2" fill="none" stroke={colors.black} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} /></Svg>;
}

function CopyIcon() {
  return <Svg height={17} viewBox="0 0 24 24" width={17}><Path d="M9 8h10v11H9V8Zm-4 8V5h10" fill="none" stroke={colors.black} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} /></Svg>;
}

function ArrowIcon() {
  return <Svg height={21} viewBox="0 0 24 24" width={21}><Path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke={colors.black} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></Svg>;
}

function LogoutIcon() {
  return <Svg height={21} viewBox="0 0 24 24" width={21}><Path d="M11 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19H11m2-4 4-3-4-3m4 3H9" fill="none" stroke="#BA1A1A" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} /></Svg>;
}

function PenDoodle() {
  return <Svg height={60} viewBox="0 0 60 64" width={60}><Path d="m13 47 7-2 29-29-5-5-29 29-2 7Zm30-36 4-4a4 4 0 0 1 6 6l-4 4M11 54c9-2 22 2 34-1" fill="none" stroke={colors.black} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.1} /></Svg>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.white, flex: 1 },
  appBarShadow: { backgroundColor: colors.black, paddingBottom: 3 },
  appBar: { alignItems: 'center', backgroundColor: colors.white, borderBottomColor: colors.black, borderBottomWidth: 1.5, flexDirection: 'row', justifyContent: 'space-between', minHeight: 50, paddingBottom: 8, paddingHorizontal: 16 },
  appBarIcon: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  brand: { color: colors.black, fontSize: 20, fontWeight: '700', letterSpacing: -0.4, lineHeight: 26, transform: [{ rotate: '-1deg' }] },
  content: { alignItems: 'stretch', gap: 28, paddingBottom: 132, paddingHorizontal: 16, paddingTop: 34 },
  profileSection: { alignItems: 'center', gap: 4 },
  avatar: { alignItems: 'center', borderColor: colors.black, borderRadius: 999, borderWidth: 1.5, height: 70, justifyContent: 'center', marginBottom: 4, width: 70 },
  nickname: { color: colors.black, fontSize: 18, fontWeight: '700', letterSpacing: -0.4, lineHeight: 24 },
  email: { color: 'rgba(0, 0, 0, 0.6)', fontFamily: 'monospace', fontSize: 10, lineHeight: 14, maxWidth: '78%' },
  inviteCard: { backgroundColor: colors.white, borderColor: colors.black, borderWidth: 3, gap: 10, padding: 16 },
  inviteLabel: { color: colors.black, fontFamily: 'monospace', fontSize: 10, letterSpacing: 1, lineHeight: 12, textTransform: 'uppercase' },
  inviteValueRow: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  inviteValue: { color: colors.black, flex: 1, fontSize: 18, fontWeight: '700', letterSpacing: -0.5, lineHeight: 24 },
  copyGroup: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  copyText: { color: colors.black, fontFamily: 'monospace', fontSize: 9, lineHeight: 11 },
  inviteHint: { color: 'rgba(0, 0, 0, 0.6)', fontSize: 11, lineHeight: 15 },
  menuList: { gap: 0 },
  markerLine: { backgroundColor: colors.black, height: 2, transform: [{ rotate: '-0.5deg' }], width: '100%' },
  markerLineStrong: { opacity: 0.22 },
  markerLineSoft: { opacity: 0.1 },
  menuRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 50, paddingVertical: 10 },
  menuRowPressed: { paddingLeft: 6, transform: [{ scale: 0.99 }] },
  menuRowDisabled: { opacity: 0.48 },
  menuLabel: { color: colors.black, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 18, fontWeight: '700', letterSpacing: -0.45, lineHeight: 24 },
  menuLabelDisabled: { color: colors.textSecondary },
  destructiveText: { color: '#BA1A1A' },
  accountManagement: { alignItems: 'center', paddingTop: 2 },
  accountDelete: { alignItems: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  accountDeletePressed: { opacity: 0.64 },
  accountDeleteDisabled: { opacity: 0.48 },
  accountDeleteText: { color: colors.danger, fontFamily: 'monospace', fontSize: 11, lineHeight: 14, textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  doodle: { alignSelf: 'center', marginTop: -2, opacity: 0.2 },
});
