/**
 * One-time script to backfill quality metadata for existing ready videos.
 * Probes the master.m3u8 or video file to determine resolution.
 */
require('dotenv').config();
const pool = require('../db/pool');
const { minioClient, HLS_BUCKET } = require('../services/minio');
const { getMetadata } = require('../services/ffmpeg');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

async function backfill() {
  console.log('--- Starting Quality Backfill ---');
  
  try {
    const { rows: videos } = await pool.query("SELECT id, title FROM videos WHERE status = 'ready' AND quality IS NULL");
    console.log(`Found ${videos.length} videos to process.`);

    for (const video of videos) {
      console.log(`Probing [${video.id}] ${video.title}...`);
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `backfill-${video.id}-`));
      const m3u8Path = path.join(tmpDir, 'master.m3u8');

      try {
        // Try to get metadata from the master playlist or a segment
        // We probe the first segment to be sure about resolution
        const objectName = `${video.id}/original/seg0000.ts`;
        const localSegPath = path.join(tmpDir, 'seg.ts');
        
        await minioClient.fGetObject(HLS_BUCKET, objectName, localSegPath);
        const metadata = await getMetadata(localSegPath);
        
        await pool.query("UPDATE videos SET quality = $1 WHERE id = $2", [metadata.quality, video.id]);
        console.log(`  -> Updated to ${metadata.quality}`);
      } catch (err) {
        console.error(`  !! Failed to probe ${video.id}: ${err.message}`);
        await pool.query("UPDATE videos SET quality = 'Unknown' WHERE id = $1", [video.id]);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }

    console.log('--- Backfill Completed ---');
  } catch (err) {
    console.error('Backfill failed:', err);
  } finally {
    await pool.end();
  }
}

backfill();
