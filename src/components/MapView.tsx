import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  Box,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Typography,
  CircularProgress,
  Stack,
  Chip,
  LinearProgress,
} from "@mui/material";
import { loadTileManifest } from "./S3FileDiscovery";
import { ForestLossPNGLayer } from "./ForestLossPNGLayer";
import { TileSpatialIndex } from "./S3TileManager";

export function MapView() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const pngLayerRef = useRef<ForestLossPNGLayer | null>(null);
  const darkBaseLayerRef = useRef<L.TileLayer | null>(null);
  const defaultBaseLayerRef = useRef<L.TileLayer | null>(null);
  const [isLayerEnabled, setIsLayerEnabled] = useState(true);
  const [isLoadingIndex, setIsLoadingIndex] = useState(true);
  const [availableTilesCount, setAvailableTilesCount] = useState(0);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const worldBounds = L.latLngBounds(
      L.latLng(-90, -180),
      L.latLng(90, 180)
    );

    const map = L.map(mapContainerRef.current, {
      center: [0, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 12,
      maxBounds: worldBounds,
      maxBoundsViscosity: 1.0,
      attributionControl: false,
    });

    // 🗺️ Base layers
    const darkBaseLayer = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
      {
        maxZoom: 18,
        subdomains: "abcd",
      }
    );

    const defaultBaseLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 18,
      }
    );

    // Default dark mode
    darkBaseLayer.addTo(map);

    darkBaseLayerRef.current = darkBaseLayer;
    defaultBaseLayerRef.current = defaultBaseLayer;
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Load tile manifest and add PNG overlay
  useEffect(() => {
    const loadTiles = async () => {
      setIsLoadingIndex(true);
      try {
        const tiles = await loadTileManifest();
        setAvailableTilesCount(tiles.length);

        const index = new TileSpatialIndex(tiles);
        const pngLayer = new ForestLossPNGLayer(index.getAllTiles());
        pngLayerRef.current = pngLayer;

        if (isLayerEnabled && mapRef.current) {
          pngLayer.addTo(mapRef.current);
        }
      } catch (err) {
        console.error("Failed to load manifest:", err);
      } finally {
        setIsLoadingIndex(false);
      }
    };

    loadTiles();
  }, []);

  // Toggle between dark/light base and PNG layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !darkBaseLayerRef.current || !defaultBaseLayerRef.current)
      return;

    if (isLayerEnabled) {
      // Enable dark mode with PNG layer
      if (map.hasLayer(defaultBaseLayerRef.current))
        map.removeLayer(defaultBaseLayerRef.current);
      if (!map.hasLayer(darkBaseLayerRef.current))
        darkBaseLayerRef.current.addTo(map);

      if (pngLayerRef.current && !map.hasLayer(pngLayerRef.current))
        pngLayerRef.current.addTo(map);
    } else {
      // Show light map without PNGs
      if (map.hasLayer(darkBaseLayerRef.current))
        map.removeLayer(darkBaseLayerRef.current);
      if (!map.hasLayer(defaultBaseLayerRef.current))
        defaultBaseLayerRef.current.addTo(map);

      if (pngLayerRef.current && map.hasLayer(pngLayerRef.current))
        map.removeLayer(pngLayerRef.current);
    }
  }, [isLayerEnabled]);

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Control Panel */}
      <Card
        sx={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 1000,
          minWidth: 280,
        }}
      >
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={isLayerEnabled}
                onChange={(e) => setIsLayerEnabled(e.target.checked)}
                disabled={isLoadingIndex}
              />
            }
            label="Forest Loss Layer"
          />

          {isLoadingIndex && (
            <Box sx={{ mt: 2 }}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Loading tile index...
                </Typography>
              </Stack>
              <LinearProgress />
            </Box>
          )}

          {!isLoadingIndex && isLayerEnabled && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Status
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}
              >
                <Chip
                  label={`${availableTilesCount} tiles available`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </Stack>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 1.5 }}
              >
                Pan/zoom to load PNG tiles
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      {isLayerEnabled && (
        <Card
          sx={{
            position: "absolute",
            bottom: 16,
            right: 16,
            zIndex: 1000,
            backgroundColor: "rgba(25,25,25,0.85)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.15)",
            minWidth: 180,
          }}
        >
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Forest Loss Year
            </Typography>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 24,
                    height: 14,
                    backgroundColor: "rgb(0, 255, 255)",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                />
                <Typography variant="body2">2024</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 24,
                    height: 14,
                    backgroundColor: "rgb(255, 50, 50)",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                />
                <Typography variant="body2">2023–2020</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 24,
                    height: 14,
                    backgroundColor: "rgb(255, 165, 0)",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                />
                <Typography variant="body2">2015–2010</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 24,
                    height: 14,
                    backgroundColor: "rgb(255, 255, 0)",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                />
                <Typography variant="body2">2005–2001</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 24,
                    height: 14,
                    backgroundColor: "rgba(0, 0, 0, 0)",
                    border: "1px solid rgba(255,255,255,0.4)",
                  }}
                />
                <Typography variant="body2">No loss</Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 24,
                    height: 14,
                    backgroundColor: "rgb(40, 40, 40)",
                    border: "1px solid rgba(255,255,255,0.4)",
                  }}
                />
                <Typography variant="body2">Water / no Data</Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

    </Box>
  );
}
