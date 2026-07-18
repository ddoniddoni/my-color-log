import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';

import { importGalleryPhoto, type GalleryImportContext } from '@/src/features/camera/api/galleryPhotoRepository';

export function usePhotoSourceSelection() {
  const router = useRouter();
  const [context, setContext] = useState<GalleryImportContext | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGalleryImporting, setIsGalleryImporting] = useState(false);
  const [isSourceModalVisible, setIsSourceModalVisible] = useState(false);

  const openPhotoSource = useCallback((nextContext: GalleryImportContext): void => {
    setContext(nextContext);
    setErrorMessage(null);
    setIsSourceModalVisible(true);
  }, []);

  const closePhotoSource = useCallback((): void => {
    if (isGalleryImporting) return;
    setIsSourceModalVisible(false);
    setErrorMessage(null);
  }, [isGalleryImporting]);

  const chooseCamera = useCallback((): void => {
    if (!context || isGalleryImporting) return;
    setIsSourceModalVisible(false);
    router.push({
      pathname: '/camera',
      params: {
        colorNameEn: context.colorNameEn,
        dateKey: context.dateKey,
        missionId: context.missionId,
        position: String(context.position),
      },
    });
  }, [context, isGalleryImporting, router]);

  const chooseGallery = useCallback(async (): Promise<void> => {
    if (!context || isGalleryImporting) return;
    setErrorMessage(null);
    setIsGalleryImporting(true);
    setIsSourceModalVisible(false);
    try {
      const photo = await importGalleryPhoto(context);
      if (!photo) return;
      router.push({
        pathname: '/photo-review',
        params: {
          colorNameEn: context.colorNameEn,
          photoId: photo.id,
        },
      });
    } catch {
      setErrorMessage('갤러리 사진을 불러오지 못했어요. 다른 사진을 선택해 주세요.');
      setIsSourceModalVisible(true);
    } finally {
      setIsGalleryImporting(false);
    }
  }, [context, isGalleryImporting, router]);

  return {
    chooseCamera,
    chooseGallery,
    closePhotoSource,
    errorMessage,
    isGalleryImporting,
    isSourceModalVisible,
    openPhotoSource,
  };
}
