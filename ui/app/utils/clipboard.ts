/**
 * Copies the provided text to the system clipboard.
 * Falls back to a hidden textarea if the modern Clipboard API is not available.
 * 
 * @param text The string to copy.
 * @returns A promise that resolves to true if successful, false otherwise.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!import.meta.client) return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback to execCommand below.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  let success = false;
  try {
    success = document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }

  return success;
}
