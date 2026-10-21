import { parseDailyMission, parseMissionRevealPalette } from '@/src/features/missions/model/dailyMission';
import { formatCountdown } from '@/src/features/missions/model/countdown';
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

  it.each([
    ['royal-purple', '로열 퍼플', 'Royal Purple', '#7B2FD0', '#F0E5FC', '#49177F'],
    ['deep-wine', '딥 와인', 'Deep Wine', '#8B1E4B', '#F6E3EB', '#56102C'],
  ])('preserves the server identity and display tokens of %s', (slug, nameKo, nameEn, accent, tint, shade) => {
    const mission = parseDailyMission({ ...missionRow, color_id: slug, color_slug: slug, color_name_ko: nameKo, color_name_en: nameEn, color_hex: accent, color_tint_hex: tint, color_shade_hex: shade });
    expect(mission.color).toEqual({ id: slug, slug, nameKo, nameEn, accent, accentTint: tint, accentShade: shade, onAccent: '#FFFFFF' });
  });
});

describe('mission reveal state', () => {
  it('uses a versioned, date-scoped local storage key', () => {
    expect(getMissionRevealStorageKey('owner', '2026-07-16')).toBe('@mycolorlog/mission-reveal/v2/owner/2026-07-16');
    expect(getMissionRevealStorageKey('friend', '2026-07-16')).not.toBe(getMissionRevealStorageKey('owner', '2026-07-16'));
  });

  it('formats the countdown readably', () => {
    expect(formatCountdown(3_661_000)).toBe('01:01:01');
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
    expect(getRevealTargetRotation(0)).toBe(702);
    expect(getRevealTargetRotation(9)).toBe(378);
    expect(() => getRevealTargetRotation(10)).toThrow('invalid_reveal_wheel_slot');
  });

  it('accepts an inactive historical target with new decoys and lands every server slot correctly', () => {
    const names = ['coral-pink', 'royal-purple', 'deep-wine', 'tomato-red', 'tangerine-orange', 'lemon-yellow', 'leaf-green', 'mint-green', 'sky-blue', 'clear-blue'];
    const palette = parseMissionRevealPalette(names.map((slug, index) => ({
      wheel_position: index, color_id: slug, color_slug: slug, color_name_ko: slug, color_name_en: slug,
      color_hex: index === 1 ? '#7B2FD0' : index === 2 ? '#8B1E4B' : '#F06278', color_on_color_hex: '#FFFFFF',
    })));
    expect(palette.map((color) => color.id)).toEqual(names);
    for (let index = 0; index < palette.length; index += 1) {
      const segmentCenter = (index + 0.5) * 360 / palette.length;
      expect((getRevealTargetRotation(index) + segmentCenter) % 360).toBe(0);
    }
  });
});
