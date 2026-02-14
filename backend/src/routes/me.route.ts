import { VideoVisibility } from '@prisma/client';
import { Router } from 'express';
import { AppError } from '../errors/app-error';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/authenticate-jwt';

export const meRouter = Router();

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
        },
      },
      select: {
        video: {
          select: {
            id: true,
            title: true,
            thumbnailUrl: true,
            createdAt: true,
            viewCount: true,
            likeCount: true,
          },
        },
      },
    });

    const items = likedVideos.map((like) => like.video);

    res.status(200).json(items);
  } catch (error) {
    next(error);
  }
});
