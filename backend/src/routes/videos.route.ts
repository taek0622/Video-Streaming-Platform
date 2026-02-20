import { VideoStatus, VideoVisibility } from '@prisma/client';
import { Router } from 'express';
import { AppError } from '../errors/app-error';
import { prisma } from '../lib/prisma';
import { attachAuthIfPresent, requireAuth } from '../middlewares/authenticate-jwt';
import { buildPlaybackUrl } from '../services/media/adaptive-transcoder';
import { buildThumbnailUrl } from '../services/media/media-url';
import { enqueueVideoProcessingJob } from '../services/media/video-processing-worker';
import { createLikeToggleService } from '../services/likes/like-toggle';
import { localUploadUrlProvider } from '../services/storage/local-upload-url-provider';
import { deleteVideoLocalFiles } from '../services/storage/video-local-file-cleanup';
import { createVideoViewCounter } from '../services/views/view-counter';
import { createViewerKeyResolver } from '../services/views/viewer-key';

export const videosRouter = Router();
const videoViewCounter = createVideoViewCounter({ store: prisma });
const resolveViewerKey = createViewerKeyResolver();
const likeToggleService = createLikeToggleService(prisma);

const isVideoVisibility = (value: unknown): value is VideoVisibility => {
  return value === 'PUBLIC' || value === 'PRIVATE';
};

const ensureAuthenticatedUser = (user: { id: string; nickname: string } | undefined): { id: string; nickname: string } => {
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
  }

  return user;
};

const ensureUploader = async (videoId: string, userId: string): Promise<void> => {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      uploaderId: true,
    },
  });

  if (!video) {
    throw new AppError(404, 'VIDEO_NOT_FOUND', 'Video not found');
  }

  if (video.uploaderId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }
};

const parseCommentContent = (contentRaw: unknown): string => {
  if (typeof contentRaw !== 'string') {
    throw new AppError(400, 'INVALID_CONTENT', 'content is required');
  }

  const content = contentRaw.trim();

  if (!content) {
    throw new AppError(400, 'INVALID_CONTENT', 'content is required');
  }

  return content;
};

const calculateScore = (viewCount: number, likeCount: number): number => {
  return viewCount + likeCount * 10;
};

videosRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const user = ensureAuthenticatedUser(req.user);
    const titleRaw = req.body?.title;
    const descriptionRaw = req.body?.description;
    const visibilityRaw = req.body?.visibility;

    if (typeof titleRaw !== 'string') {
      throw new AppError(400, 'INVALID_TITLE', 'title is required');
    }

    const title = titleRaw.trim();

    if (!title) {
      throw new AppError(400, 'INVALID_TITLE', 'title is required');
    }

    if (descriptionRaw !== undefined && typeof descriptionRaw !== 'string') {
      throw new AppError(400, 'INVALID_DESCRIPTION', 'description must be a string');
    }

    if (!isVideoVisibility(visibilityRaw)) {
      throw new AppError(400, 'INVALID_VISIBILITY', 'visibility must be PUBLIC or PRIVATE');
    }

    const description = typeof descriptionRaw === 'string' ? descriptionRaw.trim() : null;

    const video = await prisma.video.create({
      data: {
        uploaderId: user.id,
        title,
        description: description || null,
        thumbnailUrl: '',
        visibility: visibilityRaw,
        status: VideoStatus.UPLOADING,
      },
      select: {
        id: true,
        status: true,
      },
    });

    res.status(201).json({
      id: video.id,
      status: video.status,
    });
  } catch (error) {
    next(error);
  }
});

videosRouter.post('/:id/upload-url', requireAuth, async (req, res, next) => {
  try {
    const user = ensureAuthenticatedUser(req.user);
    const videoId = req.params.id;

    await ensureUploader(videoId, user.id);

    const uploadUrl = await localUploadUrlProvider.createVideoUploadUrl({ videoId });

    res.status(200).json(uploadUrl);
  } catch (error) {
    next(error);
  }
});

videosRouter.post('/:id/thumbnail-upload-url', requireAuth, async (req, res, next) => {
  try {
    const user = ensureAuthenticatedUser(req.user);
    const videoId = req.params.id;

    await ensureUploader(videoId, user.id);

    const uploadUrl = await localUploadUrlProvider.createThumbnailUploadUrl({ videoId });

    res.status(200).json(uploadUrl);
  } catch (error) {
    next(error);
  }
});

videosRouter.post('/:id/complete', requireAuth, async (req, res, next) => {
  try {
    const user = ensureAuthenticatedUser(req.user);
    const videoId = req.params.id;

    await ensureUploader(videoId, user.id);

    const video = await prisma.video.update({
      where: { id: videoId },
      data: {
        status: VideoStatus.PROCESSING,
        errorMessage: null,
        playbackPath: null,
        durationSeconds: null,
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    enqueueVideoProcessingJob(videoId);

    res.status(200).json({
      id: video.id,
      status: video.status,
      updatedAt: video.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

videosRouter.post('/:id/view', attachAuthIfPresent, async (req, res, next) => {
  try {
    const videoId = req.params.id;
    const viewerKey = resolveViewerKey(req);

    const result = await videoViewCounter.registerView({
      videoId,
      viewerKey,
    });

    if (!result) {
      throw new AppError(404, 'VIDEO_NOT_FOUND', 'Video not found');
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

videosRouter.post('/:id/comments', requireAuth, async (req, res, next) => {
  try {
    const user = ensureAuthenticatedUser(req.user);
    const videoId = req.params.id;
    const content = parseCommentContent(req.body?.content);
    const parentIdRaw = req.body?.parentId;

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true },
    });

    if (!video) {
      throw new AppError(404, 'VIDEO_NOT_FOUND', 'Video not found');
    }

    let parentId: string | null = null;

    if (parentIdRaw !== undefined) {
      if (typeof parentIdRaw !== 'string' || !parentIdRaw.trim()) {
        throw new AppError(400, 'INVALID_PARENT_COMMENT', 'parentId must be a valid comment id');
      }

      parentId = parentIdRaw.trim();

      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: {
          id: true,
          videoId: true,
          parentId: true,
          deletedAt: true,
        },
      });

      if (!parentComment || parentComment.deletedAt || parentComment.videoId !== videoId) {
        throw new AppError(400, 'INVALID_PARENT_COMMENT', 'parentId must be a valid top-level comment');
      }

      if (parentComment.parentId) {
        throw new AppError(400, 'COMMENT_DEPTH_EXCEEDED', 'Replies can only target top-level comments');
      }
    }

    const comment = await prisma.comment.create({
      data: {
        videoId,
        userId: user.id,
        parentId,
        content,
      },
      select: {
        id: true,
        videoId: true,
        userId: true,
        parentId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
});

videosRouter.post('/:id/like', requireAuth, async (req, res, next) => {
  try {
    const user = ensureAuthenticatedUser(req.user);
    const result = await likeToggleService.like(req.params.id, user.id);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

videosRouter.delete('/:id/like', requireAuth, async (req, res, next) => {
  try {
    const user = ensureAuthenticatedUser(req.user);
    const result = await likeToggleService.unlike(req.params.id, user.id);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

videosRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const user = ensureAuthenticatedUser(req.user);
    const videoId = req.params.id;

    await ensureUploader(videoId, user.id);

    try {
      await deleteVideoLocalFiles(videoId);
    } catch {
      throw new AppError(500, 'VIDEO_FILE_DELETE_FAILED', 'Failed to delete video files');
    }

    const deletedVideo = await prisma.video.delete({
      where: { id: videoId },
      select: {
        id: true,
      },
    });

    res.status(200).json({
      id: deletedVideo.id,
      deleted: true,
    });
  } catch (error) {
    next(error);
  }
});

videosRouter.get('/:id/comments', async (req, res, next) => {
  try {
    const videoId = req.params.id;
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        visibility: true,
      },
    });

    if (!video || video.visibility !== VideoVisibility.PUBLIC) {
      throw new AppError(404, 'VIDEO_NOT_FOUND', 'Video not found');
    }

    const comments = await prisma.comment.findMany({
      where: {
        videoId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        userId: true,
        parentId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    type CommentNode = {
      id: string;
      userId: string;
      parentId: string | null;
      content: string;
      createdAt: Date;
      updatedAt: Date;
      replies: Array<{
        id: string;
        userId: string;
        parentId: string;
        content: string;
        createdAt: Date;
        updatedAt: Date;
      }>;
    };

    const topLevelComments: CommentNode[] = [];
    const commentIndex = new Map<string, CommentNode>();

    for (const comment of comments) {
      if (!comment.parentId) {
        const node: CommentNode = {
          ...comment,
          parentId: null,
          replies: [],
        };

        topLevelComments.push(node);
        commentIndex.set(comment.id, node);
      }
    }

    for (const comment of comments) {
      if (!comment.parentId) {
        continue;
      }

      const parent = commentIndex.get(comment.parentId);
      if (!parent) {
        continue;
      }

      parent.replies.push({
        id: comment.id,
        userId: comment.userId,
        parentId: comment.parentId,
        content: comment.content,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      });
    }

    res.status(200).json(topLevelComments);
  } catch (error) {
    next(error);
  }
});

videosRouter.get('/:id', attachAuthIfPresent, async (req, res, next) => {
  try {
    const videoId = req.params.id;
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        uploaderId: true,
        visibility: true,
        status: true,
        title: true,
        description: true,
        durationSeconds: true,
        playbackPath: true,
        errorMessage: true,
        createdAt: true,
        viewCount: true,
        likeCount: true,
        uploader: {
          select: {
            id: true,
            nickname: true,
          },
        },
      },
    });

    if (!video) {
      throw new AppError(404, 'VIDEO_NOT_FOUND', 'Video not found');
    }

    const isUploader = req.user?.id === video.uploaderId;

    if (video.visibility === VideoVisibility.PRIVATE && !isUploader) {
      throw new AppError(404, 'VIDEO_NOT_FOUND', 'Video not found');
    }

    if (!isUploader && (video.status !== VideoStatus.READY || video.durationSeconds === null || !video.playbackPath)) {
      throw new AppError(404, 'VIDEO_NOT_FOUND', 'Video not found');
    }

    const playbackUrl = video.status === VideoStatus.READY && video.playbackPath
      ? buildPlaybackUrl(video.playbackPath)
      : null;

    res.status(200).json({
      id: video.id,
      uploader: video.uploader,
      status: video.status,
      errorMessage: video.errorMessage,
      playbackUrl,
      title: video.title,
      description: video.description,
      durationSeconds: video.durationSeconds,
      thumbnailUrl: buildThumbnailUrl(video.id),
      createdAt: video.createdAt,
      score: calculateScore(video.viewCount, video.likeCount),
      viewCount: video.viewCount,
      likeCount: video.likeCount,
    });
  } catch (error) {
    next(error);
  }
});

videosRouter.get('/:id/playback', attachAuthIfPresent, async (req, res, next) => {
  try {
    const videoId = req.params.id;
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        uploaderId: true,
        visibility: true,
        status: true,
        playbackPath: true,
      },
    });

    if (!video) {
      throw new AppError(404, 'VIDEO_NOT_FOUND', 'Video not found');
    }

    if (video.visibility === VideoVisibility.PRIVATE && req.user?.id !== video.uploaderId) {
      throw new AppError(403, 'FORBIDDEN', 'Forbidden');
    }

    if (video.status !== VideoStatus.READY) {
      throw new AppError(409, 'VIDEO_NOT_READY', 'Video is not ready');
    }

    if (!video.playbackPath) {
      throw new AppError(409, 'VIDEO_NOT_READY', 'Video is not ready');
    }

    res.status(200).json({
      id: video.id,
      status: video.status,
      hlsUrl: buildPlaybackUrl(video.playbackPath),
    });
  } catch (error) {
    next(error);
  }
});
