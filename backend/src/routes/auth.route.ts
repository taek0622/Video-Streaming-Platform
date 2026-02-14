import { Router } from 'express';
import { AppError } from '../errors/app-error';
import { signAccessToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';

const MIN_NICKNAME_LENGTH = 2;
const MAX_NICKNAME_LENGTH = 20;

export const authRouter = Router();

authRouter.post('/dev', async (req, res, next) => {
  try {
    const nicknameRaw = req.body?.nickname;

    if (typeof nicknameRaw !== 'string') {
      throw new AppError(400, 'INVALID_NICKNAME', 'nickname is required');
    }

    const nickname = nicknameRaw.trim();

    if (nickname.length < MIN_NICKNAME_LENGTH || nickname.length > MAX_NICKNAME_LENGTH) {
      throw new AppError(400, 'INVALID_NICKNAME', 'nickname must be between 2 and 20 characters');
    }

    const user = await prisma.user.upsert({
      where: { nickname },
      update: {},
      create: { nickname },
      select: {
        id: true,
        nickname: true,
      },
    });

    const token = signAccessToken(user);

    res.status(200).json({
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
});
