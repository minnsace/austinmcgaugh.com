import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

async function readFaviconSvg(): Promise<Buffer> {
  const candidates = [
    resolve(process.cwd(), "public/favicon.svg"),
    resolve(process.cwd(), "sites/austin/public/favicon.svg"),
  ];
  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch {
      // Try the next location. Astro's working directory is the site package.
    }
  }
  throw new Error("Could not find public/favicon.svg");
}

export async function faviconPng(size: number): Promise<Buffer> {
  const svg = await readFaviconSvg();
  return sharp(svg).resize(size, size).png().toBuffer();
}

/** ICO container around a PNG. Modern browsers accept this. */
export function icoFromPng(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}
