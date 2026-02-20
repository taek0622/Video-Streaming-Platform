import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signAccessToken } from '../lib/jwt';

const mocks = vi.hoisted(() => ({
  likeFindManyMock: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    like: {
      findMany: mocks.likeFindManyMock,
    },
  },
}));

import { app } from '../app';

describe('me route integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns liked public videos list', async () => {
    const token = signAccessToken({
      id: 'user-1',
      nickname: 'tester',
    });

    mocks.likeFindManyMock.mockResolvedValue([
      {
        video: {
          id: 'video-1',
          title: 'one',
          description: 'desc one',
          durationSeconds: 120,
          playbackPath: '/media/videos/video-1/hls/master.m3u8',
          createdAt: new Date('2026-02-14T10:00:00.000Z'),
          viewCount: 20,
          likeCount: 5,
          uploader: {
            id: 'uploader-1',
            nickname: 'user1',
          },
        },
      },
      {
        video: {
          id: 'video-2',
          title: 'two',
          description: 'desc two',
          durationSeconds: 95,
          playbackPath: '/media/videos/video-2/hls/master.m3u8',
          createdAt: new Date('2026-02-14T09:00:00.000Z'),
          viewCount: 10,
          likeCount: 3,
          uploader: {
            id: 'uploader-2',
            nickname: 'user2',
          },
        },
      },
    ]);

    const response = await request(app).get('/me/likes').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(mocks.likeFindManyMock).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        video: {
          visibility: 'PUBLIC',
          status: 'READY',
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
    expect(response.body).toEqual([
      {
        id: 'video-1',
        title: 'one',
        description: 'desc one',
        durationSeconds: 120,
        uploader: {
          id: 'uploader-1',
          nickname: 'user1',
        },
        createdAt: '2026-02-14T10:00:00.000Z',
        playbackUrl: 'http://localhost:3000/media/videos/video-1/hls/master.m3u8',
        thumbnailUrl: 'http://localhost:3000/media/videos/video-1/thumbnail',
        score: 70,
        viewCount: 20,
        likeCount: 5,
      },
      {
        id: 'video-2',
        title: 'two',
        description: 'desc two',
        durationSeconds: 95,
        uploader: {
          id: 'uploader-2',
          nickname: 'user2',
        },
        createdAt: '2026-02-14T09:00:00.000Z',
        playbackUrl: 'http://localhost:3000/media/videos/video-2/hls/master.m3u8',
        thumbnailUrl: 'http://localhost:3000/media/videos/video-2/thumbnail',
        score: 40,
        viewCount: 10,
        likeCount: 3,
      },
    ]);
  });
});
