import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppModal } from '@/src/components/ui/AppModal';
import { AppText } from '@/src/components/ui/AppText';
import { colors, spacing } from '@/src/design/tokens';
import {
  getReminderPickerDate,
  getReminderTimeLabel,
  updateRoomPhotoPushEnabled,
  updateReminderEnabled,
  updateReminderTime,
  type NotificationSettings,
  type ReminderKind,
} from '@/src/features/notifications/model/notificationSettings';

type NotificationSettingsModalProps = {
  isLoading: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (settings: NotificationSettings) => Promise<boolean>;
  settings: NotificationSettings;
  visible: boolean;
};

export function NotificationSettingsModal({ isLoading, isSaving, onClose, onSave, settings, visible }: NotificationSettingsModalProps) {
  return visible ? <NotificationSettingsForm key={getSettingsKey(settings)} isLoading={isLoading} isSaving={isSaving} onClose={onClose} onSave={onSave} settings={settings} visible={visible} /> : null;
}

function NotificationSettingsForm({ isLoading, isSaving, onClose, onSave, settings, visible }: NotificationSettingsModalProps) {
  const [draft, setDraft] = useState(settings);
  const [pickerKind, setPickerKind] = useState<ReminderKind | null>(null);
  const isBusy = isLoading || isSaving;

  const selectTime = (kind: ReminderKind): void => {
    setPickerKind((current) => current === kind ? null : kind);
  };

  const save = async (): Promise<void> => {
    if (isBusy) return;
    const didSave = await onSave(draft);
    if (didSave) onClose();
  };

  return (
    <AppModal accessibilityLabel="알림 설정 닫기" contentStyle={styles.card} isBusy={isBusy} onClose={onClose} visible={visible}>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <AppText style={styles.eyebrow}>REMINDERS</AppText>
          <AppText accessibilityRole="header" style={styles.title}>알림 설정</AppText>
        </View>
        <Pressable accessibilityLabel="알림 설정 닫기" accessibilityRole="button" disabled={isBusy} onPress={onClose} style={styles.closeButton}>
          <AppText style={styles.closeText}>×</AppText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} style={styles.scroll} showsVerticalScrollIndicator={false}>
        <AppText style={styles.description}>필요한 시간에만 오늘의 색과 기록을 가볍게 알려드릴게요.</AppText>

        <ReminderRow
          description="오늘의 컬러가 열렸다는 알림"
          disabled={isBusy}
          kind="morning"
          label="아침의 색"
          onSelectTime={selectTime}
          onToggle={(enabled) => setDraft((current) => updateReminderEnabled(current, 'morning', enabled))}
          reminder={draft.morning}
        />
        {pickerKind === 'morning' ? <InlineTimePicker kind="morning" onChange={(date) => setDraft((current) => updateReminderTime(current, 'morning', date))} reminder={draft.morning} /> : null}
        <ReminderRow
          description="오늘의 한 장을 떠올리는 알림"
          disabled={isBusy}
          kind="evening"
          label="저녁의 기록"
          onSelectTime={selectTime}
          onToggle={(enabled) => setDraft((current) => updateReminderEnabled(current, 'evening', enabled))}
          reminder={draft.evening}
        />
        {pickerKind === 'evening' ? <InlineTimePicker kind="evening" onChange={(date) => setDraft((current) => updateReminderTime(current, 'evening', date))} reminder={draft.evening} /> : null}

        <View style={styles.reminderRow}>
          <View style={styles.reminderCopy}>
            <AppText style={styles.reminderLabel}>친구방 사진</AppText>
            <AppText style={styles.reminderDescription}>친구가 오늘의 사진을 처음 올렸을 때 알려드려요.</AppText>
          </View>
          <Pressable
            accessibilityLabel={`친구방 사진 알림 ${draft.roomPhotoPushEnabled ? '끄기' : '켜기'}`}
            accessibilityRole="switch"
            accessibilityState={{ checked: draft.roomPhotoPushEnabled, disabled: isBusy }}
            disabled={isBusy}
            onPress={() => setDraft((current) => updateRoomPhotoPushEnabled(current, !current.roomPhotoPushEnabled))}
            style={[styles.toggle, draft.roomPhotoPushEnabled && styles.toggleEnabled, isBusy && styles.disabledButton]}>
            <View style={[styles.toggleKnob, draft.roomPhotoPushEnabled && styles.toggleKnobEnabled]} />
          </Pressable>
        </View>

        <AppText style={styles.note}>알림을 켤 때만 기기 권한을 요청해요. 친구방 알림은 development build 또는 출시 앱에서 사용할 수 있어요.</AppText>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable accessibilityLabel="알림 설정 취소" accessibilityRole="button" disabled={isBusy} onPress={onClose} style={[styles.cancelButton, isBusy && styles.disabledButton]}>
          <AppText style={styles.cancelText}>취소</AppText>
        </Pressable>
        <Pressable accessibilityLabel="알림 설정 저장" accessibilityRole="button" accessibilityState={{ disabled: isBusy }} disabled={isBusy} onPress={() => void save()} style={[styles.saveButton, isBusy && styles.disabledButton]}>
          <AppText style={styles.saveText}>{isLoading ? '불러오는 중…' : isSaving ? '저장 중…' : '저장'}</AppText>
        </Pressable>
      </View>
    </AppModal>
  );
}

function getSettingsKey(settings: NotificationSettings): string {
  return `${settings.morning.enabled}:${settings.morning.hour}:${settings.morning.minute}:${settings.evening.enabled}:${settings.evening.hour}:${settings.evening.minute}:${settings.roomPhotoPushEnabled}`;
}

function ReminderRow({ description, disabled, kind, label, onSelectTime, onToggle, reminder }: {
  description: string;
  disabled: boolean;
  kind: ReminderKind;
  label: string;
  onSelectTime: (kind: ReminderKind) => void;
  onToggle: (enabled: boolean) => void;
  reminder: NotificationSettings[ReminderKind];
}) {
  return (
    <View style={styles.reminderRow}>
      <View style={styles.reminderCopy}>
        <AppText style={styles.reminderLabel}>{label}</AppText>
        <AppText style={styles.reminderDescription}>{description}</AppText>
        <Pressable accessibilityLabel={`${label} 시간 선택`} accessibilityRole="button" disabled={disabled} onPress={() => onSelectTime(kind)} style={({ pressed }) => [styles.timeButton, pressed && !disabled && styles.timeButtonPressed, disabled && styles.disabledButton]}>
          <AppText style={styles.timeText}>{getReminderTimeLabel(reminder)}</AppText>
        </Pressable>
      </View>
      <Pressable
        accessibilityLabel={`${label} 알림 ${reminder.enabled ? '끄기' : '켜기'}`}
        accessibilityRole="switch"
        accessibilityState={{ checked: reminder.enabled, disabled }}
        disabled={disabled}
        onPress={() => onToggle(!reminder.enabled)}
        style={[styles.toggle, reminder.enabled && styles.toggleEnabled, disabled && styles.disabledButton]}>
        <View style={[styles.toggleKnob, reminder.enabled && styles.toggleKnobEnabled]} />
      </Pressable>
    </View>
  );
}

function InlineTimePicker({ kind, onChange, reminder }: { kind: ReminderKind; onChange: (date: Date) => void; reminder: NotificationSettings[ReminderKind] }) {
  const changeTime = (hours: number, minutes: number): void => {
    const nextDate = getReminderPickerDate(reminder);
    nextDate.setHours(nextDate.getHours() + hours, nextDate.getMinutes() + minutes);
    onChange(nextDate);
  };

  return (
    <View style={styles.pickerWrap}>
      <AppText style={styles.pickerLabel}>{kind === 'morning' ? '아침 알림 시간' : '저녁 알림 시간'}</AppText>
      <View style={styles.timeControls}>
        <TimeAdjustButton label="한 시간 늦게" onPress={() => changeTime(1, 0)} symbol="+" />
        <View style={styles.timeValue}><AppText style={styles.timeValueText}>{getReminderTimeLabel(reminder)}</AppText><AppText style={styles.timeHint}>시간</AppText></View>
        <TimeAdjustButton label="한 시간 일찍" onPress={() => changeTime(-1, 0)} symbol="−" />
      </View>
      <View style={styles.timeControls}>
        <TimeAdjustButton label="5분 늦게" onPress={() => changeTime(0, 5)} symbol="+" />
        <View style={styles.timeValue}><AppText style={styles.timeValueText}>5분</AppText><AppText style={styles.timeHint}>분 단위</AppText></View>
        <TimeAdjustButton label="5분 일찍" onPress={() => changeTime(0, -5)} symbol="−" />
      </View>
    </View>
  );
}

function TimeAdjustButton({ label, onPress, symbol }: { label: string; onPress: () => void; symbol: '+' | '−' }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.timeAdjustButton, pressed && styles.timeButtonPressed]}><AppText style={styles.timeAdjustText}>{symbol}</AppText></Pressable>;
}

const styles = StyleSheet.create({
  card: { gap: 0, maxHeight: '90%', maxWidth: 440, padding: 0 },
  titleRow: { alignItems: 'flex-start', borderBottomColor: 'rgba(0, 0, 0, 0.18)', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingLeft: spacing[5], paddingRight: spacing[3], paddingVertical: spacing[4] },
  titleCopy: { flex: 1, paddingRight: spacing[3] },
  eyebrow: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 11, letterSpacing: 1.2, lineHeight: 15 },
  title: { color: colors.black, fontSize: 26, fontWeight: '800', lineHeight: 33, marginTop: 2 },
  closeButton: { alignItems: 'center', height: 44, justifyContent: 'center', marginRight: -8, marginTop: -8, width: 44 },
  closeText: { color: colors.black, fontSize: 32, fontWeight: '300', lineHeight: 34 },
  scroll: { flexShrink: 1 },
  content: { gap: spacing[4], padding: spacing[5] },
  description: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  reminderRow: { alignItems: 'center', borderColor: 'rgba(0, 0, 0, 0.16)', borderTopWidth: 1, flexDirection: 'row', gap: spacing[3], justifyContent: 'space-between', paddingTop: spacing[4] },
  reminderCopy: { flex: 1, gap: 3 },
  reminderLabel: { color: colors.black, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  reminderDescription: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  timeButton: { alignSelf: 'flex-start', borderBottomColor: colors.black, borderBottomWidth: 1, marginTop: 6, minHeight: 32, justifyContent: 'center' },
  timeButtonPressed: { opacity: 0.58 },
  timeText: { color: colors.black, fontFamily: 'monospace', fontSize: 13, fontWeight: '700', lineHeight: 18 },
  toggle: { backgroundColor: '#D6D4D0', borderColor: colors.black, borderRadius: 18, borderWidth: 1.5, height: 32, justifyContent: 'center', paddingHorizontal: 3, width: 54 },
  toggleEnabled: { backgroundColor: colors.black },
  toggleKnob: { backgroundColor: colors.white, borderColor: colors.black, borderRadius: 13, borderWidth: 1, height: 24, width: 24 },
  toggleKnobEnabled: { alignSelf: 'flex-end' },
  pickerWrap: { backgroundColor: '#F4F3F0', borderColor: 'rgba(0, 0, 0, 0.15)', borderWidth: 1, gap: spacing[2], padding: spacing[2] },
  pickerLabel: { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 11, marginLeft: spacing[2], marginTop: spacing[2] },
  timeControls: { alignItems: 'center', flexDirection: 'row', gap: spacing[2], justifyContent: 'center' },
  timeAdjustButton: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.black, borderWidth: 1, height: 34, justifyContent: 'center', width: 42 },
  timeAdjustText: { color: colors.black, fontSize: 20, lineHeight: 23 },
  timeValue: { alignItems: 'center', minWidth: 110 },
  timeValueText: { color: colors.black, fontFamily: 'monospace', fontSize: 14, fontWeight: '700', lineHeight: 19 },
  timeHint: { color: colors.textSecondary, fontSize: 10, lineHeight: 14 },
  note: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  actions: { borderTopColor: 'rgba(0, 0, 0, 0.18)', borderTopWidth: 1, flexDirection: 'row', gap: spacing[3], justifyContent: 'flex-end', padding: spacing[4] },
  cancelButton: { alignItems: 'center', borderColor: colors.black, borderWidth: 1.5, justifyContent: 'center', minHeight: 44, minWidth: 88, paddingHorizontal: spacing[3] },
  cancelText: { color: colors.black, fontSize: 14, fontWeight: '700' },
  saveButton: { alignItems: 'center', backgroundColor: colors.black, borderColor: colors.black, borderWidth: 1.5, justifyContent: 'center', minHeight: 44, minWidth: 100, paddingHorizontal: spacing[3] },
  saveText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  disabledButton: { opacity: 0.45 },
});
