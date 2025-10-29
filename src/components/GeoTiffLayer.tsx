import L from "leaflet";
import { GeoTIFFCache } from "./GeoTIFFCache";
import { createColorLUT } from "./ForestLossColors";
import { TileSpatialIndex } from "./S3TileManager";

// Custom GeoTIFF tile layer with dynamic loading
export class GeoTiffLayer extends L.GridLayer {
  private cache: GeoTIFFCache;
  private colorLUT: Uint8ClampedArray;
  private loadingTiles: Set<string> = new Set();
  private loadedTileCount: number = 0;
  private tileIndex: TileSpatialIndex;

  constructor(tileIndex: TileSpatialIndex, options: any) {
    super(options);
    this.tileIndex = tileIndex;
    this.cache = new GeoTIFFCache(200); // 200MB cache
    this.colorLUT = createColorLUT();
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement("canvas");
    const tileSize = this.getTileSize();
    tile.width = tileSize.x;
    tile.height = tileSize.y;

    const ctx = tile.getContext("2d");
    if (!ctx) {
      done(new Error("Could not get canvas context"), tile);
      return tile;
    }

    // Load and render the tile asynchronously
    this.loadAndRenderTile(ctx, coords, tileSize, done);

    return tile;
  }

  private async loadAndRenderTile(
    ctx: CanvasRenderingContext2D,
    coords: L.Coords,
    tileSize: L.Point,
    done: L.DoneCallback
  ): Promise<void> {
    try {
      // Convert tile coordinates to geographic bounds
      const bounds = this.getTileBounds(coords);

      // Get center point of tile
      const centerLat = (bounds.north + bounds.south) / 2;
      const centerLng = (bounds.east + bounds.west) / 2;

      // Find the appropriate GeoTIFF tile from our index
      const tile = this.tileIndex.getTile(centerLat, centerLng);

      if (!tile) {
        // No data for this area, render transparent
        done(null, ctx.canvas);
        return;
      }

      const tileKey = `${coords.z}/${coords.x}/${coords.y}`;

      if (this.loadingTiles.has(tileKey)) {
        done(null, ctx.canvas);
        return;
      }

      this.loadingTiles.add(tileKey);

      const url = tile.url;
      // const tiff = await this.cache.loadTiff(url);

      // if (!tiff) {
      //   // File not found or error loading, render empty
      //   this.loadingTiles.delete(tileKey);
      //   done(null, ctx.canvas);
      //   return;
      // }

      // 🔹 Detect if this is a PNG tile instead of a GeoTIFF
      // if (url.toLowerCase().endsWith(".png")) {
      //   const img = new Image();
      //   img.crossOrigin = "anonymous";
      //   img.onload = () => {
      //     ctx.drawImage(img, 0, 0, tileSize.x, tileSize.y);
      //     this.loadedTileCount++;
      //     this.loadingTiles.delete(tileKey);
      //     done(null, ctx.canvas);
      //   };
      //   img.onerror = (err) => {
      //     console.error("Failed to load PNG:", url, err);
      //     this.loadingTiles.delete(tileKey);
      //     done(null, ctx.canvas);
      //   };
      //   img.src = url;
      //   return;
      // }

      if (url.toLowerCase().endsWith(".png")) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          if (tile.bbox) {
            // tile.bbox = [west, north, east, south]
            const [tileWest, tileNorth, tileEast, tileSouth] = tile.bbox;

            // Calculate overlap between map tile and PNG's bbox
            const overlapWest = Math.max(bounds.west, tileWest);
            const overlapEast = Math.min(bounds.east, tileEast);
            const overlapNorth = Math.min(bounds.north, tileNorth);
            const overlapSouth = Math.max(bounds.south, tileSouth);

            if (overlapWest >= overlapEast || overlapSouth >= overlapNorth) {
              // No overlap
              this.loadingTiles.delete(tileKey);
              done(null, ctx.canvas);
              return;
            }

            // Compute how much of the PNG to draw
            const pngWidth = img.width;
            const pngHeight = img.height;
            const pngGeoWidth = tileEast - tileWest;
            const pngGeoHeight = tileNorth - tileSouth;

            // Source crop from PNG (pixels)
            const sx = ((overlapWest - tileWest) / pngGeoWidth) * pngWidth;
            const sy = ((tileNorth - overlapNorth) / pngGeoHeight) * pngHeight;
            const sWidth = ((overlapEast - overlapWest) / pngGeoWidth) * pngWidth;
            const sHeight = ((overlapNorth - overlapSouth) / pngGeoHeight) * pngHeight;

            // Destination placement on Leaflet tile canvas
            const destX = ((overlapWest - bounds.west) / (bounds.east - bounds.west)) * tileSize.x;
            const destY = ((bounds.north - overlapNorth) / (bounds.north - bounds.south)) * tileSize.y;
            const destWidth = ((overlapEast - overlapWest) / (bounds.east - bounds.west)) * tileSize.x;
            const destHeight = ((overlapNorth - overlapSouth) / (bounds.north - bounds.south)) * tileSize.y;

            ctx.drawImage(img, sx, sy, sWidth, sHeight, destX, destY, destWidth, destHeight);
          } else {
            // Fallback (no bbox)
            ctx.drawImage(img, 0, 0, tileSize.x, tileSize.y);
          }

          this.loadedTileCount++;
          this.loadingTiles.delete(tileKey);
          done(null, ctx.canvas);
        };

        img.onerror = (err) => {
          console.error("Failed to load PNG:", url, err);
          this.loadingTiles.delete(tileKey);
          done(null, ctx.canvas);
        };

        img.src = url;
        return;
      }


      // Otherwise, fall back to GeoTIFF loading
      const tiff = await this.cache.loadTiff(url);
      if (!tiff) {
        this.loadingTiles.delete(tileKey);
        done(null, ctx.canvas);
        return;
      }

      // Get the image (first image in the GeoTIFF)
      const image = await tiff.getImage();

      // Get the bounding box of the GeoTIFF
      const bbox = image.getBoundingBox();

      // Calculate the pixel coordinates within the GeoTIFF
      const geoWidth = bbox[2] - bbox[0];
      const geoHeight = bbox[3] - bbox[1];

      // Map tile bounds to GeoTIFF pixel coordinates
      const pixelXStart = Math.floor(((bounds.west - bbox[0]) / geoWidth) * image.getWidth());
      const pixelYStart = Math.floor(((bbox[3] - bounds.north) / geoHeight) * image.getHeight());
      const pixelXEnd = Math.ceil(((bounds.east - bbox[0]) / geoWidth) * image.getWidth());
      const pixelYEnd = Math.ceil(((bbox[3] - bounds.south) / geoHeight) * image.getHeight());

      const pixelWidth = pixelXEnd - pixelXStart;
      const pixelHeight = pixelYEnd - pixelYStart;

      // Clamp to image bounds
      const clampedXStart = Math.max(0, Math.min(pixelXStart, image.getWidth() - 1));
      const clampedYStart = Math.max(0, Math.min(pixelYStart, image.getHeight() - 1));
      const clampedXEnd = Math.max(0, Math.min(pixelXEnd, image.getWidth()));
      const clampedYEnd = Math.max(0, Math.min(pixelYEnd, image.getHeight()));

      const clampedWidth = clampedXEnd - clampedXStart;
      const clampedHeight = clampedYEnd - clampedYStart;

      if (clampedWidth <= 0 || clampedHeight <= 0) {
        // No overlap with GeoTIFF
        this.loadingTiles.delete(tileKey);
        done(null, ctx.canvas);
        return;
      }

      // Read the raster data for this window
      const rasterData = await image.readRasters({
        window: [clampedXStart, clampedYStart, clampedXEnd, clampedYEnd],
        width: Math.min(tileSize.x, clampedWidth),
        height: Math.min(tileSize.y, clampedHeight),
      });

      // Get the first band (loss year data)
      const lossYearData = rasterData[0] as any;

      // Create image data for the canvas
      const imageData = ctx.createImageData(tileSize.x, tileSize.y);

      // Map GeoTIFF pixels to canvas pixels using the color LUT
      for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
          const canvasIdx = (y * imageData.width + x) * 4;

          // Calculate corresponding position in raster data
          const rasterX = Math.floor((x / tileSize.x) * rasterData.width);
          const rasterY = Math.floor((y / tileSize.y) * rasterData.height);
          const rasterIdx = rasterY * rasterData.width + rasterX;

          if (rasterIdx >= 0 && rasterIdx < lossYearData.length) {
            const value = lossYearData[rasterIdx];
            const lutIdx = Math.min(255, Math.max(0, Math.floor(value))) * 4;

            imageData.data[canvasIdx] = this.colorLUT[lutIdx];
            imageData.data[canvasIdx + 1] = this.colorLUT[lutIdx + 1];
            imageData.data[canvasIdx + 2] = this.colorLUT[lutIdx + 2];
            imageData.data[canvasIdx + 3] = this.colorLUT[lutIdx + 3];
          } else {
            // Transparent
            imageData.data[canvasIdx + 3] = 0;
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      this.loadedTileCount++;
      this.loadingTiles.delete(tileKey);
      done(null, ctx.canvas);
    } catch (error) {
      console.error("Error rendering tile:", error);
      this.loadingTiles.delete(`${coords.z}/${coords.x}/${coords.y}`);
      done(error as Error, ctx.canvas);
    }
  }

  private getTileBounds(coords: L.Coords): {
    north: number;
    south: number;
    east: number;
    west: number;
  } {
    const tileSizeDegrees = 360 / Math.pow(2, coords.z);
    const west = coords.x * tileSizeDegrees - 180;
    const east = west + tileSizeDegrees;

    // Web Mercator projection
    const n = Math.PI - (2 * Math.PI * coords.y) / Math.pow(2, coords.z);
    const north = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

    const s = Math.PI - (2 * Math.PI * (coords.y + 1)) / Math.pow(2, coords.z);
    const south = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(s) - Math.exp(-s)));

    return { north, south, east, west };
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  getLoadedTileCount() {
    return this.loadedTileCount;
  }

  clearCache() {
    this.cache.clear();
    this.loadedTileCount = 0;
  }
}