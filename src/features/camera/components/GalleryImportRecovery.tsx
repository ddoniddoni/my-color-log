import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { recoverPendingGalleryImport } from '@/src/features/camera/api/galleryPhotoRepository';

export function GalleryImportRecovery() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const recover = async (): Promise<void> => {
      try {
        const recovered = await recoverPendingGalleryImport();
        if (!recovered || !isMounted) return;
        router.replace({
          pathname: '/photo-review',
          params: {
            colorNameEn: recovered.colorNameEn,
            photoId: recovered.photo.id,
          },
        });
      } catch {
        // The system picker is already closed. The user can select the image again from the source sheet.
      }
    };

    void recover();
    return () => {
      isMounted = false;
    };
  }, [router]);

  return null;
}
