import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { VideoStatus } from '@prisma/client';
import { Router } from 'express';
import { AppError } from '../errors/app-error';
import { prisma } from '../lib/prisma';
import { resolveUploadTarget, verifyUploadToken } from '../services/storage/local-upload-url-provider';

export const storageRouter = Router();

storageRouter.put('/upload', async (req, res, next) => {
  try {
    const token = req.query.token;

    if (typeof token !== 'string' || !token) {
      throw new AppError(400, 'INVALID_UPLOAD_TOKEN', 'Upload token is required');
    }

    let claims;

    try {
      claims = verifyUploadToken(token);
    } catch {
      throw new AppError(401, 'INVALID_UPLOAD_TOKEN', 'Invalid upload token');
    }

    const target = resolveUploadTarget(claims);

    const video = await prisma.video.findUnique({
      where: { id: target.videoId },
      select: { id: true },
    });

    if (!video) {
      throw new AppError(404, 'VIDEO_NOT_FOUND', 'Video not found');
    }

    await fs.promises.mkdir(path.dirname(target.absolutePath), { recursive: true });
    await pipeline(req, fs.createWriteStream(target.absolutePath));

    if (target.kind === 'video') {
      await prisma.video.update({
        where: { id: target.videoId },
        data: {
          status: VideoStatus.UPLOADING,
          playbackPath: null,
          errorMessage: null,
        },
      });

      res.status(200).json({
        ok: true,
        status: VideoStatus.UPLOADING,
      });
      return;
    }

    if (target.kind === 'thumbnail') {
      await prisma.video.update({
        where: { id: target.videoId },
        data: {
          thumbnailUrl: target.publicPath ?? '',
        },
      });
    }

    res.status(200).json({
      ok: true,
      path: target.publicPath,
      contentType: target.contentType,
    });
  } catch (error) {
    next(error);
  }
});
