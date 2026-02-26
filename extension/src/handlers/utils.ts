/**
 * Convert a File/Blob to a JSON-serializable object with base64 data.
 * EasyEDA export APIs return browser File objects which don't survive JSON.stringify.
 */
export async function fileToBase64(
  file: File | Blob | undefined | null,
): Promise<{ fileName?: string; mimeType: string; base64: string; size: number } | null> {
  if (!file) return null;

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  return {
    fileName: file instanceof File ? file.name : undefined,
    mimeType: file.type || 'application/octet-stream',
    base64,
    size: file.size,
  };
}
