import { createChunkedStorageAdapter, type KeyValueStorage } from '@/src/lib/supabase/storage';

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

describe('chunked secure storage adapter', () => {
  it('round-trips values that exceed a single SecureStore entry', async () => {
    const storage = new MemoryStorage();
    const adapter = createChunkedStorageAdapter(storage, () => 'first');
    const value = 'a'.repeat(2_200);

    await adapter.setItem('session', value);

    expect(storage.values.get('session')).toBe(JSON.stringify({ chunkCount: 3, generation: 'first', version: 1 }));
    expect(Array.from(storage.values.keys()).every((key) => /^[A-Za-z0-9._-]+$/.test(key))).toBe(true);
    await expect(adapter.getItem('session')).resolves.toBe(value);
  });

  it('continues to read a legacy single-value entry', async () => {
    const storage = new MemoryStorage();
    storage.values.set('session', 'legacy-session');
    const adapter = createChunkedStorageAdapter(storage, () => 'first');

    await expect(adapter.getItem('session')).resolves.toBe('legacy-session');
  });

  it('cleans up a previous chunk generation after replacing a value', async () => {
    const storage = new MemoryStorage();
    const generations = ['first', 'second'];
    const adapter = createChunkedStorageAdapter(storage, () => {
      const generation = generations.shift();
      if (!generation) throw new Error('missing_test_generation');
      return generation;
    });

    await adapter.setItem('session', 'a'.repeat(1_000));
    await adapter.setItem('session', 'new-session');

    expect(Array.from(storage.values.keys()).sort()).toEqual(['session', 'session.__chunk__.second.0']);
    await expect(adapter.getItem('session')).resolves.toBe('new-session');
  });

  it('removes the manifest and every referenced chunk', async () => {
    const storage = new MemoryStorage();
    const adapter = createChunkedStorageAdapter(storage, () => 'first');

    await adapter.setItem('session', 'a'.repeat(1_000));
    await adapter.removeItem('session');

    expect(storage.values.size).toBe(0);
  });
});
