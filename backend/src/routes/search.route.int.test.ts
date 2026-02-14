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
        thumbnailUrl: '/thumb4.jpg',
        createdAt: new Date('2026-02-10T00:00:00.000Z'),
        viewCount: 80,
        likeCount: 0,
      },
      {
        id: 'v1',
        title: 'cat top older',
        description: 'desc 1',
        thumbnailUrl: '/thumb1.jpg',
        createdAt: new Date('2026-02-10T00:00:00.000Z'),
        viewCount: 80,
        likeCount: 4,
      },
      {
        id: 'v5',
        title: 'cat bottom',
        description: 'desc bottom',
        thumbnailUrl: '/thumb5.jpg',
        createdAt: new Date('2026-02-09T00:00:00.000Z'),
        viewCount: 10,
        likeCount: 1,
      },
      {
        id: 'v3',
        title: 'cat middle',
        description: 'desc 3',
        thumbnailUrl: '/thumb3.jpg',
        createdAt: new Date('2026-02-11T00:00:00.000Z'),
        viewCount: 15,
        likeCount: 8,
      },
      {
        id: 'v2',
        title: 'cat top newer',
        description: 'desc 2',
        thumbnailUrl: '/thumb2.jpg',
        createdAt: new Date('2026-02-12T00:00:00.000Z'),
        viewCount: 20,
        likeCount: 10,
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
        thumbnailUrl: true,
        createdAt: true,
        viewCount: true,
        likeCount: true,
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
          thumbnailUrl: '/thumb3.jpg',
          score: 95,
          viewCount: 15,
          likeCount: 8,
          createdAt: '2026-02-11T00:00:00.000Z',
        },
        {
          id: 'v4',
          title: 'cat low',
          description: 'desc low',
          thumbnailUrl: '/thumb4.jpg',
          score: 80,
          viewCount: 80,
          likeCount: 0,
          createdAt: '2026-02-10T00:00:00.000Z',
        },
      ],
    });
  });
});
