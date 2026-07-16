import { parseDailyMission } from '@/src/features/missions/model/dailyMission';
import { formatKstCountdown } from '@/src/features/missions/model/countdown';
import { getMissionRevealStorageKey } from '@/src/features/missions/model/revealState';

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
});
