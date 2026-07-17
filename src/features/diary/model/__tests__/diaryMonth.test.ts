import { getDiaryEntryMemo, parseDiaryMonthRows } from '@/src/features/diary/model/diaryMonth';

const colorFields = {
  color_id: 'color-id',
  color_slug: 'apricot-orange',
  color_name_ko: '살구 오렌지',
  color_name_en: 'Apricot Orange',
  color_hex: '#E98B4A',
  color_tint_hex: '#FBEBDD',
  color_shade_hex: '#9D5428',
  color_on_color_hex: '#1D1C1A',
};

describe('parseDiaryMonthRows', () => {
  it('groups photo rows by daily entry and uses private signed URLs', () => {
    const rows = [
      {
        entry_id: 'entry-1', mission_id: 'mission-1', date_key: '2026-07-17', note: null, ...colorFields,
        photo_id: 'photo-1', storage_path: 'user/2026-07-17/photo-1.jpg', photo_position: 1, photo_caption: '첫 장면', captured_at: '2026-07-17T01:00:00.000Z', width: 1200, height: 900, byte_size: 1024,
      },
      {
        entry_id: 'entry-1', mission_id: 'mission-1', date_key: '2026-07-17', note: null, ...colorFields,
        photo_id: 'photo-2', storage_path: 'user/2026-07-17/photo-2.jpg', photo_position: 2, photo_caption: null, captured_at: '2026-07-17T02:00:00.000Z', width: 1200, height: 900, byte_size: 1024,
      },
    ];

    const entries = parseDiaryMonthRows(rows, new Map([
      ['user/2026-07-17/photo-1.jpg', 'https://signed.example/photo-1'],
      ['user/2026-07-17/photo-2.jpg', 'https://signed.example/photo-2'],
    ]));

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ dateKey: '2026-07-17', color: { nameKo: '살구 오렌지' } });
    expect(entries[0].photos).toEqual([
      expect.objectContaining({ id: 'photo-1', signedUrl: 'https://signed.example/photo-1', caption: '첫 장면' }),
      expect.objectContaining({ id: 'photo-2', signedUrl: 'https://signed.example/photo-2' }),
    ]);
    expect(getDiaryEntryMemo(entries[0])).toBe('첫 장면');
  });

  it('keeps an entry without a remote photo row as an empty day', () => {
    const rows = [{
      entry_id: 'entry-2', mission_id: 'mission-2', date_key: '2026-07-16', note: '아직 업로드 대기', ...colorFields,
      photo_id: null, storage_path: null, photo_position: null, photo_caption: null, captured_at: null, width: null, height: null, byte_size: null,
    }];

    const entries = parseDiaryMonthRows(rows, new Map());

    expect(entries).toEqual([expect.objectContaining({ dateKey: '2026-07-16', note: '아직 업로드 대기', photos: [] })]);
    expect(getDiaryEntryMemo(entries[0])).toBe('아직 업로드 대기');
  });
});
