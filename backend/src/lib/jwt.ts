import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export type AuthUser = {
  id: string;
  nickname: string;
};

const isJwtPayload = (decoded: string | JwtPayload): decoded is JwtPayload => {
  return typeof decoded === 'object' && decoded !== null;
};

export const signAccessToken = (user: AuthUser): string => {
  const expiresIn = env.jwtExpiresIn as SignOptions['expiresIn'];

  return jwt.sign({ id: user.id, nickname: user.nickname }, env.jwtSecret, {
    expiresIn,
    subject: user.id,
  });
};

export const verifyAccessToken = (token: string): AuthUser => {
  const decoded = jwt.verify(token, env.jwtSecret);

  if (!isJwtPayload(decoded)) {
    throw new Error('Invalid token payload');
  }

  const id = typeof decoded.id === 'string' ? decoded.id : typeof decoded.sub === 'string' ? decoded.sub : null;
  const nickname = typeof decoded.nickname === 'string' ? decoded.nickname : null;

  if (!id || !nickname) {
    throw new Error('Invalid token payload');
  }

  return { id, nickname };
};
