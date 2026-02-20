import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  videoFindManyMock: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    video: {
      findMany: mocks.videoFindManyMock,
    },
  },
}));

import { app } from '../app';

describe('search route integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated videos with metadata for popular sort', async () => {
    mocks.videoFindManyMock.mockResolvedValue([
      {
        id: 'v4',
        title: 'cat low',
        description: 'desc low',
        durationSeconds: 104,
        playbackPath: '/media/videos/v4/hls/master.m3u8',
        createdAt: new Date('2026-02-10T00:00:00.000Z'),
        viewCount: 80,
        likeCount: 0,
        uploader: {
          id: 'uploader-4',
          nickname: 'user4',
        },
      },
      {
        id: 'v1',
        title: 'cat top older',
        description: 'desc 1',
        durationSeconds: 101,
        playbackPath: '/media/videos/v1/hls/master.m3u8',
        createdAt: new Date('2026-02-10T00:00:00.000Z'),
        viewCount: 80,
        likeCount: 4,
        uploader: {
          id: 'uploader-1',
          nickname: 'user1',
        },
      },
      {
        id: 'v5',
        title: 'cat bottom',
        description: 'desc bottom',
        durationSeconds: 105,
        playbackPath: '/media/videos/v5/hls/master.m3u8',
        createdAt: new Date('2026-02-09T00:00:00.000Z'),
        viewCount: 10,
        likeCount: 1,
        uploader: {
          id: 'uploader-5',
          nickname: 'user5',
        },
      },
      {
        id: 'v3',
        title: 'cat middle',
        description: 'desc 3',
        durationSeconds: 103,
        playbackPath: '/media/videos/v3/hls/master.m3u8',
        createdAt: new Date('2026-02-11T00:00:00.000Z'),
        viewCount: 15,
        likeCount: 8,
        uploader: {
          id: 'uploader-3',
          nickname: 'user3',
        },
      },
      {
        id: 'v2',
        title: 'cat top newer',
        description: 'desc 2',
        durationSeconds: 102,
        playbackPath: '/media/videos/v2/hls/master.m3u8',
        createdAt: new Date('2026-02-12T00:00:00.000Z'),
        viewCount: 20,
        likeCount: 10,
        uploader: {
          id: 'uploader-2',
          nickname: 'user2',
        },
      },
    ]);

    const response = await request(app).get('/search').query({
      keyword: 'Cat',
      sort: 'popular',
      page: '2',
      size: '2',
    });

    expect(response.status).toBe(200);
    expect(mocks.videoFindManyMock).toHaveBeenCalledWith({
      where: {
        visibility: 'PUBLIC',
        status: 'READY',
        durationSeconds: {
          not: null,
        },
        playbackPath: {
          not: null,
        },
        OR: [
          {
            title: {
              contains: 'Cat',
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: 'Cat',
              mode: 'insensitive',
            },
          },
        ],
      },
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
    });

    expect(response.body).toEqual({
      page: 2,
      size: 2,
      totalCount: 5,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
      items: [
        {
          id: 'v3',
          title: 'cat middle',
          description: 'desc 3',
          durationSeconds: 103,
          uploader: {
            id: 'uploader-3',
            nickname: 'user3',
          },
          playbackUrl: 'http://localhost:3000/media/videos/v3/hls/master.m3u8',
          thumbnailUrl: 'http://localhost:3000/media/videos/v3/thumbnail',
          score: 95,
          viewCount: 15,
          likeCount: 8,
          createdAt: '2026-02-11T00:00:00.000Z',
        },
        {
          id: 'v4',
          title: 'cat low',
          description: 'desc low',
          durationSeconds: 104,
          uploader: {
            id: 'uploader-4',
            nickname: 'user4',
          },
          playbackUrl: 'http://localhost:3000/media/videos/v4/hls/master.m3u8',
          thumbnailUrl: 'http://localhost:3000/media/videos/v4/thumbnail',
          score: 80,
          viewCount: 80,
          likeCount: 0,
          createdAt: '2026-02-10T00:00:00.000Z',
        },
      ],
    });
  });
});
