/**
 * S3 File Discovery
 * Discovers available GeoTIFF files from S3 bucket
 */

import { parseTileFilename, TileInfo } from './S3TileManager';

// const S3_BASE_URL = "https://geotif-for-geospatial.s3.eu-north-1.amazonaws.com/lossyear_tiffs/";

const S3_BASE_URL = "http://localhost:3000/geo-png/";

/**
 * Generate common Hansen tile filenames
 * This generates a comprehensive list of potential tile names based on the Hansen dataset structure
 */
export function generatePotentialTileFilenames(): string[] {
  const filenames: string[] = [];
  
  // Hansen dataset covers most of the world in 10x10 degree tiles
  // Latitude: 80N to 50S (approximately)
  // Longitude: 180W to 180E
  
  for (let lat = -50; lat <= 80; lat += 10) {
    for (let lng = -180; lng < 180; lng += 10) {
      const latAbs = Math.abs(lat);
      const lngAbs = Math.abs(lng);
      const latDir = lat >= 0 ? 'N' : 'S';
      const lngDir = lng >= 0 ? 'E' : 'W';
      
      const latStr = String(latAbs).padStart(2, '0');
      const lngStr = String(lngAbs).padStart(3, '0');
      filenames.push(`Hansen_GFC-2024-v1.12_lossyear_${latStr}${latDir}_${lngStr}${lngDir}.png`);
      // filenames.push(`Hansen_GFC-2020-v1.8_lossyear_${latStr}${latDir}_${lngStr}${lngDir}.png`);
    }
  }
  
  return filenames;
}

/**
 * Check if a file exists in S3 by attempting a HEAD request
 */
async function checkFileExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Discover available tiles from S3
 * This will attempt to check which files actually exist
 */
export async function discoverAvailableTiles(
  onProgress?: (current: number, total: number) => void
): Promise<TileInfo[]> {
  const potentialFilenames = generatePotentialTileFilenames();
  const availableTiles: TileInfo[] = [];
  
  // Check files in batches to avoid overwhelming the browser
  const batchSize = 20;
  
  for (let i = 0; i < potentialFilenames.length; i += batchSize) {
    const batch = potentialFilenames.slice(i, i + batchSize);
    
    const results = await Promise.all(
      batch.map(async (filename) => {
        const url = `${S3_BASE_URL}${filename}`;
        const exists = await checkFileExists(url);
        
        if (exists) {
          const tileInfo = parseTileFilename(filename);
          if (tileInfo) {
            tileInfo.url = url;
            return tileInfo;
          }
        }
        
        return null;
      })
    );
    
    results.forEach(tile => {
      if (tile) {
        availableTiles.push(tile);
      }
    });
    
    if (onProgress) {
      onProgress(i + batchSize, potentialFilenames.length);
    }
  }
  
  return availableTiles;
}

/**
 * Load tile index from a pre-generated manifest (recommended approach)
 * If you have a manifest file listing all available tiles, this is much faster
 */
/**
 * Load tile index from a pre-generated manifest (recommended approach)
 * Supports either a JSON list/object or a newline-separated text file (e.g. `lossyear.txt`).
 *
 * By default this function will NOT fall back to generating all potential filenames
 * if the manifest cannot be fetched (for example a 403 from a private S3 bucket).
 * Generating the potential list will typically cause many failing requests. If you
 * need that behavior, pass { fallbackToPotential: true } in options.
 */
// export async function loadTileManifest(
//   manifestUrl?: string,
//   options?: { fallbackToPotential?: boolean }
// ): Promise<TileInfo[]> {
//   const url = manifestUrl || `${S3_BASE_URL}local_manifest.txt`;

//   try {
//     const response = await fetch(url);

//     if (!response.ok) {
//       // If forbidden or otherwise inaccessible, avoid blind fallback.
//       if (response.status === 403) {
//         console.warn(`Failed to load tile manifest (${response.status}): ${response.statusText}.`);
//         if (!options?.fallbackToPotential) return [];
//         console.warn('options.fallbackToPotential is true — will generate potential filenames (may trigger many failing requests).');
//       } else {
//         throw new Error(`Manifest fetch failed: ${response.status} ${response.statusText}`);
//       }
//     }

//     // Try JSON first, then fall back to plain text list parsing.
//     let filenames: string[] = [];
//     const contentType = response.headers.get('content-type') || '';

//     if (contentType.includes('application/json')) {
//       const data = await response.json();
//       // data may be an array, or an object with `files` property
//       filenames = Array.isArray(data) ? data : (Array.isArray(data.files) ? data.files : []);
//     } else {
//       // Try to parse as JSON anyway (some servers mis-label content-type)
//       try {
//         const maybeJson = await response.clone().json();
//         filenames = Array.isArray(maybeJson) ? maybeJson : (Array.isArray(maybeJson.files) ? maybeJson.files : []);
//       } catch {
//         // Not JSON, treat as newline separated text
//         const text = await response.text();
//         filenames = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
//       }
//     }

//     const tiles: TileInfo[] = [];
//     for (const filename of filenames) {
//       const tileInfo = parseTileFilename(filename);
//       if (tileInfo) {
//         tileInfo.url = `${S3_BASE_URL}${filename.trim().substring(filename.lastIndexOf('/') + 1)}`;
//         tiles.push(tileInfo);
//       }
//     }
//     console.log("Tiles: ", tiles);
    

//     return tiles;
//   } catch (error) {
//     console.error('Failed to load tile manifest:', error);
//     if (options?.fallbackToPotential) {
//       return generatePotentialTileFilenames().map(filename => {
//         const tileInfo = parseTileFilename(filename);
//         if (tileInfo) {
//           tileInfo.url = `${S3_BASE_URL}${filename}`;
//           return tileInfo;
//         }
//         return null;
//       }).filter((t): t is TileInfo => t !== null);
//     }

//     return [];
//   }
// }

export async function loadTileManifest(
  manifestUrl?: string,
  options?: { fallbackToPotential?: boolean }
): Promise<TileInfo[]> {
  // Default: local manifest JSON with PNGs + bounding boxes
  const url = manifestUrl || `${S3_BASE_URL}local_manifest.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to load tile manifest (${response.status}): ${response.statusText}`);
      if (!options?.fallbackToPotential) return [];
      console.warn("Falling back to potential filenames.");
    }

    const contentType = response.headers.get("content-type") || "";
    let data: any;

    // Try to parse JSON regardless of headers
    try {
      data = await response.clone().json();
    } catch {
      console.error("Manifest is not valid JSON.");
      return [];
    }

    // ✅ Expect structure:
    // [
    //   { "filename": "...png", "url": "...", "bbox": [west, north, east, south] }
    // ]
    const tiles: TileInfo[] = [];

    for (const entry of data) {
      if (!entry.url || !entry.bbox) continue;

      const [west, north, east, south] = entry.bbox;
      const centerLat = (north + south) / 2;
      const centerLng = (west + east) / 2;

      tiles.push({
        lat: centerLat,
        lng: centerLng,
        url: entry.url,
        bbox: entry.bbox,
        filename: entry.filename,
      });
    }

    console.log(`Loaded ${tiles.length} PNG tile definitions from manifest`);
    return tiles;
  } catch (error) {
    console.error("Failed to load tile manifest:", error);
    return [];
  }
}

/**
 * Build a simple in-memory tile index
 * This creates a map structure for efficient tile lookup
 */
export function buildTileIndex(tiles: TileInfo[]): Map<string, TileInfo> {
  const index = new Map<string, TileInfo>();
  
  for (const tile of tiles) {
    const key = `${tile.lat},${tile.lng}`;
    index.set(key, tile);
  }
  
  return index;
}
