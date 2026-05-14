/**
 * Race a promise against a timeout. Several EasyEDA Pro 0.2.29 document-level APIs
 * (auto-route, auto-layout, clearRouting, getPrimitiveAtPoint/InRegion, drc.setRules,
 * PrimitiveString.create) never resolve their promises. Without this guard the bridge
 * would hang for the full 30–120s command timeout. Fail fast with a clear message instead.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(
          `${label} did not respond within ${ms}ms — this EasyEDA Pro 0.2.29 API `
          + `appears to be non-functional or requires manual interaction in the EasyEDA window.`,
        )),
        ms,
      ),
    ),
  ]);
}

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
