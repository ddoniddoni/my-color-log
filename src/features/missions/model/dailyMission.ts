export type DailyAccent = { accent: string; accentTint: string; accentShade: string; onAccent: string };

export type DailyMission = {
  id: string;
  challengeDate: string;
  missionType: 'color';
  titleKo: string;
  promptKo: string;
  publishedAt: string;
  source: 'manual' | 'scheduled' | 'fallback';
  color: DailyAccent & { id: string; slug: string; nameKo: string; nameEn: string };
};

export function parseDailyMission(value: unknown): DailyMission {
  if (!isRecord(value) || !isColorMissionRow(value)) throw new Error('Invalid daily mission response');
  return {
    id: value.id,
    challengeDate: value.challenge_date,
    missionType: 'color',
    titleKo: value.title_ko,
    promptKo: value.prompt_ko,
    publishedAt: value.published_at,
    source: value.source,
    color: {
      id: value.color_id,
      slug: value.color_slug,
      nameKo: value.color_name_ko,
      nameEn: value.color_name_en,
      accent: value.color_hex,
      accentTint: value.color_tint_hex,
      accentShade: value.color_shade_hex,
      onAccent: value.color_on_color_hex,
    },
  };
}

function isColorMissionRow(value: Record<string, unknown>): value is Record<string, string> & { source: 'manual' | 'scheduled' | 'fallback' } {
  const requiredStringKeys = ['id', 'challenge_date', 'title_ko', 'prompt_ko', 'published_at', 'color_id', 'color_slug', 'color_name_ko', 'color_name_en', 'color_hex', 'color_tint_hex', 'color_shade_hex', 'color_on_color_hex'];
  return value.mission_type === 'color' && (value.source === 'manual' || value.source === 'scheduled' || value.source === 'fallback') && requiredStringKeys.every((key) => typeof value[key] === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
