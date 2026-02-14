import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { verifyAccessToken } from '../lib/jwt';

const parseBearerToken = (authorization: string | undefined): string | null => {
  if (!authorization) {
    return null;
  }

  if (!authorization.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
  }

  const token = authorization.slice('Bearer '.length).trim();

  if (!token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
  }

  return token;
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const token = parseBearerToken(req.header('authorization'));

    if (!token) {
      next(new AppError(401, 'UNAUTHORIZED', 'Unauthorized'));
      return;
    }

    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Unauthorized'));
  }
};

export const attachAuthIfPresent = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const token = parseBearerToken(req.header('authorization'));

    if (!token) {
      next();
      return;
    }

    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Unauthorized'));
  }
};
