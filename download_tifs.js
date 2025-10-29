/**
 * download_tifs.js
 * Downloads all .tif files listed in the Hansen GFC manifest.
 * Skips 404s and builds valid_manifest.txt of successfully downloaded files.
 *
 * Usage:
 *   node download_tifs.js
 */

import fs from "fs-extra";
import axios from "axios";
import path from "path";
import pLimit from "p-limit";

const MANIFEST_URL =
  "https://storage.googleapis.com/earthenginepartners-hansen/GFC-2024-v1.12/lossyear.txt";
const OUTPUT_DIR = "D:/Projects/geo-map/public/geo-tiff";
const CONCURRENCY = 5; // number of parallel downloads

async function downloadManifest() {
  console.log("📥 Fetching manifest...");
  const { data } = await axios.get(MANIFEST_URL);
  const urls = data
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.endsWith(".tif"));
  console.log(`Found ${urls.length} URLs in manifest`);
  return urls;
}

async function downloadFile(url) {
  const filename = path.basename(url);
  const outPath = path.join(OUTPUT_DIR, filename);

  if (await fs.pathExists(outPath)) {
    return { url, file: filename, status: "exists" };
  }

  try {
    const response = await axios.get(url, {
      responseType: "stream",
      timeout: 600000, // 10 min timeout
      maxRedirects: 5,
      validateStatus: (s) => s < 500, // handle 404 manually
    });

    if (response.status === 404) {
      return { url, file: filename, status: "404" };
    }

    if (response.status !== 200) {
      return { url, file: filename, status: `error ${response.status}` };
    }

    await fs.ensureDir(OUTPUT_DIR);
    const writer = fs.createWriteStream(outPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    return { url, file: filename, status: "ok" };
  } catch (err) {
    return { url, file: filename, status: `failed: ${err.message}` };
  }
}

async function main() {
  await fs.ensureDir(OUTPUT_DIR);
  const urls = await downloadManifest();

  const limit = pLimit(CONCURRENCY);
  const tasks = urls.map((url) => limit(() => downloadFile(url)));

  let completed = 0;
  const results = [];

  for await (const result of tasks) {
    completed++;
    results.push(result);
    console.log(
      `[${completed}/${urls.length}] ${result.file} → ${result.status}`
    );
  }

  // Separate successes and failures
  const successful = results.filter((r) => r.status === "ok" || r.status === "exists");
  const failed = results.filter((r) => r.status !== "ok" && r.status !== "exists");

  console.log(
    `\n✅ Success: ${successful.length}, ❌ Failed: ${failed.length}`
  );

  // Write valid manifest
  const validManifestPath = path.join(OUTPUT_DIR, "valid_manifest.txt");
  await fs.writeFile(
    validManifestPath,
    successful.map((r) => r.url).join("\n"),
    "utf8"
  );
  console.log(`📝 Valid manifest written to ${validManifestPath}`);

  // Write failed downloads
  if (failed.length > 0) {
    const failedPath = path.join(OUTPUT_DIR, "failed_downloads.txt");
    await fs.writeFile(
      failedPath,
      failed.map((r) => `${r.file}: ${r.status}`).join("\n"),
      "utf8"
    );
    console.log(`⚠️  Failed downloads written to ${failedPath}`);
  }

  console.log(`\n📁 All downloads saved to: ${OUTPUT_DIR}`);
}

main().catch((err) => console.error("Fatal error:", err));
