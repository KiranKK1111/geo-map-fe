/**
 * S3 Tile Manager
 * Manages discovery and mapping of PNG (or GeoTIFF) tiles
 */

export interface TileInfo {
  filename: string;
  url: string;
  lat: number;
  lng: number;
  latDir?: 'N' | 'S';
  lngDir?: 'E' | 'W';
  bbox?: [number, number, number, number]; // [west, north, east, south]
}

/**
 * Parse Hansen-style filenames (still supported for fallback)
 * Expected format: Hansen_GFC-2020-v1.8_lossyear_10N_080W.(tif|png)
 */
export function parseTileFilename(filename: string): TileInfo | null {
  const match = filename.match(/Hansen_GFC-\d{4}-v\d+\.\d+_lossyear_(\d{2})(N|S)_(\d{3})(E|W)\.(tif|png)$/i);

  if (!match) return null;

  const lat = parseInt(match[1]);
  const latDir = match[2].toUpperCase() as 'N' | 'S';
  const lng = parseInt(match[3]);
  const lngDir = match[4].toUpperCase() as 'E' | 'W';

  const signedLat = latDir === 'S' ? -lat : lat;
  const signedLng = lngDir === 'W' ? -lng : lng;

  // Default Hansen tile covers 10x10°
  // return {
  //   filename,
  //   url: filename,
  //   lat: signedLat,
  //   lng: signedLng,
  //   latDir,
  //   lngDir,
  //   bbox: [signedLng, signedLat + 10, signedLng + 10, signedLat], // [west, north, east, south]
  // };

  return {
    filename,
    url: filename,
    lat: latDir === 'S' ? -lat : lat,
    lng: lngDir === 'W' ? -lng : lng,
    latDir,
    lngDir,
    bbox: [
      lngDir === 'W' ? -lng : lng,      // west
      latDir === 'N' ? lat + 10 : -lat, // north
      lngDir === 'W' ? -(lng - 10) : lng + 10, // east
      latDir === 'N' ? lat : -(lat + 10),      // south
    ],
  };
}

/**
 * Find tile for given lat/lng
 */
export function findTileForCoordinates(lat: number, lng: number, availableTiles: TileInfo[]): TileInfo | null {
  for (const tile of availableTiles) {
    if (!tile.bbox) continue;
    const [west, north, east, south] = tile.bbox;
    if (lng >= west && lng <= east && lat >= south && lat <= north) {
      return tile;
    }
  }
  return null;
}

/**
 * Get all tiles intersecting given bounds
 */
export function findTilesForBounds(
  bounds: { north: number; south: number; east: number; west: number },
  availableTiles: TileInfo[]
): TileInfo[] {
  return availableTiles.filter(tile => {
    if (!tile.bbox) return false;
    const [west, north, east, south] = tile.bbox;
    return (
      east >= bounds.west &&
      west <= bounds.east &&
      north >= bounds.south &&
      south <= bounds.north
    );
  });
}

/**
 * Spatial index for quick lookup by coordinate or bounding box
 */
export class TileSpatialIndex {
  private tiles: TileInfo[];

  constructor(tiles: TileInfo[]) {
    this.tiles = tiles;
  }

  getTile(lat: number, lng: number): TileInfo | null {
    return findTileForCoordinates(lat, lng, this.tiles);
  }

  getTilesForBounds(bounds: { north: number; south: number; east: number; west: number }): TileInfo[] {
    return findTilesForBounds(bounds, this.tiles);
  }

  getAllTiles(): TileInfo[] {
    return this.tiles;
  }
}
