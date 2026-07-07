/**
 * Trigger a browser download for an in-memory Blob.
 *
 * Single source of truth for the object-URL lifecycle (create → click → revoke) shared
 * by every client-side export (composite reports: Excel/CSV/HTML/PDF; dashboard PDF).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
