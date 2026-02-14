import fs from 'node:fs/promises';
import path from 'node:path';
import { VideoVisibility } from '@prisma/client';
import { Router } from 'express';
import { AppError } from '../errors/app-error';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { attachAuthIfPresent } from '../middlewares/authenticate-jwt';
import { getVideoPublicAbsoluteDirectory } from '../services/storage/local-upload-url-provider';

const allowedToken = /^[a-zA-Z0-9._-]+$/;

const resolveHlsContentType = (filename: string): string => {
  if (filename.endsWith('.m3u8')) {
    return 'application/vnd.apple.mpegurl';
  }

  if (filename.endsWith('.m4s')) {
    return 'video/iso.segment';
  }

  if (filename.endsWith('.ts')) {
    return 'video/mp2t';
  }

  if (filename.endsWith('.mp4')) {
    return 'video/mp4';
  }

  return 'application/octet-stream';
};

const isAllowedPathToken = (value: string): boolean => {
  return allowedToken.test(value);
};

export const mediaRouter = Router();

mediaRouter.get('/videos/:videoId/hls/:filename', attachAuthIfPresent, async (req, res, next) => {
  try {
    const videoId = req.params.videoId;
    const filename = req.params.filename;

    if (!isAllowedPathToken(videoId) || !isAllowedPathToken(filename)) {
      throw new AppError(400, 'INVALID_MEDIA_PATH', 'Invalid media path');
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        uploaderId: true,
        visibility: true,
      },
    });

    if (!video) {
      throw new AppError(404, 'MEDIA_NOT_FOUND', 'Media not found');
    }

    if (video.visibility === VideoVisibility.PRIVATE && req.user?.id !== video.uploaderId) {
      throw new AppError(404, 'MEDIA_NOT_FOUND', 'Media not found');
    }

    const hlsDirectory = path.resolve(getVideoPublicAbsoluteDirectory(videoId), 'hls');
    const absoluteFilePath = path.resolve(hlsDirectory, filename);

    if (!absoluteFilePath.startsWith(`${hlsDirectory}${path.sep}`)) {
      throw new AppError(400, 'INVALID_MEDIA_PATH', 'Invalid media path');
    }

    await fs.access(absoluteFilePath);

    res.setHeader('Content-Type', resolveHlsContentType(filename));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', env.nodeEnv === 'production' ? 'public, max-age=30' : 'no-cache');

    res.sendFile(absoluteFilePath, (error) => {
      if (error) {
        next(error);
      }
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      next(new AppError(404, 'MEDIA_NOT_FOUND', 'Media not found'));
      return;
    }

    next(error);
  }
});
