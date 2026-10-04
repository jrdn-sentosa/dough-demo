/**
 * Sends the share picture out of the app: the phone's share sheet when it can take the image, otherwise a
 * download. "Copy text" is separate and always available. Nothing is stored or sent anywhere else.
 */

export interface ShareEnv {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  writeText?: (text: string) => Promise<void>;
  /** Saves the file on the device. */
  download: (blob: Blob, fileName: string) => void;
  /** Old-browser copy (a hidden text field). Returns whether it worked. */
  copyFallback: (text: string) => boolean;
}

/** `shared`: the share sheet took it. `downloaded`: saved instead. `cancelled`: the student closed the share sheet. */
export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

export interface ShareRequest {
  blob: Blob;
  fileName: string;
  text: string;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function copyWithTextField(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

export function browserShareEnv(): ShareEnv {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  return {
    share: nav && typeof nav.share === 'function' ? (data) => nav.share(data) : undefined,
    canShare: nav && typeof nav.canShare === 'function' ? (data) => nav.canShare(data) : undefined,
    writeText: nav?.clipboard && typeof nav.clipboard.writeText === 'function' ? (text) => nav.clipboard.writeText(text) : undefined,
    download: downloadBlob,
    copyFallback: copyWithTextField,
  };
}

function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

/** Shares the picture with the share sheet when the device can send files, and downloads it when it can't. */
export async function shareCard({ blob, fileName, text }: ShareRequest, env: ShareEnv = browserShareEnv()): Promise<ShareResult> {
  const file = new File([blob], fileName, { type: blob.type || 'image/png' });
  const data: ShareData = { files: [file], text };
  if (env.share && env.canShare?.(data)) {
    try {
      await env.share(data);
      return 'shared';
    } catch (error) {
      if (isAbort(error)) return 'cancelled';
      // Any other refusal (for example the tap was too long ago): fall through to saving the picture.
    }
  }
  env.download(blob, fileName);
  return 'downloaded';
}

/** Copies the share text. Returns false when neither way worked, so the screen can say so. */
export async function copyShareText(text: string, env: ShareEnv = browserShareEnv()): Promise<boolean> {
  if (env.writeText) {
    try {
      await env.writeText(text);
      return true;
    } catch {
      // Fall back below.
    }
  }
  return env.copyFallback(text);
}
