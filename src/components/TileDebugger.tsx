/**
 * Tile Debugger Component
 * Optional component for debugging and monitoring tile loading
 * Can be added to MapView for development/troubleshooting
 */

import React from "react@17.0.2";
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
} from "@mui/material";

interface TileDebuggerProps {
  loadedTiles: string[];
  failedTiles: string[];
  cacheStats: {
    entries: number;
    sizeMB: number;
    maxSizeMB: number;
  };
  currentBounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export function TileDebugger({
  loadedTiles,
  failedTiles,
  cacheStats,
  currentBounds,
}: TileDebuggerProps) {
  return (
    <Card
      sx={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        zIndex: 1000,
        maxWidth: 320,
        maxHeight: 400,
        overflow: 'auto',
      }}
    >
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Debug Info
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Cache
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={`${cacheStats.entries} files`}
              size="small"
              color="primary"
            />
            <Chip
              label={`${cacheStats.sizeMB}/${cacheStats.maxSizeMB} MB`}
              size="small"
              color={cacheStats.sizeMB > cacheStats.maxSizeMB * 0.8 ? 'warning' : 'default'}
            />
          </Box>
        </Box>

        {currentBounds && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Current Bounds
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
              N: {currentBounds.north.toFixed(2)}° <br />
              S: {currentBounds.south.toFixed(2)}° <br />
              E: {currentBounds.east.toFixed(2)}° <br />
              W: {currentBounds.west.toFixed(2)}°
            </Typography>
          </Box>
        )}

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Status
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={`${loadedTiles.length} loaded`}
              size="small"
              color="success"
            />
            {failedTiles.length > 0 && (
              <Chip
                label={`${failedTiles.length} failed`}
                size="small"
                color="error"
              />
            )}
          </Box>
        </Box>

        {failedTiles.length > 0 && (
          <Box>
            <Typography variant="body2" color="error" gutterBottom>
              Failed Tiles
            </Typography>
            <List dense sx={{ maxHeight: 150, overflow: 'auto' }}>
              {failedTiles.slice(0, 10).map((tile, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={tile}
                    primaryTypographyProps={{
                      variant: 'caption',
                      sx: { fontFamily: 'monospace' },
                    }}
                  />
                </ListItem>
              ))}
              {failedTiles.length > 10 && (
                <ListItem sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={`... and ${failedTiles.length - 10} more`}
                    primaryTypographyProps={{
                      variant: 'caption',
                      color: 'text.secondary',
                    }}
                  />
                </ListItem>
              )}
            </List>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
