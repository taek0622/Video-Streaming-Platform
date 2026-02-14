import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signAccessToken } from '../lib/jwt';

const mocks = vi.hoisted(() => ({
  videoCreateMock: vi.fn(),
  videoFindUniqueMock: vi.fn(),
  videoUpdateMock: vi.fn(),
  videoDeleteMock: vi.fn(),
  userUpsertMock: vi.fn(),
  createVideoUploadUrlMock: vi.fn(),
  createThumbnailUploadUrlMock: vi.fn(),
  enqueueVideoProcessingJobMock: vi.fn(),
  deleteVideoLocalFilesMock: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      upsert: mocks.userUpsertMock,
    },
    video: {
      create: mocks.videoCreateMock,
      findUnique: mocks.videoFindUniqueMock,
      update: mocks.videoUpdateMock,
      delete: mocks.videoDeleteMock,
    },
  },
}));

vi.mock('../services/storage/local-upload-url-provider', () => ({
  localUploadUrlProvider: {
    createVideoUploadUrl: mocks.createVideoUploadUrlMock,
    createThumbnailUploadUrl: mocks.createThumbnailUploadUrlMock,
  },
  getHlsManifestPublicPath: (videoId: string) => `/media/videos/${videoId}/hls/master.m3u8`,
  verifyUploadToken: vi.fn(),
  resolveUploadTarget: vi.fn(),
  localStorageRoot: 'uploads',
}));

vi.mock('../services/media/video-processing-worker', () => ({
  enqueueVideoProcessingJob: mocks.enqueueVideoProcessingJobMock,
}));

vi.mock('../services/storage/video-local-file-cleanup', () => ({
  deleteVideoLocalFiles: mocks.deleteVideoLocalFilesMock,
}));

import { app } from '../app';

describe('videos routes integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.videoCreateMock.mockResolvedValue({
      id: 'video-1',
      status: 'UPLOADING',
    });

    mocks.videoFindUniqueMock.mockResolvedValue({
      id: 'video-1',
      uploaderId: 'uploader-1',
    });

    mocks.videoUpdateMock.mockResolvedValue({
      id: 'video-1',
      status: 'PROCESSING',
      updatedAt: new Date('2026-02-14T00:00:00.000Z'),
    });

    mocks.videoDeleteMock.mockResolvedValue({
      id: 'video-1',
    });

    mocks.deleteVideoLocalFilesMock.mockResolvedValue(undefined);

    mocks.createVideoUploadUrlMock.mockResolvedValue({
      url: 'http://localhost:3000/storage/upload?token=video-token',
      method: 'PUT',
      headers: {
        'content-type': 'application/octet-stream',
      },
    });

    mocks.createThumbnailUploadUrlMock.mockResolvedValue({
      url: 'http://localhost:3000/storage/upload?token=thumbnail-token',
      method: 'PUT',
      headers: {
        'content-type': 'image/jpeg',
      },
    });
  });

  it('returns 401 when creating a video without token', async () => {
    const response = await request(app).post('/videos').send({
      title: 'My first video',
      visibility: 'PUBLIC',
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
    });
  });

  it('returns 403 when requesting upload url for non-uploader', async () => {
    const token = signAccessToken({
      id: 'viewer-1',
      nickname: 'viewer',
    });

    mocks.videoFindUniqueMock.mockResolvedValue({
      id: 'video-1',
      uploaderId: 'uploader-1',
    });

    const response = await request(app)
      .post('/videos/video-1/upload-url')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      code: 'FORBIDDEN',
      message: 'Forbidden',
    });
  });

  it('creates a video and returns uploading status for authenticated user', async () => {
    const token = signAccessToken({
      id: 'uploader-1',
      nickname: 'uploader',
    });

    const response = await request(app)
      .post('/videos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'My first video',
        description: 'hello',
        visibility: 'PUBLIC',
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 'video-1',
      status: 'UPLOADING',
    });
    expect(mocks.videoCreateMock).toHaveBeenCalledTimes(1);
  });

  it('returns hls playback url when video is ready', async () => {
    mocks.videoFindUniqueMock.mockResolvedValue({
      id: 'video-1',
      uploaderId: 'uploader-1',
      visibility: 'PUBLIC',
      status: 'READY',
      playbackPath: '/media/videos/video-1/hls/master.m3u8',
    });

    const response = await request(app).get('/videos/video-1/playback');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 'video-1',
      status: 'READY',
      hlsUrl: 'http://localhost:3000/media/videos/video-1/hls/master.m3u8',
    });
  });

  it('marks video as processing on complete for uploader and enqueues job', async () => {
    const token = signAccessToken({
      id: 'uploader-1',
      nickname: 'uploader',
    });

    mocks.videoFindUniqueMock.mockResolvedValue({
      id: 'video-1',
      uploaderId: 'uploader-1',
    });

    mocks.videoUpdateMock.mockResolvedValue({
      id: 'video-1',
      status: 'PROCESSING',
      updatedAt: new Date('2026-02-14T12:00:00.000Z'),
    });

    const response = await request(app)
      .post('/videos/video-1/complete')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 'video-1',
      status: 'PROCESSING',
      updatedAt: '2026-02-14T12:00:00.000Z',
    });
    expect(mocks.videoUpdateMock).toHaveBeenCalledWith({
      where: { id: 'video-1' },
      data: { status: 'PROCESSING', errorMessage: null, playbackPath: null },
      select: { id: true, status: true, updatedAt: true },
    });
    expect(mocks.enqueueVideoProcessingJobMock).toHaveBeenCalledWith('video-1');
  });

  it('deletes video for uploader after removing local files', async () => {
    const token = signAccessToken({
      id: 'uploader-1',
      nickname: 'uploader',
    });

    mocks.videoFindUniqueMock.mockResolvedValue({
      id: 'video-1',
      uploaderId: 'uploader-1',
    });

    const response = await request(app)
      .delete('/videos/video-1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 'video-1',
      deleted: true,
    });
    expect(mocks.deleteVideoLocalFilesMock).toHaveBeenCalledWith('video-1');
    expect(mocks.videoDeleteMock).toHaveBeenCalledWith({
      where: { id: 'video-1' },
      select: { id: true },
    });
  });

  it('returns 403 when non-uploader tries to delete a video', async () => {
    const token = signAccessToken({
      id: 'viewer-1',
      nickname: 'viewer',
    });

    mocks.videoFindUniqueMock.mockResolvedValue({
      id: 'video-1',
      uploaderId: 'uploader-1',
    });

    const response = await request(app)
      .delete('/videos/video-1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      code: 'FORBIDDEN',
      message: 'Forbidden',
    });
    expect(mocks.deleteVideoLocalFilesMock).not.toHaveBeenCalled();
    expect(mocks.videoDeleteMock).not.toHaveBeenCalled();
  });

  it('returns 500 when local file cleanup fails and keeps db row for retry', async () => {
    const token = signAccessToken({
      id: 'uploader-1',
      nickname: 'uploader',
    });

    mocks.videoFindUniqueMock.mockResolvedValue({
      id: 'video-1',
      uploaderId: 'uploader-1',
    });
    mocks.deleteVideoLocalFilesMock.mockRejectedValue(new Error('disk io error'));

    const response = await request(app)
      .delete('/videos/video-1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      code: 'VIDEO_FILE_DELETE_FAILED',
      message: 'Failed to delete video files',
    });
    expect(mocks.videoDeleteMock).not.toHaveBeenCalled();
  });

  it('returns 404 for private video detail when requester is not uploader', async () => {
    const token = signAccessToken({
      id: 'viewer-1',
      nickname: 'viewer',
    });

    mocks.videoFindUniqueMock.mockResolvedValue({
      id: 'video-1',
      uploaderId: 'uploader-1',
      visibility: 'PRIVATE',
      status: 'READY',
      playbackPath: '/media/videos/video-1/hls/master.m3u8',
      errorMessage: null,
      title: 'private video',
      description: 'secret',
      thumbnailUrl: '/uploads/videos/video-1/thumbnail.jpg',
      createdAt: new Date('2026-02-14T12:00:00.000Z'),
      viewCount: 10,
      likeCount: 2,
    });

    const response = await request(app)
      .get('/videos/video-1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: 'VIDEO_NOT_FOUND',
      message: 'Video not found',
    });
  });

  it('returns detail with playbackUrl for public ready video', async () => {
    mocks.videoFindUniqueMock.mockResolvedValue({
      id: 'video-1',
      uploaderId: 'uploader-1',
      visibility: 'PUBLIC',
      status: 'READY',
      playbackPath: '/media/videos/video-1/hls/master.m3u8',
      errorMessage: null,
      title: 'public video',
      description: 'hello',
      thumbnailUrl: '/uploads/videos/video-1/thumbnail.jpg',
      createdAt: new Date('2026-02-14T12:00:00.000Z'),
      viewCount: 4,
      likeCount: 1,
    });

    const response = await request(app).get('/videos/video-1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'READY',
      errorMessage: null,
      playbackUrl: 'http://localhost:3000/media/videos/video-1/hls/master.m3u8',
      title: 'public video',
      description: 'hello',
      thumbnailUrl: '/uploads/videos/video-1/thumbnail.jpg',
      createdAt: '2026-02-14T12:00:00.000Z',
      viewCount: 4,
      likeCount: 1,
    });
  });

  it('returns processing status for video detail while conversion job is running', async () => {
    mocks.videoFindUniqueMock.mockResolvedValue({
      id: 'video-1',
      uploaderId: 'uploader-1',
      visibility: 'PUBLIC',
      status: 'PROCESSING',
      playbackPath: null,
      errorMessage: null,
      title: 'processing video',
      description: 'still transcoding',
      thumbnailUrl: '/uploads/videos/video-1/thumbnail.jpg',
      createdAt: new Date('2026-02-14T12:00:00.000Z'),
      viewCount: 4,
      likeCount: 1,
    });

    const response = await request(app).get('/videos/video-1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'PROCESSING',
      errorMessage: null,
      playbackUrl: null,
      title: 'processing video',
      description: 'still transcoding',
      thumbnailUrl: '/uploads/videos/video-1/thumbnail.jpg',
      createdAt: '2026-02-14T12:00:00.000Z',
      viewCount: 4,
      likeCount: 1,
    });
  });
});
