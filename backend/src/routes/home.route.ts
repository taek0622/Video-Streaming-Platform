import { VideoVisibility } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../lib/prisma';

const HOME_LIMIT = 6;

type HomeVideoRow = {
  id: string;
  title: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  createdAt: Date;
};

const calculateScore = (video: Pick<HomeVideoRow, 'viewCount' | 'likeCount'>): number => {
  return video.viewCount + video.likeCount * 10;
};

export const homeRouter = Router();

homeRouter.get('/', async (_req, res, next) => {
  try {
    const videos = await prisma.video.findMany({
      where: {
        visibility: VideoVisibility.PUBLIC,
      },
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        viewCount: true,
        likeCount: true,
        createdAt: true,
      },
    });

    const popularVideos = (videos as HomeVideoRow[])
      .map((video) => ({
        ...video,
        score: calculateScore(video),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(0, HOME_LIMIT)
      .map(({ id, title, thumbnailUrl, score, viewCount, likeCount }) => ({
        id,
        title,
        thumbnailUrl,
        score,
        viewCount,
        likeCount,
      }));

    res.status(200).json(popularVideos);
  } catch (error) {
    next(error);
  }
});
