import { AppError } from '../../errors/app-error';

type VideoSnapshot = {
  id: string;
  likeCount: number;
};

type UpdatedVideoSnapshot = {
  likeCount: number;
};

type LikeToggleResult = {
  liked: boolean;
  likeCount: number;
};

type LikeTxClient = {
  video: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true; likeCount: true };
    }) => Promise<VideoSnapshot | null>;
    update: (args: {
      where: { id: string };
      data: { likeCount: { increment?: number; decrement?: number } };
      select: { likeCount: true };
    }) => Promise<UpdatedVideoSnapshot>;
  };
  like: {
    findUnique: (args: {
      where: { userId_videoId: { userId: string; videoId: string } };
      select: { userId: true };
    }) => Promise<{ userId: string } | null>;
    create: (args: { data: { userId: string; videoId: string } }) => Promise<unknown>;
    delete: (args: { where: { userId_videoId: { userId: string; videoId: string } } }) => Promise<unknown>;
  };
};

type LikeStore = {
  $transaction: <T>(fn: (tx: LikeTxClient) => Promise<T>) => Promise<T>;
};

const ensureVideo = async (tx: LikeTxClient, videoId: string): Promise<VideoSnapshot> => {
  const video = await tx.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      likeCount: true,
    },
  });

  if (!video) {
    throw new AppError(404, 'VIDEO_NOT_FOUND', 'Video not found');
  }

  return video;
};

export const createLikeToggleService = (store: LikeStore) => {
  return {
    async like(videoId: string, userId: string): Promise<LikeToggleResult> {
      return store.$transaction(async (tx) => {
        const video = await ensureVideo(tx, videoId);
        const existingLike = await tx.like.findUnique({
          where: {
            userId_videoId: {
              userId,
              videoId,
            },
          },
          select: {
            userId: true,
          },
        });

        if (existingLike) {
          return {
            liked: true,
            likeCount: video.likeCount,
          };
        }

        await tx.like.create({
          data: {
            userId,
            videoId,
          },
        });

        const updatedVideo = await tx.video.update({
          where: { id: videoId },
          data: {
            likeCount: {
              increment: 1,
            },
          },
          select: {
            likeCount: true,
          },
        });

        return {
          liked: true,
          likeCount: updatedVideo.likeCount,
        };
      });
    },

    async unlike(videoId: string, userId: string): Promise<LikeToggleResult> {
      return store.$transaction(async (tx) => {
        const video = await ensureVideo(tx, videoId);
        const existingLike = await tx.like.findUnique({
          where: {
            userId_videoId: {
              userId,
              videoId,
            },
          },
          select: {
            userId: true,
          },
        });

        if (!existingLike) {
          return {
            liked: false,
            likeCount: video.likeCount,
          };
        }

        await tx.like.delete({
          where: {
            userId_videoId: {
              userId,
              videoId,
            },
          },
        });

        if (video.likeCount <= 0) {
          return {
            liked: false,
            likeCount: 0,
          };
        }

        const updatedVideo = await tx.video.update({
          where: { id: videoId },
          data: {
            likeCount: {
              decrement: 1,
            },
          },
          select: {
            likeCount: true,
          },
        });

        return {
          liked: false,
          likeCount: updatedVideo.likeCount,
        };
      });
    },
  };
};
