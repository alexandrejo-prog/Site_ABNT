/**
 * C10 — validação de imagem anexada (ficha catalográfica e afins):
 * tipo real via magic bytes (não confia só no MIME), limite de tamanho e
 * leitura de dimensões sem depender de decodificação completa (fallback
 * quando `createImageBitmap` não está disponível ou falha).
 */

export const MAX_FICHA_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

/** PNG/JPEG/WebP — os formatos aceitos pelo input (`accept`). */
export function isValidImageBytes(data: Uint8Array): boolean {
  if (!data || data.length < 12) return false;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return true;
  // JPEG: FF D8 FF
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return true;
  // WebP: "RIFF" .... "WEBP"
  const riff = String.fromCharCode(data[0], data[1], data[2], data[3]);
  const webp = String.fromCharCode(data[8], data[9], data[10], data[11]);
  if (riff === "RIFF" && webp === "WEBP") return true;
  return false;
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 8) | bytes[offset + 1]) >>> 0;
}

/**
 * Lê as dimensões diretamente dos cabeçalhos (PNG IHDR / JPEG SOF) — fallback
 * sem decodificação completa, usado quando `createImageBitmap` falha. Retorna
 * undefined quando não for possível; o chamador usa o padrão do exportador.
 */
export function readImageDimensions(data: Uint8Array): { width?: number; height?: number } {
  // PNG: IHDR a partir do byte 8; largura em 16..19, altura em 20..23 (BE).
  if (isValidImageBytes(data) && data[0] === 0x89 && data[1] === 0x50) {
    if (data.length >= 24) {
      return { width: readUint32BE(data, 16), height: readUint32BE(data, 20) };
    }
    return {};
  }
  // JPEG: percorrer segmentos marcados (FF xx) procurando SOF0/1/2 (C0/C1/C2).
  if (isValidImageBytes(data) && data[0] === 0xff && data[1] === 0xd8) {
    let i = 2;
    while (i + 9 < data.length) {
      if (data[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = data[i + 1];
      // Standalone markers sem tamanho
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const segLen = readUint16BE(data, i + 2);
      if (segLen < 2) break;
      // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15 (exceto DHT C4 / JPG C8 / DAC CC)
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof && i + 9 < data.length) {
        return { height: readUint16BE(data, i + 5), width: readUint16BE(data, i + 7) };
      }
      i += 2 + segLen;
    }
    return {};
  }
  return {};
}
