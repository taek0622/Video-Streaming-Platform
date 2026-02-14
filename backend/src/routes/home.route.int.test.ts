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
        thumbnailUrl: '/thumb4.jpg',
        viewCount: 50,
        likeCount: 7,
        createdAt: new Date('2026-02-10T00:00:00.000Z'),
      },
      {
        id: 'v2',
        title: 'Video 2',
        thumbnailUrl: '/thumb2.jpg',
        viewCount: 20,
        likeCount: 10,
        createdAt: new Date('2026-02-12T00:00:00.000Z'),
      },
      {
        id: 'v1',
        title: 'Video 1',
        thumbnailUrl: '/thumb1.jpg',
        viewCount: 80,
        likeCount: 4,
        createdAt: new Date('2026-02-11T00:00:00.000Z'),
      },
      {
        id: 'v7',
        title: 'Video 7',
        thumbnailUrl: '/thumb7.jpg',
        viewCount: 5,
        likeCount: 0,
        createdAt: new Date('2026-02-14T00:00:00.000Z'),
      },
      {
        id: 'v5',
        title: 'Video 5',
        thumbnailUrl: '/thumb5.jpg',
        viewCount: 100,
        likeCount: 3,
        createdAt: new Date('2026-02-09T00:00:00.000Z'),
      },
      {
        id: 'v6',
        title: 'Video 6',
        thumbnailUrl: '/thumb6.jpg',
        viewCount: 10,
        likeCount: 8,
        createdAt: new Date('2026-02-13T00:00:00.000Z'),
      },
      {
        id: 'v3',
        title: 'Video 3',
        thumbnailUrl: '/thumb3.jpg',
        viewCount: 35,
        likeCount: 9,
        createdAt: new Date('2026-02-08T00:00:00.000Z'),
      },
    ];

    mocks.videoFindManyMock.mockResolvedValue(seedVideos);

    const response = await request(app).get('/home');

    expect(response.status).toBe(200);
    expect(mocks.videoFindManyMock).toHaveBeenCalledWith({
      where: {
        visibility: 'PUBLIC',
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

    expect(response.body).toEqual([
      {
        id: 'v5',
        title: 'Video 5',
        thumbnailUrl: '/thumb5.jpg',
        score: 130,
        viewCount: 100,
        likeCount: 3,
      },
      {
        id: 'v3',
        title: 'Video 3',
        thumbnailUrl: '/thumb3.jpg',
        score: 125,
        viewCount: 35,
        likeCount: 9,
      },
      {
        id: 'v2',
        title: 'Video 2',
        thumbnailUrl: '/thumb2.jpg',
        score: 120,
        viewCount: 20,
        likeCount: 10,
      },
      {
        id: 'v1',
        title: 'Video 1',
        thumbnailUrl: '/thumb1.jpg',
        score: 120,
        viewCount: 80,
        likeCount: 4,
      },
      {
        id: 'v4',
        title: 'Video 4',
        thumbnailUrl: '/thumb4.jpg',
        score: 120,
        viewCount: 50,
        likeCount: 7,
      },
      {
        id: 'v6',
        title: 'Video 6',
        thumbnailUrl: '/thumb6.jpg',
        score: 90,
        viewCount: 10,
        likeCount: 8,
      },
    ]);
  });
});
