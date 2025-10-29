import L from "leaflet";
import type { TileInfo } from "./S3TileManager";

/**
 * ForestLossPNGLayer
 * A Leaflet LayerGroup that displays georeferenced PNGs (EPSG:3857)
 */
export class ForestLossPNGLayer extends L.LayerGroup {
  private tiles: TileInfo[];
  private imageLayers: L.ImageOverlay[] = [];
  private map?: L.Map;

  constructor(tiles: TileInfo[]) {
    super();
    this.tiles = tiles;
  }

  onAdd(map: L.Map) {
    this.map = map;
    this.addVisibleTiles();
    map.on("moveend zoomend", this.onMapMove, this);
  }

  onRemove(map: L.Map) {
    map.off("moveend zoomend", this.onMapMove, this);
    this.clearAll();
    this.map = undefined;
  }

  private onMapMove() {
    this.addVisibleTiles();
  }

  private clearAll() {
    if (!this.map) return;
    for (const img of this.imageLayers) {
      this.map.removeLayer(img);
    }
    this.imageLayers = [];
  }

  private addVisibleTiles() {
    if (!this.map) return;

    const mapBounds = this.map.getBounds();
    const mapProjected = L.bounds(
      this.project(mapBounds.getSouthWest()),
      this.project(mapBounds.getNorthEast())
    );

    this.clearAll();

    for (const tile of this.tiles) {
      if (!tile.bbox) continue;

      const [west, north, east, south] = tile.bbox;
      const tileBoundsProjected = L.bounds(
        L.point(west, south),
        L.point(east, north)
      );

      const intersects =
        tileBoundsProjected.min.x <= mapProjected.max.x &&
        tileBoundsProjected.max.x >= mapProjected.min.x &&
        tileBoundsProjected.min.y <= mapProjected.max.y &&
        tileBoundsProjected.max.y >= mapProjected.min.y;

      if (!intersects) continue;

      const sw = this.unproject(L.point(west, south));
      const ne = this.unproject(L.point(east, north));
      const leafletBounds = L.latLngBounds(sw, ne);

      const image = L.imageOverlay(tile.url, leafletBounds, {
        opacity: 0.9,
        interactive: false,
      });

      image.addTo(this.map);
      this.imageLayers.push(image);
    }
  }

  /** Convert lat/lon (EPSG:4326) → Web Mercator (EPSG:3857) */
  private project(latLng: L.LatLng): L.Point {
    const d = Math.PI / 180;
    const max = 85.0511287798;
    const lat = Math.max(Math.min(max, latLng.lat), -max);
    const sin = Math.sin(lat * d);
    return L.point(
      (latLng.lng * 20037508.34) / 180,
      (Math.log((1 + sin) / (1 - sin)) * 20037508.34) / (2 * Math.PI)
    );
  }

  /** Convert Web Mercator (EPSG:3857) → lat/lon (EPSG:4326) */
  private unproject(point: L.Point): L.LatLng {
    const d = 180 / Math.PI;
    return L.latLng(
      (Math.atan(Math.exp((point.y * Math.PI) / 20037508.34)) * 2 - Math.PI / 2) * d,
      (point.x / 20037508.34) * 180
    );
  }
}
