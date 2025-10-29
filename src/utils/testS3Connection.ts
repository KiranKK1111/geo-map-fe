/**
 * S3 Connection Tester
 * Use this utility to verify your S3 bucket is accessible and files are loading correctly
 */

const S3_BASE_URL = "https://geotif-for-geospatial.s3.eu-north-1.amazonaws.com/lossyear_tiffs/";

/**
 * Test if a specific file can be accessed
 */
export async function testFileAccess(filename: string): Promise<{
  success: boolean;
  status?: number;
  error?: string;
  size?: number;
}> {
  const url = `${S3_BASE_URL}${filename}`;
  
  try {
    const response = await fetch(url, { method: 'HEAD' });
    
    if (response.ok) {
      const contentLength = response.headers.get('content-length');
      return {
        success: true,
        status: response.status,
        size: contentLength ? parseInt(contentLength) : undefined,
      };
    } else {
      return {
        success: false,
        status: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test CORS configuration
 */
export async function testCORS(): Promise<{
  success: boolean;
  error?: string;
}> {
  const testFile = "Hansen_GFC-2020-v1.8_lossyear_00N_050W.tif";
  const url = `${S3_BASE_URL}${testFile}`;
  
  try {
    // Try to fetch with range request (typical for GeoTIFF)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Range': 'bytes=0-1023', // Request first 1KB
      },
    });
    
    if (response.ok || response.status === 206) {
      return { success: true };
    } else {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('CORS')) {
      return {
        success: false,
        error: 'CORS error - Check bucket CORS configuration',
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test multiple sample files
 */
export async function testSampleFiles(): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: Array<{ filename: string; success: boolean; error?: string }>;
}> {
  const sampleFiles = [
    // Amazon
    "Hansen_GFC-2020-v1.8_lossyear_00N_050W.tif",
    "Hansen_GFC-2020-v1.8_lossyear_00N_060W.tif",
    "Hansen_GFC-2020-v1.8_lossyear_10S_060W.tif",
    // Congo
    "Hansen_GFC-2020-v1.8_lossyear_00N_020E.tif",
    // SE Asia
    "Hansen_GFC-2020-v1.8_lossyear_00N_100E.tif",
    "Hansen_GFC-2020-v1.8_lossyear_00N_110E.tif",
  ];
  
  const results = await Promise.all(
    sampleFiles.map(async (filename) => {
      const result = await testFileAccess(filename);
      return {
        filename,
        success: result.success,
        error: result.error,
      };
    })
  );
  
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;
  
  return {
    total: results.length,
    successful,
    failed,
    results,
  };
}

/**
 * Run all tests and log results
 */
export async function runDiagnostics(): Promise<void> {
  console.group('🔍 S3 Connection Diagnostics');
  
  // Test 1: CORS
  console.log('\n1️⃣ Testing CORS configuration...');
  const corsResult = await testCORS();
  if (corsResult.success) {
    console.log('✅ CORS test passed');
  } else {
    console.error('❌ CORS test failed:', corsResult.error);
  }
  
  // Test 2: Sample files
  console.log('\n2️⃣ Testing sample files...');
  const samplesResult = await testSampleFiles();
  console.log(`📊 Results: ${samplesResult.successful}/${samplesResult.total} files accessible`);
  
  if (samplesResult.failed > 0) {
    console.warn(`⚠️ ${samplesResult.failed} files failed:`);
    samplesResult.results
      .filter(r => !r.success)
      .forEach(r => {
        console.warn(`  - ${r.filename}: ${r.error}`);
      });
  }
  
  // Test 3: Manifest
  console.log('\n3️⃣ Testing manifest file...');
  const manifestUrl = `${S3_BASE_URL}manifest.json`;
  try {
    const response = await fetch(manifestUrl);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Manifest found');
      console.log(`📄 Contains ${Array.isArray(data) ? data.length : data.files?.length || 0} files`);
    } else {
      console.warn('⚠️ No manifest.json found (optional)');
      console.log('💡 Consider creating a manifest for faster loading');
    }
  } catch (error) {
    console.warn('⚠️ No manifest.json found (optional)');
  }
  
  // Summary
  console.log('\n📋 Summary');
  if (corsResult.success && samplesResult.successful > 0) {
    console.log('✅ S3 bucket is accessible and configured correctly');
    console.log('🎉 Application should work properly');
  } else {
    console.error('❌ Issues detected - see errors above');
    if (!corsResult.success) {
      console.error('🔧 Fix: Configure CORS on your S3 bucket');
    }
    if (samplesResult.failed === samplesResult.total) {
      console.error('🔧 Fix: Check file naming and S3 bucket permissions');
    }
  }
  
  console.groupEnd();
}

/**
 * Quick test - call this from browser console
 */
export async function quickTest(): Promise<void> {
  await runDiagnostics();
}

// Auto-run diagnostics in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('💡 Run quickTest() to check S3 connection');
  (window as any).quickTest = quickTest;
  (window as any).testS3 = {
    testFileAccess,
    testCORS,
    testSampleFiles,
    runDiagnostics,
  };
}
