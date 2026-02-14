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
          thumbnailUrl: '/thumb1.jpg',
          createdAt: new Date('2026-02-14T10:00:00.000Z'),
          viewCount: 20,
          likeCount: 5,
        },
      },
      {
        video: {
          id: 'video-2',
          title: 'two',
          thumbnailUrl: '/thumb2.jpg',
          createdAt: new Date('2026-02-14T09:00:00.000Z'),
          viewCount: 10,
          likeCount: 3,
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
    expect(response.body).toEqual([
      {
        id: 'video-1',
        title: 'one',
        thumbnailUrl: '/thumb1.jpg',
        createdAt: '2026-02-14T10:00:00.000Z',
        viewCount: 20,
        likeCount: 5,
      },
      {
        id: 'video-2',
        title: 'two',
        thumbnailUrl: '/thumb2.jpg',
        createdAt: '2026-02-14T09:00:00.000Z',
        viewCount: 10,
        likeCount: 3,
      },
    ]);
  });
});
