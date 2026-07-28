import * as SecureStore from 'expo-secure-store';

export type KeyValueStorage = {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

const CHUNK_SIZE = 900;
const MANIFEST_VERSION = 1;

type StorageManifest = {
  chunkCount: number;
  generation: string;
  version: typeof MANIFEST_VERSION;
};

export function createChunkedStorageAdapter(storage: KeyValueStorage, createGeneration: () => string = createStorageGeneration): KeyValueStorage {
  return {
    async getItem(key: string): Promise<string | null> {
      const storedValue = await storage.getItem(key);
      if (storedValue === null) return null;

      const manifest = parseManifest(storedValue);
      if (manifest === null) return storedValue;

      const chunks = await Promise.all(
        Array.from({ length: manifest.chunkCount }, (_, index) => storage.getItem(getChunkKey(key, manifest.generation, index))),
      );
      if (chunks.some((chunk) => chunk === null)) throw new Error('secure_storage_chunk_missing');
      return chunks.join('');
    },

    async setItem(key: string, value: string): Promise<void> {
      const previousManifest = parseManifest(await storage.getItem(key));
      const generation = createGeneration();
      const chunks = splitIntoChunks(value);

      await Promise.all(chunks.map((chunk, index) => storage.setItem(getChunkKey(key, generation, index), chunk)));
      await storage.setItem(key, JSON.stringify({ chunkCount: chunks.length, generation, version: MANIFEST_VERSION } satisfies StorageManifest));

      if (previousManifest !== null) {
        await Promise.all(
          Array.from(
            { length: previousManifest.chunkCount },
            (_, index) => storage.removeItem(getChunkKey(key, previousManifest.generation, index)),
          ),
        );
      }
    },

    async removeItem(key: string): Promise<void> {
      const manifest = parseManifest(await storage.getItem(key));
      if (manifest !== null) {
        await Promise.all(
          Array.from(
            { length: manifest.chunkCount },
            (_, index) => storage.removeItem(getChunkKey(key, manifest.generation, index)),
          ),
        );
      }
      await storage.removeItem(key);
    },
  };
}

const nativeSecureStorage: KeyValueStorage = {
  getItem: (key: string): Promise<string | null> => SecureStore.getItemAsync(key),
  removeItem: (key: string): Promise<void> => SecureStore.deleteItemAsync(key),
  setItem: (key: string, value: string): Promise<void> => SecureStore.setItemAsync(key, value),
};

export const secureStorage = createChunkedStorageAdapter(nativeSecureStorage);

function createStorageGeneration(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getChunkKey(key: string, generation: string, index: number): string {
  return `${key}.__chunk__.${generation}.${index}`;
}

function parseManifest(value: string | null): StorageManifest | null {
  if (value === null) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isStorageManifest(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isStorageManifest(value: unknown): value is StorageManifest {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.version === MANIFEST_VERSION
    && typeof candidate.generation === 'string'
    && candidate.generation.length > 0
    && typeof candidate.chunkCount === 'number'
    && Number.isInteger(candidate.chunkCount)
    && candidate.chunkCount > 0;
}

function splitIntoChunks(value: string): string[] {
  const chunks: string[] = [];
  for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
    chunks.push(value.slice(offset, offset + CHUNK_SIZE));
  }
  return chunks.length > 0 ? chunks : [''];
}
