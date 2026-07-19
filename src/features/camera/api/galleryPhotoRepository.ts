import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

import { saveCapturedPhotoForReview } from '@/src/features/camera/api/localPhotoRepository';
import { isColorHex } from '@/src/features/camera/model/colorIsolation';
import { type PendingPhoto } from '@/src/features/sync/model/pendingPhoto';

const GALLERY_IMPORT_CONTEXT_STORAGE_KEY = '@mycolorlog/gallery-import-context/v1';

export type GalleryImportContext = {
  colorHex: string;
  colorNameEn: string;
  dateKey: string;
  missionId: string;
  position: number;
  userId: string;
};

export type RecoveredGalleryImport = {
  colorHex: string;
  colorNameEn: string;
  photo: PendingPhoto;
};

export async function importGalleryPhoto(context: GalleryImportContext): Promise<PendingPhoto | null> {
  await persistImportContext(context);

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      exif: false,
      mediaTypes: ['images'],
      quality: 1,
      selectionLimit: 1,
    });
    if (result.canceled) {
      await clearImportContext();
      return null;
    }

    const photo = await savePickedAsset(result.assets[0], context);
    await clearImportContext();
    return photo;
  } catch (error) {
    await clearImportContext();
    throw error;
  }
}

export async function recoverPendingGalleryImport(): Promise<RecoveredGalleryImport | null> {
  const context = await readImportContext();
  if (!context) return null;

  const result = await ImagePicker.getPendingResultAsync();
  if (!result) return null;
  if ('code' in result || result.canceled) {
    await clearImportContext();
    return null;
  }

  try {
    const photo = await savePickedAsset(result.assets[0], context);
    await clearImportContext();
    return { colorHex: context.colorHex, colorNameEn: context.colorNameEn, photo };
  } catch (error) {
    await clearImportContext();
    throw error;
  }
}

async function savePickedAsset(asset: ImagePicker.ImagePickerAsset | undefined, context: GalleryImportContext): Promise<PendingPhoto> {
  if (!asset || !isValidPickedImage(asset)) throw new Error('gallery_photo_invalid');

  return saveCapturedPhotoForReview({
    dateKey: context.dateKey,
    missionId: context.missionId,
    position: context.position,
    sourceHeight: asset.height,
    sourceUri: asset.uri,
    sourceWidth: asset.width,
    userId: context.userId,
  });
}

async function persistImportContext(context: GalleryImportContext): Promise<void> {
  await AsyncStorage.setItem(GALLERY_IMPORT_CONTEXT_STORAGE_KEY, JSON.stringify(context));
}

async function clearImportContext(): Promise<void> {
  await AsyncStorage.removeItem(GALLERY_IMPORT_CONTEXT_STORAGE_KEY);
}

async function readImportContext(): Promise<GalleryImportContext | null> {
  const rawValue = await AsyncStorage.getItem(GALLERY_IMPORT_CONTEXT_STORAGE_KEY);
  if (!rawValue) return null;

  try {
    const value: unknown = JSON.parse(rawValue);
    return isGalleryImportContext(value) ? value : null;
  } catch {
    return null;
  }
}

function isValidPickedImage(asset: ImagePicker.ImagePickerAsset): boolean {
  return typeof asset.uri === 'string'
    && asset.uri.length > 0
    && Number.isFinite(asset.width)
    && asset.width > 0
    && Number.isFinite(asset.height)
    && asset.height > 0;
}

function isGalleryImportContext(value: unknown): value is GalleryImportContext {
  if (typeof value !== 'object' || value === null) return false;
  const context = value as Record<string, unknown>;
  return isColorHex(context.colorHex)
    && typeof context.colorNameEn === 'string'
    && typeof context.dateKey === 'string'
    && typeof context.missionId === 'string'
    && typeof context.position === 'number'
    && Number.isInteger(context.position)
    && context.position >= 1
    && context.position <= 9
    && typeof context.userId === 'string';
}
