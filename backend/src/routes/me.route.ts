import { VideoStatus, VideoVisibility } from '@prisma/client';
import { Router } from 'express';
import { AppError } from '../errors/app-error';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/authenticate-jwt';
import { buildPlaybackUrl } from '../services/media/adaptive-transcoder';
import { buildThumbnailUrl } from '../services/media/media-url';

export const meRouter = Router();

const calculateScore = (video: { viewCount: number; likeCount: number }): number => {
  return video.viewCount + video.likeCount * 10;
};

meRouter.get('/', requireAuth, (req, res, next) => {
  if (!req.user) {
    next(new AppError(401, 'UNAUTHORIZED', 'Unauthorized'));
    return;
  }

  res.status(200).json({
    user: req.user,
  });
});

meRouter.get('/likes', requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const likedVideos = await prisma.like.findMany({
      where: {
        userId: req.user.id,
        video: {
          visibility: VideoVisibility.PUBLIC,
          status: VideoStatus.READY,
          durationSeconds: {
            not: null,
          },
          playbackPath: {
            not: null,
          },
        },
      },
      select: {
        video: {
          select: {
            id: true,
            title: true,
            description: true,
            durationSeconds: true,
            playbackPath: true,
            createdAt: true,
            viewCount: true,
            likeCount: true,
            uploader: {
              select: {
                id: true,
                nickname: true,
              },
            },
          },
        },
      },
    });

    const items = likedVideos.map((like) => ({
      id: like.video.id,
      title: like.video.title,
      description: like.video.description,
      durationSeconds: like.video.durationSeconds,
      uploader: like.video.uploader,
      createdAt: like.video.createdAt,
      playbackUrl: buildPlaybackUrl(like.video.playbackPath!),
      thumbnailUrl: buildThumbnailUrl(like.video.id),
      score: calculateScore(like.video),
      viewCount: like.video.viewCount,
      likeCount: like.video.likeCount,
    }));

    res.status(200).json(items);
  } catch (error) {
    next(error);
  }
});
