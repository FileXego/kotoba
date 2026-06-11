export const IMAGE_MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function imageExtForMime(mime: string) {
  return IMAGE_MIME_EXT[mime] ?? null;
}

export async function hasExpectedImageSignature(file: File) {
  const ext = imageExtForMime(file.type);
  if (!ext) return false;

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (file.type === "image/png") {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return png.every((byte, i) => head[i] === byte);
  }
  if (file.type === "image/jpeg") {
    return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  }
  if (file.type === "image/webp") {
    return asciiAt(head, 0, "RIFF") && asciiAt(head, 8, "WEBP");
  }
  return false;
}

function asciiAt(bytes: Uint8Array, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}
