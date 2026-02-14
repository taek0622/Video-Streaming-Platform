import { VideoStatus } from '@prisma/client';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { getHlsManifestPublicPath } from '../storage/local-upload-url-provider';
import { transcodeVideoToAdaptiveStreams } from './adaptive-transcoder';

type VideoProcessingStore = {
  video: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
    update: (args: {
      where: { id: string };
      data: {
        status: VideoStatus;
        playbackPath?: string | null;
        errorMessage?: string | null;
      };
    }) => Promise<unknown>;
  };
};

type VideoProcessingJobRunnerOptions = {
  store: VideoProcessingStore;
  transcode: (videoId: string) => Promise<void>;
  playbackPathBuilder: (videoId: string) => string;
  logError?: (payload: { err: unknown; videoId: string; message: string }) => void;
};

export const shortenErrorMessage = (error: unknown): string => {
  const rawMessage = error instanceof Error ? error.message : 'Unknown processing error';
  const compact = rawMessage.replace(/\s+/g, ' ').trim();

  return compact.length > 180 ? compact.slice(0, 180) : compact;
};

export const createVideoProcessingJobRunner = (options: VideoProcessingJobRunnerOptions) => {
  return {
    async process(videoId: string): Promise<void> {
      const video = await options.store.video.findUnique({
        where: { id: videoId },
        select: {
          id: true,
        },
      });

      if (!video) {
        return;
      }

      try {
        await options.transcode(videoId);

        await options.store.video.update({
          where: { id: videoId },
          data: {
            status: VideoStatus.READY,
            playbackPath: options.playbackPathBuilder(videoId),
            errorMessage: null,
          },
        });
      } catch (error) {
        const errorMessage = shortenErrorMessage(error);

        options.logError?.({
          err: error,
          videoId,
          message: errorMessage,
        });

        await options.store.video.update({
          where: { id: videoId },
          data: {
            status: VideoStatus.FAILED,
            playbackPath: null,
            errorMessage,
          },
        });
      }
    },
  };
};

const runner = createVideoProcessingJobRunner({
  store: prisma,
  transcode: transcodeVideoToAdaptiveStreams,
  playbackPathBuilder: getHlsManifestPublicPath,
  logError: ({ err, videoId }) => {
    logger.error({ err, videoId }, 'Video processing job failed');
  },
});

const queuedIds = new Set<string>();
const queue: string[] = [];
let active = false;

const runQueue = async (): Promise<void> => {
  if (active) {
    return;
  }

  active = true;

  while (queue.length > 0) {
    const videoId = queue.shift();

    if (!videoId) {
      continue;
    }

    queuedIds.delete(videoId);

    try {
      await runner.process(videoId);
    } catch (error) {
      logger.error({ err: error, videoId }, 'Unexpected video processing worker failure');
    }
  }

  active = false;
};

export const enqueueVideoProcessingJob = (videoId: string): void => {
  if (queuedIds.has(videoId)) {
    return;
  }

  queuedIds.add(videoId);
  queue.push(videoId);

  void runQueue();
};
