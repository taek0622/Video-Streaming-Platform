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

describe('home route integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns top 6 public videos ordered by score and createdAt desc with seed data', async () => {
    const seedVideos = [
      {
        id: 'v4',
        title: 'Video 4',
        description: 'desc 4',
        durationSeconds: 104,
        playbackPath: '/media/videos/v4/hls/master.m3u8',
        viewCount: 50,
        likeCount: 7,
        createdAt: new Date('2026-02-10T00:00:00.000Z'),
        uploader: {
          id: 'uploader-4',
          nickname: 'user4',
        },
      },
      {
        id: 'v2',
        title: 'Video 2',
        description: 'desc 2',
        durationSeconds: 102,
        playbackPath: '/media/videos/v2/hls/master.m3u8',
        viewCount: 20,
        likeCount: 10,
        createdAt: new Date('2026-02-12T00:00:00.000Z'),
        uploader: {
          id: 'uploader-2',
          nickname: 'user2',
        },
      },
      {
        id: 'v1',
        title: 'Video 1',
        description: 'desc 1',
        durationSeconds: 101,
        playbackPath: '/media/videos/v1/hls/master.m3u8',
        viewCount: 80,
        likeCount: 4,
        createdAt: new Date('2026-02-11T00:00:00.000Z'),
        uploader: {
          id: 'uploader-1',
          nickname: 'user1',
        },
      },
      {
        id: 'v7',
        title: 'Video 7',
        description: 'desc 7',
        durationSeconds: 107,
        playbackPath: '/media/videos/v7/hls/master.m3u8',
        viewCount: 5,
        likeCount: 0,
        createdAt: new Date('2026-02-14T00:00:00.000Z'),
        uploader: {
          id: 'uploader-7',
          nickname: 'user7',
        },
      },
      {
        id: 'v5',
        title: 'Video 5',
        description: 'desc 5',
        durationSeconds: 105,
        playbackPath: '/media/videos/v5/hls/master.m3u8',
        viewCount: 100,
        likeCount: 3,
        createdAt: new Date('2026-02-09T00:00:00.000Z'),
        uploader: {
          id: 'uploader-5',
          nickname: 'user5',
        },
      },
      {
        id: 'v6',
        title: 'Video 6',
        description: 'desc 6',
        durationSeconds: 106,
        playbackPath: '/media/videos/v6/hls/master.m3u8',
        viewCount: 10,
        likeCount: 8,
        createdAt: new Date('2026-02-13T00:00:00.000Z'),
        uploader: {
          id: 'uploader-6',
          nickname: 'user6',
        },
      },
      {
        id: 'v3',
        title: 'Video 3',
        description: 'desc 3',
        durationSeconds: 103,
        playbackPath: '/media/videos/v3/hls/master.m3u8',
        viewCount: 35,
        likeCount: 9,
        createdAt: new Date('2026-02-08T00:00:00.000Z'),
        uploader: {
          id: 'uploader-3',
          nickname: 'user3',
        },
      },
    ];

    mocks.videoFindManyMock.mockResolvedValue(seedVideos);

    const response = await request(app).get('/home');

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
      },
      select: {
        id: true,
        title: true,
        description: true,
        durationSeconds: true,
        playbackPath: true,
        viewCount: true,
        likeCount: true,
        createdAt: true,
        uploader: {
          select: {
            id: true,
            nickname: true,
          },
        },
      },
    });

    expect(response.body).toEqual([
      {
        id: 'v5',
        title: 'Video 5',
        description: 'desc 5',
        durationSeconds: 105,
        uploader: {
          id: 'uploader-5',
          nickname: 'user5',
        },
        createdAt: '2026-02-09T00:00:00.000Z',
        playbackUrl: 'http://localhost:3000/media/videos/v5/hls/master.m3u8',
        thumbnailUrl: 'http://localhost:3000/media/videos/v5/thumbnail',
        score: 130,
        viewCount: 100,
        likeCount: 3,
      },
      {
        id: 'v3',
        title: 'Video 3',
        description: 'desc 3',
        durationSeconds: 103,
        uploader: {
          id: 'uploader-3',
          nickname: 'user3',
        },
        createdAt: '2026-02-08T00:00:00.000Z',
        playbackUrl: 'http://localhost:3000/media/videos/v3/hls/master.m3u8',
        thumbnailUrl: 'http://localhost:3000/media/videos/v3/thumbnail',
        score: 125,
        viewCount: 35,
        likeCount: 9,
      },
      {
        id: 'v2',
        title: 'Video 2',
        description: 'desc 2',
        durationSeconds: 102,
        uploader: {
          id: 'uploader-2',
          nickname: 'user2',
        },
        createdAt: '2026-02-12T00:00:00.000Z',
        playbackUrl: 'http://localhost:3000/media/videos/v2/hls/master.m3u8',
        thumbnailUrl: 'http://localhost:3000/media/videos/v2/thumbnail',
        score: 120,
        viewCount: 20,
        likeCount: 10,
      },
      {
        id: 'v1',
        title: 'Video 1',
        description: 'desc 1',
        durationSeconds: 101,
        uploader: {
          id: 'uploader-1',
          nickname: 'user1',
        },
        createdAt: '2026-02-11T00:00:00.000Z',
        playbackUrl: 'http://localhost:3000/media/videos/v1/hls/master.m3u8',
        thumbnailUrl: 'http://localhost:3000/media/videos/v1/thumbnail',
        score: 120,
        viewCount: 80,
        likeCount: 4,
      },
      {
        id: 'v4',
        title: 'Video 4',
        description: 'desc 4',
        durationSeconds: 104,
        uploader: {
          id: 'uploader-4',
          nickname: 'user4',
        },
        createdAt: '2026-02-10T00:00:00.000Z',
        playbackUrl: 'http://localhost:3000/media/videos/v4/hls/master.m3u8',
        thumbnailUrl: 'http://localhost:3000/media/videos/v4/thumbnail',
        score: 120,
        viewCount: 50,
        likeCount: 7,
      },
      {
        id: 'v6',
        title: 'Video 6',
        description: 'desc 6',
        durationSeconds: 106,
        uploader: {
          id: 'uploader-6',
          nickname: 'user6',
        },
        createdAt: '2026-02-13T00:00:00.000Z',
        playbackUrl: 'http://localhost:3000/media/videos/v6/hls/master.m3u8',
        thumbnailUrl: 'http://localhost:3000/media/videos/v6/thumbnail',
        score: 90,
        viewCount: 10,
        likeCount: 8,
      },
    ]);
  });
});
