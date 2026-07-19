import { parseDailyMission, parseMissionRevealPalette } from '@/src/features/missions/model/dailyMission';
import { formatKstCountdown } from '@/src/features/missions/model/countdown';
import { getMissionRevealStorageKey } from '@/src/features/missions/model/revealState';
import { getRevealTargetRotation, MISSION_REVEAL_SLOT_COUNT } from '@/src/features/missions/model/missionRevealWheel';

const missionRow = {
  id: 'mission-id', challenge_date: '2026-07-16', mission_type: 'color', title_ko: '오늘의 체리 레드', prompt_ko: '오늘 스쳐 간 빨강을 찾아보세요.', published_at: '2026-07-15T15:00:00.000Z', source: 'scheduled', color_id: 'color-id', color_slug: 'cherry-red', color_name_ko: '체리 레드', color_name_en: 'Cherry Red', color_hex: '#D94A4A', color_tint_hex: '#F9E6E6', color_shade_hex: '#8D2727', color_on_color_hex: '#FFFFFF',
};

describe('daily mission mapping', () => {
  it('maps only a valid server-defined color mission', () => {
    expect(parseDailyMission(missionRow)).toMatchObject({ id: 'mission-id', missionType: 'color', color: { nameKo: '체리 레드', accent: '#D94A4A' } });
  });

  it('rejects a malformed mission response', () => {
    expect(() => parseDailyMission({ ...missionRow, color_hex: null })).toThrow('Invalid daily mission response');
  });
});

describe('mission reveal state', () => {
  it('uses a versioned, date-scoped local storage key', () => {
    expect(getMissionRevealStorageKey('2026-07-16')).toBe('@mycolorlog/mission-reveal/v1/2026-07-16');
  });

  it('formats the KST countdown readably', () => {
    expect(formatKstCountdown(3_661_000)).toBe('01:01:01');
  });

  it('accepts ten distinct server-provided wheel colors', () => {
    const palette = Array.from({ length: MISSION_REVEAL_SLOT_COUNT }, (_, position) => ({
      color_id: `color-${position}`,
      color_slug: `color-${position}`,
      color_name_ko: `색 ${position}`,
      color_name_en: `Color ${position}`,
      color_hex: '#123456',
      color_on_color_hex: '#FFFFFF',
    }));

    expect(parseMissionRevealPalette(palette)).toHaveLength(MISSION_REVEAL_SLOT_COUNT);
    expect(() => parseMissionRevealPalette([...palette.slice(0, MISSION_REVEAL_SLOT_COUNT - 1), palette[0]])).toThrow('Invalid mission reveal palette response');
  });

  it('lands a selected wheel segment under the pointer after full turns', () => {
    expect(getRevealTargetRotation(0)).toBe(1_782);
    expect(getRevealTargetRotation(9)).toBe(1_458);
    expect(() => getRevealTargetRotation(10)).toThrow('invalid_reveal_wheel_slot');
  });
});
