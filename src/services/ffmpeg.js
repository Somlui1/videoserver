const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const transcodeToHLS = (inputPath, outputBaseDir) => {
  return new Promise((resolve, reject) => {
    // Ensure subdirectories exist
    ['360p', '720p', '1080p'].forEach(res => {
      fs.mkdirSync(path.join(outputBaseDir, res), { recursive: true });
    });

    // Write the master playlist manually for adaptive streaming
    fs.writeFileSync(path.join(outputBaseDir, 'master.m3u8'),
`#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
360p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p/index.m3u8
`);

    ffmpeg(inputPath)
      .complexFilter([
        '[0:v]split=3[v1][v2][v3];[v1]scale=640:360[360];[v2]scale=1280:720[720];[v3]scale=1920:1080[1080]'
      ])
      // 360p stream
      .output(`${outputBaseDir}/360p/index.m3u8`)
      .outputOptions([
        '-map', '[360]', '-c:v', 'libx264', '-b:v', '800k',
        '-map', '0:a?', '-c:a', 'aac', '-b:a', '96k',
        '-f', 'hls', '-hls_time', '6', '-hls_playlist_type', 'vod',
        '-hls_segment_filename', `${outputBaseDir}/360p/seg%04d.ts`
      ])
      // 720p stream
      .output(`${outputBaseDir}/720p/index.m3u8`)
      .outputOptions([
        '-map', '[720]', '-c:v', 'libx264', '-b:v', '2500k',
        '-map', '0:a?', '-c:a', 'aac', '-b:a', '128k',
        '-f', 'hls', '-hls_time', '6', '-hls_playlist_type', 'vod',
        '-hls_segment_filename', `${outputBaseDir}/720p/seg%04d.ts`
      ])
      // 1080p stream
      .output(`${outputBaseDir}/1080p/index.m3u8`)
      .outputOptions([
        '-map', '[1080]', '-c:v', 'libx264', '-b:v', '5000k',
        '-map', '0:a?', '-c:a', 'aac', '-b:a', '192k',
        '-f', 'hls', '-hls_time', '6', '-hls_playlist_type', 'vod',
        '-hls_segment_filename', `${outputBaseDir}/1080p/seg%04d.ts`
      ])
      .on('end', () => resolve())
      .on('error', (err, stdout, stderr) => {
        console.error('FFmpeg Error:', err.message);
        console.error('FFmpeg stderr:', stderr);
        reject(err);
      })
      .run();
  });
};

const extractThumbnail = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    const outputDir = path.dirname(outputPath);
    const filename = path.basename(outputPath);
    
    fs.mkdirSync(outputDir, { recursive: true });

    ffmpeg(inputPath)
      .screenshots({
        timestamps: ['50%'],
        filename: filename,
        folder: outputDir
      })
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err));
  });
};

module.exports = { transcodeToHLS, extractThumbnail };
