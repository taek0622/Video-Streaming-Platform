import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signAccessToken } from '../lib/jwt';
import { getSourceVideoAbsolutePath, getVideoPublicAbsoluteDirectory } from '../services/storage/local-upload-url-provider';

const mocks = vi.hoisted(() => ({
  userUpsertMock: vi.fn(),
  videoFindUniqueMock: vi.fn(),
  videoDeleteMock: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      upsert: mocks.userUpsertMock,
    },
    video: {
      findUnique: mocks.videoFindUniqueMock,
      delete: mocks.videoDeleteMock,
    },
  },
}));

import { app } from '../app';

const testVideoId = 'delete-storage-video';
const publicVideoDirectory = getVideoPublicAbsoluteDirectory(testVideoId);
const hlsDirectory = path.join(publicVideoDirectory, 'hls');
const masterPlaylistPath = path.join(hlsDirectory, 'master.m3u8');
const segmentPath = path.join(hlsDirectory, 'segment_000.m4s');
const thumbnailPath = path.join(publicVideoDirectory, 'thumbnail.jpg');
const sourceInputPath = getSourceVideoAbsolutePath(testVideoId);
const ingestDirectory = path.dirname(sourceInputPath);

describe('video delete storage integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.videoFindUniqueMock.mockResolvedValue({
      id: testVideoId,
      uploaderId: 'uploader-1',
    });

    mocks.videoDeleteMock.mockResolvedValue({
      id: testVideoId,
    });
  });

  afterEach(async () => {
    await fs.rm(publicVideoDirectory, { recursive: true, force: true });
    await fs.rm(ingestDirectory, { recursive: true, force: true });
  });

  it('deletes local video files and serves media as 404 afterward', async () => {
    await fs.mkdir(hlsDirectory, { recursive: true });
    await fs.mkdir(path.dirname(sourceInputPath), { recursive: true });
    await fs.writeFile(masterPlaylistPath, '#EXTM3U\n#EXT-X-VERSION:7\n', 'utf8');
    await fs.writeFile(segmentPath, Buffer.from([0, 1, 2, 3]));
    await fs.writeFile(thumbnailPath, Buffer.from([3, 2, 1]));
    await fs.writeFile(sourceInputPath, Buffer.from([9, 9, 9]));

    const mediaBeforeDelete = await request(app).get(`/media/videos/${testVideoId}/hls/master.m3u8`);
    expect(mediaBeforeDelete.status).toBe(200);

    const token = signAccessToken({
      id: 'uploader-1',
      nickname: 'uploader',
    });

    const deleteResponse = await request(app)
      .delete(`/videos/${testVideoId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual({
      id: testVideoId,
      deleted: true,
    });

    await expect(fs.access(masterPlaylistPath)).rejects.toHaveProperty('code', 'ENOENT');
    await expect(fs.access(segmentPath)).rejects.toHaveProperty('code', 'ENOENT');
    await expect(fs.access(thumbnailPath)).rejects.toHaveProperty('code', 'ENOENT');
    await expect(fs.access(sourceInputPath)).rejects.toHaveProperty('code', 'ENOENT');

    const mediaAfterDelete = await request(app).get(`/media/videos/${testVideoId}/hls/master.m3u8`);
    expect(mediaAfterDelete.status).toBe(404);
    expect(mediaAfterDelete.body).toEqual({
      code: 'MEDIA_NOT_FOUND',
      message: 'Media not found',
    });
  });
});
