import { VideoStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { createVideoProcessingJobRunner } from './video-processing-worker';

describe('video processing worker', () => {
  it('marks video as READY and stores playbackPath on success', async () => {
    const findUniqueMock = vi.fn().mockResolvedValue({ id: 'video-1' });
    const updateMock = vi.fn().mockResolvedValue({});
    const transcodeMock = vi.fn().mockResolvedValue(undefined);

    const runner = createVideoProcessingJobRunner({
      store: {
        video: {
          findUnique: findUniqueMock,
          update: updateMock,
        },
      },
      transcode: transcodeMock,
      playbackPathBuilder: (videoId) => `/media/videos/${videoId}/hls/master.m3u8`,
    });

    await runner.process('video-1');

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'video-1' },
      data: {
        status: VideoStatus.READY,
        playbackPath: '/media/videos/video-1/hls/master.m3u8',
        errorMessage: null,
      },
    });
  });

  it('marks video as FAILED and stores short error message when transcode fails', async () => {
    const findUniqueMock = vi.fn().mockResolvedValue({ id: 'video-1' });
    const updateMock = vi.fn().mockResolvedValue({});
    const transcodeMock = vi.fn().mockRejectedValue(
      new Error(
        'ffmpeg crashed with a very long detail line that should be compacted and possibly truncated to keep db message short',
      ),
    );

    const runner = createVideoProcessingJobRunner({
      store: {
        video: {
          findUnique: findUniqueMock,
          update: updateMock,
        },
      },
      transcode: transcodeMock,
      playbackPathBuilder: (videoId) => `/media/videos/${videoId}/hls/master.m3u8`,
    });

    await runner.process('video-1');

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'video-1' },
      data: {
        status: VideoStatus.FAILED,
        playbackPath: null,
        errorMessage:
          'ffmpeg crashed with a very long detail line that should be compacted and possibly truncated to keep db message short',
      },
    });
  });
});
