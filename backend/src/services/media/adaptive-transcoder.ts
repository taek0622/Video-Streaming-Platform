import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env';
import { buildPublicUrl } from './media-url';
import {
  getSourceVideoAbsolutePath,
  getVideoPublicAbsoluteDirectory,
} from '../storage/local-upload-url-provider';

export type TranscodeResult = {
  durationSeconds: number | null;
};

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

const runFfprobe = async (args: string[]): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const ffprobe = spawn(env.ffprobePath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    ffprobe.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    ffprobe.on('error', (error) => {
      reject(new Error(`Failed to start ffprobe (${env.ffprobePath}): ${error.message}`));
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr.trim() || `ffprobe failed with exit code ${code ?? 'unknown'}`));
    });
  });
};

const ensureCleanDirectory = async (directoryPath: string): Promise<void> => {
  await fs.rm(directoryPath, { recursive: true, force: true });
  await fs.mkdir(directoryPath, { recursive: true });
};

const readDurationSeconds = async (sourcePath: string): Promise<number | null> => {
  const output = await runFfprobe([
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    sourcePath,
  ]);

  const durationRaw = output.trim();
  const duration = Number.parseFloat(durationRaw);

  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  return Math.ceil(duration);
};

export const transcodeVideoToAdaptiveStreams = async (videoId: string): Promise<TranscodeResult> => {
  const sourcePath = getSourceVideoAbsolutePath(videoId);
  const publicVideoDir = getVideoPublicAbsoluteDirectory(videoId);
  const hlsDir = path.join(publicVideoDir, 'hls');

  await fs.access(sourcePath);
  await ensureCleanDirectory(hlsDir);

  let durationSeconds: number | null = null;

  try {
    durationSeconds = await readDurationSeconds(sourcePath);
  } catch {
    durationSeconds = null;
  }

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

  return {
    durationSeconds,
  };
};

export const buildPlaybackUrl = (playbackPath: string): string => {
  return buildPublicUrl(playbackPath);
};
