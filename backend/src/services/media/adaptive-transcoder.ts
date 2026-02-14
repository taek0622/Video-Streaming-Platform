import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env';
import {
  getSourceVideoAbsolutePath,
  getVideoPublicAbsoluteDirectory,
} from '../storage/local-upload-url-provider';

const runFfmpeg = async (args: string[]): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(env.ffmpegPath, ['-hide_banner', '-loglevel', 'error', ...args], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderr = '';

    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    ffmpeg.on('error', (error) => {
      reject(new Error(`Failed to start ffmpeg (${env.ffmpegPath}): ${error.message}`));
    });
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `ffmpeg failed with exit code ${code ?? 'unknown'}`));
    });
  });
};

const ensureCleanDirectory = async (directoryPath: string): Promise<void> => {
  await fs.rm(directoryPath, { recursive: true, force: true });
  await fs.mkdir(directoryPath, { recursive: true });
};

export const transcodeVideoToAdaptiveStreams = async (videoId: string): Promise<void> => {
  const sourcePath = getSourceVideoAbsolutePath(videoId);
  const publicVideoDir = getVideoPublicAbsoluteDirectory(videoId);
  const hlsDir = path.join(publicVideoDir, 'hls');

  await fs.access(sourcePath);
  await ensureCleanDirectory(hlsDir);

  await runFfmpeg([
    '-y',
    '-i',
    sourcePath,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-f',
    'hls',
    '-hls_time',
    '6',
    '-hls_playlist_type',
    'vod',
    '-hls_segment_type',
    'fmp4',
    '-hls_fmp4_init_filename',
    'init.mp4',
    '-hls_flags',
    'independent_segments',
    '-hls_segment_filename',
    path.join(hlsDir, 'segment_%03d.m4s'),
    path.join(hlsDir, 'master.m3u8'),
  ]);

  await fs.rm(sourcePath, { force: true });
};

export const buildPlaybackUrl = (playbackPath: string): string => {
  const baseUrl = env.publicBaseUrl.replace(/\/+$/, '');
  const normalizedPath = playbackPath.startsWith('/') ? playbackPath : `/${playbackPath}`;

  return `${baseUrl}${normalizedPath}`;
};
