import { Assets, Texture } from 'pixi.js';
import manifestJson from '../generated/assetManifest.json';

export interface AssetRecord {
  id: string;
  url: string;
  role: string;
  species?: string;
  variant?: 'base' | 'rare';
  source: string;
  sourceSize: { width: number; height: number };
  /** Region of the original canvas that the processed image covers. */
  crop: { left: number; top: number; width: number; height: number };
  /** Processed image size in pixels. */
  size: { width: number; height: number };
  /** Processed pixels per original pixel. */
  scale: number;
}

export const manifest = manifestJson as unknown as { assets: Record<string, AssetRecord> };

export function asset(id: string): AssetRecord {
  const record = manifest.assets[id];
  if (!record) throw new Error(`Asset "${id}" is not in the manifest. Run "npm run assets".`);
  return record;
}

/** Public URL for an asset (for <img> tags in the UI). */
export function assetUrl(id: string): string {
  return `${import.meta.env.BASE_URL}${asset(id).url}`;
}

/**
 * Converts a point measured on the ORIGINAL artwork canvas into a sprite anchor
 * (0..1) on the processed texture. Lets the layout refer to points like
 * "the heart of the tree" using coordinates read straight off the original file.
 */
export function anchorFromSource(id: string, sx: number, sy: number): { x: number; y: number } {
  const a = asset(id);
  return { x: (sx - a.crop.left) / a.crop.width, y: (sy - a.crop.top) / a.crop.height };
}

/** Loads every texture the scene needs. Missing files are reported, not ignored. */
export async function loadTextures(ids: string[]): Promise<Map<string, Texture>> {
  const textures = new Map<string, Texture>();
  const missing: string[] = [];
  await Promise.all(
    ids.map(async (id) => {
      try {
        const tex = await Assets.load<Texture>(assetUrl(id));
        // mipmaps keep the large pixel-art textures crisp and shimmer-free when shown smaller
        tex.source.autoGenerateMipmaps = true;
        tex.source.updateMipmaps();
        textures.set(id, tex);
      } catch {
        missing.push(id);
      }
    }),
  );
  if (missing.length) console.error(`[Familiar Grove] Missing images: ${missing.join(', ')}`);
  return textures;
}
