'use strict';

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

/**
 * Get video metadata (duration, resolution, bitrate) using ffprobe.
 */
const getMetadata = (inputPath) =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(new Error(`ffprobe failed: ${err.message}`));
      const format = metadata?.format;
      const videoStream = metadata?.streams?.find(s => s.codec_type === 'video');
      if (!format || !videoStream) return reject(new Error('Cannot read video metadata'));
      resolve({
        duration: parseFloat(format.duration),
        width: videoStream.width,
        height: videoStream.height,
        bitrate: parseInt(format.bit_rate) || 2000000, // Fallback to 2Mbps
      });
    });
  });

/**
 * Parse HH:MM:SS.ms timecode → seconds.
 */
const timecodeToSeconds = (tc) => {
  if (!tc) return 0;
  const parts = tc.split(':').map(parseFloat);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
};

/**
 * Write a single-stream master playlist.
 */
const writeMasterPlaylist = (outputBaseDir, width, height, bitrate) => {
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '',
    `#EXT-X-STREAM-INF:BANDWIDTH=${bitrate},RESOLUTION=${width}x${height}`,
    'original/index.m3u8'
  ];
  fs.writeFileSync(path.join(outputBaseDir, 'master.m3u8'), lines.join('\n') + '\n');
};

/**
 * Transcode a video to a single-resolution HLS (original resolution).
 */
const transcodeToHLS = async (inputPath, outputBaseDir, opts = {}) => {
  const {
    onProgress = null,
    onStart = null,
    onEnd = null,
    onError = null,
  } = opts;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const { duration, width, height, bitrate } = await getMetadata(inputPath);
  
  // Timeout per hour of video (ms). 30 min per hour of content.
  const TIMEOUT_PER_HOUR_MS = 30 * 60 * 1000;
  const MIN_TIMEOUT_MS = 10 * 60 * 1000;
  const timeoutMs = Math.max(MIN_TIMEOUT_MS, Math.ceil(duration / 3600) * TIMEOUT_PER_HOUR_MS);

  // Create output dir for the 'original' stream
  const outDir = path.join(outputBaseDir, 'original');
  fs.mkdirSync(outDir, { recursive: true });
  
  writeMasterPlaylist(outputBaseDir, width, height, bitrate);

  return new Promise((resolve, reject) => {
    const segFile = path.join(outDir, 'seg%04d.ts');
    const m3u8File = path.join(outDir, 'index.m3u8');

    const cmd = ffmpeg(inputPath)
      .inputOptions([
        '-analyzeduration', '100M',
        '-probesize', '100M',
      ])
      .output(m3u8File)
      .outputOptions([
        '-map', '0:v:0',           // Explicitly map first video stream
        '-map', '0:a?',             // Map audio if it exists
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ac', '2',
        '-f', 'hls',
        '-hls_time', '6',
        '-hls_playlist_type', 'vod',
        '-hls_segment_filename', segFile,
      ]);

    // Timeout guard
    const timer = setTimeout(() => {
      try { cmd.kill('SIGKILL'); } catch (_) {}
      const timeoutErr = new Error(`FFmpeg timed out after ${timeoutMs / 1000}s (video duration: ${Math.round(duration)}s)`);
      if (onError) onError(timeoutErr);
      reject(timeoutErr);
    }, timeoutMs);

    if (onStart) {
      cmd.on('start', (commandLine) => onStart(commandLine));
    }

    cmd.on('progress', (progress) => {
      const elapsed = timecodeToSeconds(progress.timemark);
      // Clamp at 99% during progress as requested. 100% is only for 'end'.
      const percent = duration > 0
        ? Math.min(99, Math.round((elapsed / duration) * 100))
        : Math.min(99, progress.percent ?? 0);

      if (onProgress) {
        onProgress({
          percent,
          timemark: progress.timemark,
          currentFps: progress.currentFps,
          targetSize: progress.targetSize,
        });
      }
    });

    cmd.on('end', () => {
      clearTimeout(timer);
      if (onEnd) onEnd();
      resolve({ outputDir: outputBaseDir });
    });

    cmd.on('error', (err, stdout, stderr) => {
      clearTimeout(timer);
      const enriched = new Error(`FFmpeg failed: ${err.message}`);
      enriched.ffmpegStderr = stderr ?? '';
      enriched.ffmpegStdout = stdout ?? '';
      if (onError) onError(enriched);
      reject(enriched);
    });

    cmd.run();
  });
};

/**
 * Extract a single thumbnail at 50% through.
 */
const extractThumbnail = (inputPath, outputPath, opts = {}) => {
  const { timestamp = '50%' } = opts;
  const outputDir = path.dirname(outputPath);
  const filename = path.basename(outputPath);

  fs.mkdirSync(outputDir, { recursive: true });

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: [timestamp],
        filename,
        folder: outputDir,
        size: '640x?',
      })
      .on('end', () => resolve(outputPath))
      .on('error', (err, stdout, stderr) => {
        const enriched = new Error(`Thumbnail extraction failed: ${err.message}`);
        enriched.ffmpegStderr = stderr ?? '';
        reject(enriched);
      });
  });
};

module.exports = { transcodeToHLS, extractThumbnail, getMetadata };
