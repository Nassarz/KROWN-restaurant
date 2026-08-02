/**
 * Image Upload Helper with Live Preview & ImgBB Cloud API integration
 */

export interface UploadResult {
  url: string;
  previewUrl?: string;
  error?: string;
}

export async function uploadImageFile(file: File): Promise<UploadResult> {
  if (!file) {
    return { url: '', error: 'No file provided' };
  }

  // Generate instant Base64 data URL for local UI preview thumbnail
  const previewUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (response.ok && data.url) {
      return { url: data.url, previewUrl };
    } else {
      console.warn('[ImageUpload] Cloud upload fallback to preview URL:', data.error);
      return { url: previewUrl, previewUrl };
    }
  } catch (err: any) {
    console.warn('[ImageUpload] Upload error fallback to preview URL:', err?.message || err);
    return { url: previewUrl, previewUrl };
  }
}
