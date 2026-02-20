import dotenv from 'dotenv';

dotenv.config();

const portRaw = process.env.PORT ?? '3000';
const port = Number.parseInt(portRaw, 10);

if (Number.isNaN(port)) {
  throw new Error('PORT must be a valid number');
}

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required');
}

const localUploadUrlExpiresRaw = process.env.LOCAL_UPLOAD_URL_EXPIRES_SECONDS ?? '900';
const localUploadUrlExpiresSeconds = Number.parseInt(localUploadUrlExpiresRaw, 10);

if (Number.isNaN(localUploadUrlExpiresSeconds) || localUploadUrlExpiresSeconds <= 0) {
  throw new Error('LOCAL_UPLOAD_URL_EXPIRES_SECONDS must be a positive number');
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  ffmpegPath: process.env.FFMPEG_PATH ?? 'ffmpeg',
  ffprobePath: process.env.FFPROBE_PATH ?? 'ffprobe',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${port}`,
  localStorageDir: process.env.LOCAL_STORAGE_DIR ?? 'uploads',
  localUploadUrlExpiresSeconds,
} as const;
