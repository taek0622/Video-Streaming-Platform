export const VIEW_THROTTLE_MS = 60 * 60 * 1000;

type VideoSnapshot = {
  id: string;
  viewCount: number;
};

type UpdatedVideoSnapshot = {
  viewCount: number;
};

type ViewEventSnapshot = {
  lastViewedAt: Date;
};

export type VideoViewResult = {
  counted: boolean;
  viewCount: number;
};

export type VideoViewStore = {
  video: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true; viewCount: true };
    }) => Promise<VideoSnapshot | null>;
    update: (args: {
      where: { id: string };
      data: { viewCount: { increment: number } };
      select: { viewCount: true };
    }) => Promise<UpdatedVideoSnapshot>;
  };
  viewEvent: {
    findUnique: (args: {
      where: { videoId_viewerKey: { videoId: string; viewerKey: string } };
      select: { lastViewedAt: true };
    }) => Promise<ViewEventSnapshot | null>;
    upsert: (args: {
      where: { videoId_viewerKey: { videoId: string; viewerKey: string } };
      create: { videoId: string; viewerKey: string; lastViewedAt: Date };
      update: { lastViewedAt: Date };
    }) => Promise<unknown>;
  };
};

type VideoViewCounterOptions = {
  store: VideoViewStore;
  now?: () => Date;
  throttleMs?: number;
};

type RegisterVideoViewInput = {
  videoId: string;
  viewerKey: string;
};

const shouldCountView = (lastViewedAt: Date | null, now: Date, throttleMs: number): boolean => {
  if (!lastViewedAt) {
    return true;
  }

  return now.getTime() - lastViewedAt.getTime() >= throttleMs;
};

export const createVideoViewCounter = (options: VideoViewCounterOptions) => {
  const now = options.now ?? (() => new Date());
  const throttleMs = options.throttleMs ?? VIEW_THROTTLE_MS;

  return {
    async registerView(input: RegisterVideoViewInput): Promise<VideoViewResult | null> {
      const video = await options.store.video.findUnique({
        where: { id: input.videoId },
        select: { id: true, viewCount: true },
      });

      if (!video) {
        return null;
      }

      const viewEvent = await options.store.viewEvent.findUnique({
        where: {
          videoId_viewerKey: {
            videoId: input.videoId,
            viewerKey: input.viewerKey,
          },
        },
        select: {
          lastViewedAt: true,
        },
      });

      const currentTime = now();
      const counted = shouldCountView(viewEvent?.lastViewedAt ?? null, currentTime, throttleMs);

      if (!counted) {
        return {
          counted: false,
          viewCount: video.viewCount,
        };
      }

      const updatedVideo = await options.store.video.update({
        where: { id: input.videoId },
        data: {
          viewCount: {
            increment: 1,
          },
        },
        select: {
          viewCount: true,
        },
      });

      await options.store.viewEvent.upsert({
        where: {
          videoId_viewerKey: {
            videoId: input.videoId,
            viewerKey: input.viewerKey,
          },
        },
        create: {
          videoId: input.videoId,
          viewerKey: input.viewerKey,
          lastViewedAt: currentTime,
        },
        update: {
          lastViewedAt: currentTime,
        },
      });

      return {
        counted: true,
        viewCount: updatedVideo.viewCount,
      };
    },
  };
};
