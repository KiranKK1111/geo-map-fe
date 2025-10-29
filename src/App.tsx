/**
 * Hansen Global Forest Change Visualization
 * 
 * This app loads and displays forest loss data from GeoTIFF files
 * stored in an S3 bucket. It uses Leaflet for map rendering and
 * the geotiff.js library for reading GeoTIFF data.
 * 
 * Features:
 * - Dynamic tile loading based on viewport
 * - LRU cache with 200MB limit for memory protection
 * - Color-coded visualization of forest loss years (2001-2024)
 * - Toggle between forest loss view and standard map
 * 
 * See SETUP.md for configuration details
 */

import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { MapView } from "./components/MapView";

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ width: '100%', height: '100vh' }}>
        <MapView />
      </div>
    </ThemeProvider>
  );
}
