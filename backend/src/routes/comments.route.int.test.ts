import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signAccessToken } from '../lib/jwt';

const mocks = vi.hoisted(() => ({
  videoFindUniqueMock: vi.fn(),
  commentFindUniqueMock: vi.fn(),
  commentCreateMock: vi.fn(),
  commentUpdateMock: vi.fn(),
  commentFindManyMock: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    video: {
      findUnique: mocks.videoFindUniqueMock,
    },
    comment: {
      findUnique: mocks.commentFindUniqueMock,
      create: mocks.commentCreateMock,
      update: mocks.commentUpdateMock,
      findMany: mocks.commentFindManyMock,
    },
  },
}));

import { app } from '../app';

describe('comments routes integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when attempting reply to a reply (depth 2)', async () => {
    const token = signAccessToken({
      id: 'user-1',
      nickname: 'author',
    });

    mocks.videoFindUniqueMock.mockResolvedValue({ id: 'video-1' });
    mocks.commentFindUniqueMock.mockResolvedValue({
      id: 'reply-1',
      videoId: 'video-1',
      parentId: 'root-1',
      deletedAt: null,
    });

    const response = await request(app)
      .post('/videos/video-1/comments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'nested reply',
        parentId: 'reply-1',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: 'COMMENT_DEPTH_EXCEEDED',
      message: 'Replies can only target top-level comments',
    });
  });

  it('returns 403 when non-author tries to edit comment', async () => {
    const token = signAccessToken({
      id: 'viewer-1',
      nickname: 'viewer',
    });

    mocks.commentFindUniqueMock.mockResolvedValue({
      id: 'comment-1',
      userId: 'author-1',
      deletedAt: null,
    });

    const response = await request(app)
      .patch('/comments/comment-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'edited' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      code: 'FORBIDDEN',
      message: 'Forbidden',
    });
  });

  it('returns 403 when requester is neither author nor uploader on delete', async () => {
    const token = signAccessToken({
      id: 'viewer-1',
      nickname: 'viewer',
    });

    mocks.commentFindUniqueMock.mockResolvedValue({
      id: 'comment-1',
      userId: 'author-1',
      deletedAt: null,
      video: {
        uploaderId: 'uploader-1',
      },
    });

    const response = await request(app)
      .delete('/comments/comment-1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      code: 'FORBIDDEN',
      message: 'Forbidden',
    });
  });

  it('returns one-level nested comments for public video', async () => {
    mocks.videoFindUniqueMock.mockResolvedValue({
      id: 'video-1',
      visibility: 'PUBLIC',
    });

    mocks.commentFindManyMock.mockResolvedValue([
      {
        id: 'root-1',
        userId: 'user-a',
        parentId: null,
        content: 'root comment',
        createdAt: new Date('2026-02-14T10:00:00.000Z'),
        updatedAt: new Date('2026-02-14T10:00:00.000Z'),
      },
      {
        id: 'reply-1',
        userId: 'user-b',
        parentId: 'root-1',
        content: 'reply comment',
        createdAt: new Date('2026-02-14T10:01:00.000Z'),
        updatedAt: new Date('2026-02-14T10:01:00.000Z'),
      },
    ]);

    const response = await request(app).get('/videos/video-1/comments');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: 'root-1',
        userId: 'user-a',
        parentId: null,
        content: 'root comment',
        createdAt: '2026-02-14T10:00:00.000Z',
        updatedAt: '2026-02-14T10:00:00.000Z',
        replies: [
          {
            id: 'reply-1',
            userId: 'user-b',
            parentId: 'root-1',
            content: 'reply comment',
            createdAt: '2026-02-14T10:01:00.000Z',
            updatedAt: '2026-02-14T10:01:00.000Z',
          },
        ],
      },
    ]);
  });
});
