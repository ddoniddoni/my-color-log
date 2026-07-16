import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { useFonts } from 'expo-font';
import { useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/src/components/ui/AppText';
import { colors } from '@/src/design/tokens';

const INVITE_CODE_LENGTH = 6;
const INVITE_CODE_DIGIT_IDS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'] as const;

export function RoomSetupCanvas() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const insets = useSafeAreaInsets();
  const [inviteCode, setInviteCode] = useState<string[]>(() => Array.from({ length: INVITE_CODE_LENGTH }, () => ''));
  const digitInputs = useRef<(TextInput | null)[]>([]);
  const bodyFont = fontsLoaded ? 'BricolageGrotesque_400Regular' : undefined;
  const boldFont = fontsLoaded ? 'BricolageGrotesque_700Bold' : undefined;
  const heavyFont = fontsLoaded ? 'BricolageGrotesque_800ExtraBold' : undefined;

  function handleDigitChange(index: number, value: string): void {
    const enteredDigits = value.replace(/\D/g, '').slice(0, INVITE_CODE_LENGTH - index);
    const nextCode = [...inviteCode];

    if (enteredDigits.length === 0) {
      nextCode[index] = '';
      setInviteCode(nextCode);
      return;
    }

    for (let offset = 0; offset < enteredDigits.length; offset += 1) {
      nextCode[index + offset] = enteredDigits[offset] ?? '';
    }

    setInviteCode(nextCode);
    const nextIndex = Math.min(index + enteredDigits.length, INVITE_CODE_LENGTH - 1);
    digitInputs.current[nextIndex]?.focus();
  }

  function handleDigitKeyPress(index: number, key: string): void {
    if (key === 'Backspace' && inviteCode[index] === '' && index > 0) {
      digitInputs.current[index - 1]?.focus();
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.appBarShadow}>
        <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <View accessibilityLabel="기록 아이콘" accessibilityRole="image" style={styles.appBarIcon}>
            <PencilIcon />
          </View>
          <AppText style={[styles.brand, { fontFamily: heavyFont }]}>Oneul-Bit</AppText>
          <View accessibilityLabel="설정은 준비 중이에요" accessibilityRole="image" style={styles.appBarIcon}>
            <GearIcon />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <AppText style={[styles.title, { fontFamily: heavyFont }]}>함께 그려볼까요?</AppText>
          <AppText style={[styles.subtitle, { fontFamily: bodyFont }]}>새로운 비공개 캔버스를 만들거나, 친구가 보낸 초대 코드로 들어가 보세요.</AppText>
        </View>

        <View style={styles.cards}>
          <RoomActionCard
            bodyFont={bodyFont}
            boldFont={boldFont}
            caption="START FRESH"
            description="나만의 비공개 방을 열고, 친구들과 매일의 색을 함께 모아 보세요."
            icon={<KeyIcon />}
            onPress={showRoomFeatureNotice}
            title="새 친구방 만들기"
            variant="light"
          />

          <JoinRoomCard
            bodyFont={bodyFont}
            boldFont={boldFont}
            code={inviteCode}
            digitInputs={digitInputs}
            onDigitChange={handleDigitChange}
            onDigitKeyPress={handleDigitKeyPress}
          />
        </View>

        <View style={styles.recentSection}>
          <View style={styles.recentHeading}>
            <HistoryIcon />
            <AppText style={styles.recentLabel}>RECENTLY VISITED</AppText>
          </View>
          <View accessibilityLabel="최근에 방문한 친구방이 없어요" style={styles.recentEmpty}>
            <View style={styles.recentEmptyIcon}><PaletteIcon /></View>
            <View style={styles.recentEmptyCopy}>
              <AppText style={[styles.recentEmptyTitle, { fontFamily: boldFont }]}>최근에 방문한 방이 없어요</AppText>
              <AppText style={[styles.recentEmptyDescription, { fontFamily: bodyFont }]}>참여한 친구방은 이곳에서 다시 열 수 있어요.</AppText>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

type RoomActionCardProps = {
  bodyFont: string | undefined;
  boldFont: string | undefined;
  caption: string;
  description: string;
  icon: React.ReactNode;
  onPress: () => void;
  title: string;
  variant: 'light';
};

function RoomActionCard({ bodyFont, boldFont, caption, description, icon, onPress, title }: RoomActionCardProps) {
  return (
    <View style={styles.cardShadow}>
      <View style={styles.card}>
        <View style={styles.cardTopline}>
          <View accessibilityRole="image" style={[styles.actionIcon, styles.actionIconTiltLeft]}>{icon}</View>
          <AppText style={styles.cardCaption}>{caption}</AppText>
        </View>
        <AppText style={[styles.cardTitle, { fontFamily: boldFont }]}>{title}</AppText>
        <AppText style={[styles.cardDescription, { fontFamily: bodyFont }]}>{description}</AppText>
        <HardShadowButton accessibilityLabel="친구방 만들기, 준비 중" label="방 만들기" onPress={onPress} tone="light" />
        <View pointerEvents="none" style={styles.sparkle}><SparkleIcon /></View>
      </View>
    </View>
  );
}

type JoinRoomCardProps = {
  bodyFont: string | undefined;
  boldFont: string | undefined;
  code: string[];
  digitInputs: React.MutableRefObject<(TextInput | null)[]>;
  onDigitChange: (index: number, value: string) => void;
  onDigitKeyPress: (index: number, key: string) => void;
};

function JoinRoomCard({ bodyFont, boldFont, code, digitInputs, onDigitChange, onDigitKeyPress }: JoinRoomCardProps) {
  return (
    <View style={styles.cardShadow}>
      <View style={styles.card}>
        <View style={styles.cardTopline}>
          <View accessibilityRole="image" style={[styles.actionIcon, styles.actionIconTiltRight]}><DoorIcon /></View>
          <AppText style={[styles.cardCaption, styles.cardCaptionTilt]}>HAVE A CODE?</AppText>
        </View>
        <AppText style={[styles.cardTitle, { fontFamily: boldFont }]}>초대 코드로 참여하기</AppText>
        <AppText style={[styles.cardDescription, { fontFamily: bodyFont }]}>친구가 공유한 6자리 비밀 코드를 입력하면 같은 방에 들어갈 수 있어요.</AppText>
        <View style={styles.codeInputs}>
          {code.map((digit, index) => (
            <TextInput
              key={INVITE_CODE_DIGIT_IDS[index]}
              ref={(input) => { digitInputs.current[index] = input; }}
              accessibilityLabel={`초대 코드 ${index + 1}번째 숫자`}
              keyboardType="number-pad"
              maxLength={INVITE_CODE_LENGTH}
              onChangeText={(value) => onDigitChange(index, value)}
              onKeyPress={({ nativeEvent }) => onDigitKeyPress(index, nativeEvent.key)}
              placeholder="0"
              placeholderTextColor="rgba(0, 0, 0, 0.2)"
              style={styles.codeInput}
              value={digit}
            />
          ))}
        </View>
        <HardShadowButton accessibilityLabel="친구방 입장, 준비 중" label="방 입장하기" onPress={showRoomFeatureNotice} tone="dark" />
        <View pointerEvents="none" style={styles.wavyUnderline}><WavyLine /></View>
      </View>
    </View>
  );
}

function HardShadowButton({ accessibilityLabel, label, onPress, tone }: { accessibilityLabel: string; label: string; onPress: () => void; tone: 'light' | 'dark' }) {
  return (
    <View style={styles.buttonShadow}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: false }}
        onPress={onPress}
        style={({ pressed }) => [styles.button, tone === 'dark' ? styles.darkButton : styles.lightButton, pressed && styles.buttonPressed]}>
        <AppText style={[styles.buttonLabel, tone === 'dark' && styles.darkButtonLabel]}>{label}</AppText>
        {tone === 'dark' ? <LoginIcon color={colors.white} /> : <ArrowIcon />}
      </Pressable>
    </View>
  );
}

function showRoomFeatureNotice(): void {
  Alert.alert('친구방은 준비 중이에요', '방 만들기와 초대 코드 참여 기능을 안전하게 연결하고 있어요.');
}

function PencilIcon() {
  return <Svg height={22} viewBox="0 0 24 24" width={22}><Path d="m5 19 3.3-.7L19 7.6 16.4 5 5.7 15.7 5 19Z" fill="none" stroke={colors.black} strokeLinejoin="round" strokeWidth={1.8} /><Path d="m15.7 5.7 2.6 2.6" fill="none" stroke={colors.black} strokeLinecap="round" strokeWidth={1.8} /></Svg>;
}

function GearIcon() {
  return <Svg height={21} viewBox="0 0 24 24" width={21}><Circle cx={12} cy={12} fill="none" r={3} stroke={colors.black} strokeWidth={1.7} /><Path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2m14.5-6.5-1.4 1.4M7 17l-1.4 1.4m0-12.8L7 7m9.6 9.6 1.4 1.4" fill="none" stroke={colors.black} strokeLinecap="round" strokeWidth={1.7} /></Svg>;
}

function KeyIcon() {
  return <Svg height={48} viewBox="0 0 48 48" width={48}><Circle cx={17} cy={19} fill="none" r={8} stroke={colors.black} strokeWidth={2} /><Path d="m23 25 14 14m-5-5 3-3m-7-2 3-3" fill="none" stroke={colors.black} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></Svg>;
}

function DoorIcon() {
  return <Svg height={48} viewBox="0 0 48 48" width={48}><Path d="M12 39V10l21-3v32M12 39h24M17 14v25m0-20 11-1v21" fill="none" stroke={colors.black} strokeLinejoin="round" strokeWidth={2} /><Circle cx={25.5} cy={28} fill={colors.black} r={1.5} /></Svg>;
}

function SparkleIcon() {
  return <Svg height={42} viewBox="0 0 48 48" width={42}><Path d="M24 4c1.7 11 8.6 17.8 20 20-11.4 2.1-18.3 9-20 20-2-11-8.7-17.9-20-20C15.3 21.8 22 15 24 4Z" fill="none" stroke={colors.black} strokeLinejoin="round" strokeWidth={2.2} /></Svg>;
}

function ArrowIcon() {
  return <Svg height={22} viewBox="0 0 24 24" width={22}><Path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke={colors.black} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} /></Svg>;
}

function LoginIcon({ color }: { color: string }) {
  return <Svg height={20} viewBox="0 0 24 24" width={20}><Path d="M11 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19H11m2-4 4-3-4-3m4 3H9" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></Svg>;
}

function HistoryIcon() {
  return <Svg height={18} viewBox="0 0 24 24" width={18}><Path d="M4.8 7.5V4.8m0 2.7h2.7m-2.7 0a8 8 0 1 1-1 7.6M12 8v4.2l2.9 1.8" fill="none" stroke={colors.black} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} /></Svg>;
}

function PaletteIcon() {
  return <Svg height={23} viewBox="0 0 24 24" width={23}><Path d="M12 3.8a8.6 8.6 0 0 0 0 17.2h1.7a1.7 1.7 0 0 0 0-3.4h-.3a1.2 1.2 0 0 1 0-2.4h1.1A5.7 5.7 0 0 0 12 3.8Z" fill="none" stroke={colors.black} strokeLinejoin="round" strokeWidth={1.5} /><Circle cx={8.2} cy={10.2} fill={colors.black} r={1} /><Circle cx={12} cy={7.6} fill={colors.black} r={1} /><Circle cx={15.7} cy={10.2} fill={colors.black} r={1} /></Svg>;
}

function WavyLine() {
  return <Svg height={26} preserveAspectRatio="none" viewBox="0 0 200 20" width="100%"><Path d="M0 10Q50 0 100 10T200 10" fill="none" stroke={colors.black} strokeLinecap="round" strokeWidth={4} /></Svg>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.white, flex: 1 },
  appBarShadow: { backgroundColor: colors.black, paddingBottom: 4 },
  appBar: { alignItems: 'center', backgroundColor: colors.white, borderBottomColor: colors.black, borderBottomWidth: 3, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingBottom: 8, paddingHorizontal: 16 },
  appBarIcon: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  brand: { color: colors.black, fontSize: 25, fontWeight: '800', letterSpacing: -1.1, lineHeight: 30, transform: [{ rotate: '-2deg' }] },
  content: { gap: 40, paddingBottom: 138, paddingHorizontal: 16, paddingTop: 40 },
  intro: { gap: 8 },
  title: { color: colors.black, fontSize: 32, fontWeight: '800', letterSpacing: -1.2, lineHeight: 38 },
  subtitle: { color: 'rgba(0, 0, 0, 0.6)', fontSize: 17, lineHeight: 27 },
  cards: { gap: 24 },
  cardShadow: { backgroundColor: colors.black, paddingBottom: 8, paddingRight: 8 },
  card: { backgroundColor: colors.white, borderColor: colors.black, borderWidth: 3, minHeight: 284, overflow: 'visible', padding: 24, position: 'relative' },
  cardTopline: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  actionIcon: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.black, borderRadius: 999, borderWidth: 2, height: 66, justifyContent: 'center', width: 66 },
  actionIconTiltLeft: { transform: [{ rotate: '-6deg' }] },
  actionIconTiltRight: { transform: [{ rotate: '6deg' }] },
  cardCaption: { borderColor: colors.black, borderWidth: 1, color: colors.black, fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.25, lineHeight: 13, paddingHorizontal: 8, paddingVertical: 2, transform: [{ rotate: '3deg' }] },
  cardCaptionTilt: { transform: [{ rotate: '-2deg' }] },
  cardTitle: { color: colors.black, fontSize: 23, fontWeight: '700', letterSpacing: -0.65, lineHeight: 30, marginBottom: 8 },
  cardDescription: { color: colors.black, fontSize: 15, lineHeight: 22, marginBottom: 24 },
  buttonShadow: { backgroundColor: colors.black, paddingBottom: 4, paddingRight: 4 },
  button: { alignItems: 'center', borderColor: colors.black, borderWidth: 3, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 55, paddingHorizontal: 24, paddingVertical: 12 },
  lightButton: { backgroundColor: colors.white },
  darkButton: { backgroundColor: colors.black },
  buttonPressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
  buttonLabel: { color: colors.black, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 21, fontWeight: '700', letterSpacing: -0.5, lineHeight: 26 },
  darkButtonLabel: { color: colors.white },
  sparkle: { bottom: -26, opacity: 0.3, position: 'absolute', right: -25, transform: [{ rotate: '12deg' }] },
  codeInputs: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  codeInput: { borderBottomColor: colors.black, borderBottomWidth: 3, color: colors.black, flex: 1, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 22, fontWeight: '700', height: 42, lineHeight: 26, paddingHorizontal: 0, paddingVertical: 0, textAlign: 'center', textAlignVertical: 'center' },
  wavyUnderline: { bottom: -33, height: 28, left: '12%', opacity: 0.1, position: 'absolute', width: '76%' },
  recentSection: { gap: 16 },
  recentHeading: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  recentLabel: { color: colors.black, fontFamily: 'monospace', fontSize: 11, fontWeight: '500', letterSpacing: 1.5, lineHeight: 14 },
  recentEmpty: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.black, borderWidth: 2, flexDirection: 'row', gap: 16, minHeight: 78, padding: 16 },
  recentEmptyIcon: { alignItems: 'center', borderColor: colors.black, borderRadius: 999, borderWidth: 2, height: 40, justifyContent: 'center', transform: [{ rotate: '-3deg' }], width: 40 },
  recentEmptyCopy: { flex: 1, gap: 2 },
  recentEmptyTitle: { color: colors.black, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  recentEmptyDescription: { color: 'rgba(0, 0, 0, 0.6)', fontSize: 10, lineHeight: 14 },
});
