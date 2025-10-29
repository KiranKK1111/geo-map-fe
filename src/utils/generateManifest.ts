/**
 * Utility to generate a manifest file for your S3 bucket
 * This can be run to create a manifest.json file listing all available tiles
 */

/**
 * Generate all potential Hansen tile filenames
 */
function generateAllTileFilenames(): string[] {
  const filenames: string[] = [];
  
  // Hansen dataset typically covers:
  // Latitude: 80N to 50S
  // Longitude: 180W to 180E
  // in 10x10 degree tiles
  
  for (let lat = -50; lat <= 80; lat += 10) {
    for (let lng = -180; lng < 180; lng += 10) {
      const latAbs = Math.abs(lat);
      const lngAbs = Math.abs(lng);
      const latDir = lat >= 0 ? 'N' : 'S';
      const lngDir = lng >= 0 ? 'E' : 'W';
      
      const latStr = String(latAbs).padStart(2, '0');
      const lngStr = String(lngAbs).padStart(3, '0');
      
      const filename = `Hansen_GFC-2020-v1.8_lossyear_${latStr}${latDir}_${lngStr}${lngDir}.tif`;
      filenames.push(filename);
    }
  }
  
  return filenames;
}

/**
 * Example manifest generator
 * If you know exactly which files you have, you can create a custom list
 */
function generateCustomManifest(): object {
  // Example: Focus on tropical forest regions
  const regions = [
    // Amazon Basin
    { latRange: [-20, 10], lngRange: [-80, -40] },
    // Congo Basin
    { latRange: [-10, 10], lngRange: [10, 30] },
    // Southeast Asia
    { latRange: [-10, 20], lngRange: [90, 140] },
  ];
  
  const filenames: string[] = [];
  
  for (const region of regions) {
    for (let lat = region.latRange[0]; lat <= region.latRange[1]; lat += 10) {
      for (let lng = region.lngRange[0]; lng <= region.lngRange[1]; lng += 10) {
        const latAbs = Math.abs(lat);
        const lngAbs = Math.abs(lng);
        const latDir = lat >= 0 ? 'N' : 'S';
        const lngDir = lng >= 0 ? 'E' : 'W';
        
        const latStr = String(latAbs).padStart(2, '0');
        const lngStr = String(lngAbs).padStart(3, '0');
        
        const filename = `Hansen_GFC-2020-v1.8_lossyear_${latStr}${latDir}_${lngStr}${lngDir}.tif`;
        filenames.push(filename);
      }
    }
  }
  
  return {
    files: filenames,
    regions: regions.map(r => ({
      name: "Custom Region",
      bounds: {
        north: r.latRange[1],
        south: r.latRange[0],
        east: r.lngRange[1],
        west: r.lngRange[0],
      }
    })),
    generated: new Date().toISOString(),
    version: "1.0",
  };
}

// Example usage:
console.log('Complete tile list:');
const allTiles = generateAllTileFilenames();
console.log(JSON.stringify({ files: allTiles }, null, 2));
console.log(`\nTotal tiles: ${allTiles.length}`);

console.log('\n\nCustom manifest (tropical regions):');
const customManifest = generateCustomManifest();
console.log(JSON.stringify(customManifest, null, 2));

export { generateAllTileFilenames, generateCustomManifest };
