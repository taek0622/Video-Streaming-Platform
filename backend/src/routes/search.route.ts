import { VideoStatus, VideoVisibility } from '@prisma/client';
import { Router } from 'express';
import { AppError } from '../errors/app-error';
import { prisma } from '../lib/prisma';
import { buildPlaybackUrl } from '../services/media/adaptive-transcoder';
import { buildThumbnailUrl } from '../services/media/media-url';

const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 10;
const MAX_SIZE = 50;

type SearchSort = 'popular' | 'latest';

type SearchVideoRow = {
  id: string;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  playbackPath: string;
  createdAt: Date;
  viewCount: number;
  likeCount: number;
  uploader: {
    id: string;
    nickname: string;
  };
};

const calculateScore = (video: Pick<SearchVideoRow, 'viewCount' | 'likeCount'>): number => {
  return video.viewCount + video.likeCount * 10;
};

const asSingleQueryString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const parsePositiveInteger = (value: string | undefined, fallback: number, field: string): number => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new AppError(400, 'INVALID_QUERY', `${field} must be a positive integer`);
  }

  return parsed;
};

const parseSort = (value: string | undefined): SearchSort => {
  if (value === undefined || value === 'popular') {
    return 'popular';
  }

  if (value === 'latest') {
    return 'latest';
  }

  throw new AppError(400, 'INVALID_QUERY', 'sort must be popular or latest');
};

export const searchRouter = Router();

searchRouter.get('/', async (req, res, next) => {
  try {
    const keyword = (asSingleQueryString(req.query.keyword) ?? '').trim();
    const sort = parseSort(asSingleQueryString(req.query.sort));
    const page = parsePositiveInteger(asSingleQueryString(req.query.page), DEFAULT_PAGE, 'page');
    const size = Math.min(parsePositiveInteger(asSingleQueryString(req.query.size), DEFAULT_SIZE, 'size'), MAX_SIZE);

    const where = keyword
      ? {
          visibility: VideoVisibility.PUBLIC,
          status: VideoStatus.READY,
          durationSeconds: {
            not: null,
          },
          playbackPath: {
            not: null,
          },
          OR: [
            {
              title: {
                contains: keyword,
                mode: 'insensitive' as const,
              },
            },
            {
              description: {
                contains: keyword,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {
          visibility: VideoVisibility.PUBLIC,
          status: VideoStatus.READY,
          durationSeconds: {
            not: null,
          },
          playbackPath: {
            not: null,
          },
        };

    const videos = (await prisma.video.findMany({
      where,
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
    })) as SearchVideoRow[];

    const sortedVideos = videos
      .map((video) => ({
        ...video,
        score: calculateScore(video),
      }))
      .sort((a, b) => {
        if (sort === 'latest') {
          return b.createdAt.getTime() - a.createdAt.getTime();
        }

        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return b.createdAt.getTime() - a.createdAt.getTime();
      });

    const totalCount = sortedVideos.length;
    const totalPages = Math.ceil(totalCount / size);
    const start = (page - 1) * size;

    const items = sortedVideos.slice(start, start + size).map((video) => ({
      id: video.id,
      title: video.title,
      description: video.description,
      durationSeconds: video.durationSeconds,
      uploader: video.uploader,
      playbackUrl: buildPlaybackUrl(video.playbackPath),
      thumbnailUrl: buildThumbnailUrl(video.id),
      score: video.score,
      viewCount: video.viewCount,
      likeCount: video.likeCount,
      createdAt: video.createdAt,
    }));

    res.status(200).json({
      page,
      size,
      totalCount,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      items,
    });
  } catch (error) {
    next(error);
  }
});
