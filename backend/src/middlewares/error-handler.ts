import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { logger } from '../lib/logger';

export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(404, 'NOT_FOUND', 'Not found'));
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');

  res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
  });
};
