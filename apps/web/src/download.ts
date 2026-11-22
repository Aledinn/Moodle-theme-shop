import { ApiError } from "./api";

const maxBytes = 262_144;

// Keep the server's portable attachment byte-for-byte. The Go endpoint validates
// the contract before sending it; this adapter checks transport before saving.
export async function fetchThemeDownload(id: string, signal: AbortSignal) {
  const response = await fetch(`/api/themes/${encodeURIComponent(id)}/download`, {
    signal,
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new ApiError(
      response.status === 404
        ? "This theme is no longer available. Return to the catalog to choose another."
        : "The theme file could not be downloaded. Please try again.",
      response.status,
      "download_failed",
    );
  }
  const attachment = /^attachment;\s*filename="(theme-[0-9]{1,19}\.json)"$/i.exec(
    response.headers.get("Content-Disposition") ?? "",
  );
  if (
    response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json" ||
    !attachment || !response.body
  ) {
    throw new Error("The service did not return a theme JSON attachment. Please try again.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("The theme file exceeds the 256 KiB limit.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  signal.throwIfAborted();
  if (!size) throw new Error("The service returned an empty theme file. Please try again.");
  return { blob: new Blob(chunks, { type: "application/json" }), filename: attachment[1] };
}

export function saveThemeDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  try {
    link.click();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  } finally {
    link.remove();
  }
  // Allow the browser time to consume the URL; a click cannot prove a saved file.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
