import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signAccessToken } from '../lib/jwt';
import { mediaRouter } from './media.route';
import { env } from '../config/env';
import { errorHandler } from '../middlewares/error-handler';

const mocks = vi.hoisted(() => ({
  videoFindUniqueMock: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    video: {
      findUnique: mocks.videoFindUniqueMock,
    },
  },
}));

const storageRootPath = path.isAbsolute(env.localStorageDir)
  ? env.localStorageDir
  : path.resolve(process.cwd(), env.localStorageDir);

const testVideoId = 'media-test-video';
const hlsDir = path.join(storageRootPath, 'videos', testVideoId, 'hls');

const createApp = () => {
  const app = express();
  app.use('/media', mediaRouter);
  app.use(errorHandler);
  return app;
};

beforeEach(() => {
  vi.clearAllMocks();

  mocks.videoFindUniqueMock.mockResolvedValue({
    uploaderId: 'uploader-1',
    visibility: 'PUBLIC',
  });
});

afterEach(async () => {
  await fs.rm(path.join(storageRootPath, 'videos', testVideoId), { recursive: true, force: true });
});

describe('media route integration', () => {
  it('serves m3u8 with expected headers', async () => {
    await fs.mkdir(hlsDir, { recursive: true });

    const m3u8Body = `#EXTM3U${os.EOL}#EXT-X-VERSION:7${os.EOL}#EXTINF:6.000000,${os.EOL}segment_000.m4s${os.EOL}`;

    await fs.writeFile(path.join(hlsDir, 'master.m3u8'), m3u8Body, 'utf8');

    const response = await request(createApp()).get(`/media/videos/${testVideoId}/hls/master.m3u8`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/vnd.apple.mpegurl');
    expect(response.headers['accept-ranges']).toBe('bytes');
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.text).toContain('#EXTM3U');
  });

  it('serves m4s with expected content-type', async () => {
    await fs.mkdir(hlsDir, { recursive: true });
    await fs.writeFile(path.join(hlsDir, 'segment_000.m4s'), Buffer.from([0, 1, 2, 3]));

    const response = await request(createApp()).get(`/media/videos/${testVideoId}/hls/segment_000.m4s`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('video/iso.segment');
    expect(response.headers['accept-ranges']).toBe('bytes');
  });

  it('returns 404 for private video media when requester is not authenticated', async () => {
    await fs.mkdir(hlsDir, { recursive: true });
    await fs.writeFile(path.join(hlsDir, 'master.m3u8'), '#EXTM3U\n', 'utf8');

    mocks.videoFindUniqueMock.mockResolvedValue({
      uploaderId: 'uploader-1',
      visibility: 'PRIVATE',
    });

    const response = await request(createApp()).get(`/media/videos/${testVideoId}/hls/master.m3u8`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: 'MEDIA_NOT_FOUND',
      message: 'Media not found',
    });
  });

  it('returns 404 for private video media when requester is not uploader', async () => {
    await fs.mkdir(hlsDir, { recursive: true });
    await fs.writeFile(path.join(hlsDir, 'master.m3u8'), '#EXTM3U\n', 'utf8');

    mocks.videoFindUniqueMock.mockResolvedValue({
      uploaderId: 'uploader-1',
      visibility: 'PRIVATE',
    });

    const viewerToken = signAccessToken({
      id: 'viewer-1',
      nickname: 'viewer',
    });

    const response = await request(createApp())
      .get(`/media/videos/${testVideoId}/hls/master.m3u8`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: 'MEDIA_NOT_FOUND',
      message: 'Media not found',
    });
  });

  it('allows uploader to access private video media', async () => {
    await fs.mkdir(hlsDir, { recursive: true });
    await fs.writeFile(path.join(hlsDir, 'master.m3u8'), '#EXTM3U\n', 'utf8');

    mocks.videoFindUniqueMock.mockResolvedValue({
      uploaderId: 'uploader-1',
      visibility: 'PRIVATE',
    });

    const uploaderToken = signAccessToken({
      id: 'uploader-1',
      nickname: 'uploader',
    });

    const response = await request(createApp())
      .get(`/media/videos/${testVideoId}/hls/master.m3u8`)
      .set('Authorization', `Bearer ${uploaderToken}`);

    expect(response.status).toBe(200);
    expect(response.text).toContain('#EXTM3U');
  });
});
