import { Router } from 'express';
import { AppError } from '../errors/app-error';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/authenticate-jwt';

export const commentsRouter = Router();

const ensureAuthenticatedUser = (user: { id: string; nickname: string } | undefined): { id: string; nickname: string } => {
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
  }

  return user;
};

const parseContent = (contentRaw: unknown): string => {
  if (typeof contentRaw !== 'string') {
    throw new AppError(400, 'INVALID_CONTENT', 'content is required');
  }

  const content = contentRaw.trim();

  if (!content) {
    throw new AppError(400, 'INVALID_CONTENT', 'content is required');
  }

  return content;
};

commentsRouter.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const user = ensureAuthenticatedUser(req.user);
    const commentId = req.params.id;
    const content = parseContent(req.body?.content);

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        userId: true,
        deletedAt: true,
      },
    });

    if (!comment || comment.deletedAt) {
      throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
    }

    if (comment.userId !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'Forbidden');
    }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { content },
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

    res.status(200).json(updatedComment);
  } catch (error) {
    next(error);
  }
});

commentsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const user = ensureAuthenticatedUser(req.user);
    const commentId = req.params.id;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        userId: true,
        deletedAt: true,
        video: {
          select: {
            uploaderId: true,
          },
        },
      },
    });

    if (!comment || comment.deletedAt) {
      throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
    }

    const isAuthor = comment.userId === user.id;
    const isUploader = comment.video.uploaderId === user.id;

    if (!isAuthor && !isUploader) {
      throw new AppError(403, 'FORBIDDEN', 'Forbidden');
    }

    const deletedComment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        deletedAt: new Date(),
      },
      select: {
        id: true,
        deletedAt: true,
      },
    });

    res.status(200).json({
      id: deletedComment.id,
      deletedAt: deletedComment.deletedAt,
    });
  } catch (error) {
    next(error);
  }
});
