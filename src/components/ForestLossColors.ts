/**
 * Forest Loss Color Scheme
 * Maps loss year values to colors matching Hansen Global Forest Change dataset
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Convert loss year value to RGB color
 * @param value - Pixel value from GeoTIFF (0 = no loss, 1-24 = years 2001-2024)
 * @returns RGB color object
 */
export function getLossYearColor(value: number): RGB {
  // 0 = No loss (transparent)
  if (value === 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  
  // 255 = Water/No data (semi-transparent gray)
  if (value === 255) {
    return { r: 100, g: 100, b: 100, a: 128 };
  }
  
  // Years 1-24 represent 2001-2024
  const year = value;
  let r: number, g: number, b: number;
  
  if (year >= 24) {
    // 2024: Bright Cyan
    r = 0;
    g = 255;
    b = 255;
  } else if (year >= 23) {
    // 2023-2024: Cyan to Bright Cyan transition
    const progress = (year - 23) / 1;
    r = Math.floor(0 + progress * 0);
    g = Math.floor(230 + progress * 25);
    b = Math.floor(230 + progress * 25);
  } else if (year >= 22) {
    // 2022-2023: Red to Cyan transition
    const progress = (year - 22) / 1;
    r = Math.floor(255 * (1 - progress) + 0 * progress);
    g = Math.floor(50 * (1 - progress) + 230 * progress);
    b = Math.floor(50 * (1 - progress) + 230 * progress);
  } else if (year >= 20) {
    // 2020-2022: Bright Red
    r = 255;
    g = Math.floor(0 + (year - 20) * 25);
    b = Math.floor(0 + (year - 20) * 25);
  } else if (year >= 15) {
    // 2015-2020: Red
    const progress = (year - 15) / 5;
    r = 255;
    g = Math.floor(progress * 50);
    b = 0;
  } else if (year >= 10) {
    // 2010-2015: Red to Orange
    const progress = (year - 10) / 5;
    r = 255;
    g = Math.floor(50 + progress * 115);
    b = 0;
  } else if (year >= 5) {
    // 2005-2010: Orange to Yellow
    const progress = (year - 5) / 5;
    r = 255;
    g = Math.floor(165 + progress * 90);
    b = 0;
  } else {
    // 2001-2005: Yellow
    r = 255;
    g = 255;
    b = Math.floor(value * 10); // Slight variation
  }
  
  return { r, g, b, a: 255 };
}

/**
 * Get year from pixel value
 */
export function getYearFromValue(value: number): number | null {
  if (value === 0 || value === 255) return null;
  return 2000 + value;
}

/**
 * Create a color lookup table for fast access
 */
export function createColorLUT(): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 4);
  
  for (let i = 0; i < 256; i++) {
    const color = getLossYearColor(i);
    lut[i * 4] = color.r;
    lut[i * 4 + 1] = color.g;
    lut[i * 4 + 2] = color.b;
    lut[i * 4 + 3] = color.a;
  }
  
  return lut;
}
