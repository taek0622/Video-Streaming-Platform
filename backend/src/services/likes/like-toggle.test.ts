import { describe, expect, it } from 'vitest';
import { createLikeToggleService } from './like-toggle';

type State = {
  videoExists: boolean;
  likeCount: number;
  liked: boolean;
};

const createStore = (state: State) => {
  const tx = {
    video: {
      findUnique: async () => {
        if (!state.videoExists) {
          return null;
        }

        return {
          id: 'video-1',
          likeCount: state.likeCount,
        };
      },
      update: async (args: { data: { likeCount: { increment?: number; decrement?: number } } }) => {
        if (args.data.likeCount.increment) {
          state.likeCount += args.data.likeCount.increment;
        }

        if (args.data.likeCount.decrement) {
          state.likeCount -= args.data.likeCount.decrement;
        }

        return { likeCount: state.likeCount };
      },
    },
    like: {
      findUnique: async () => {
        return state.liked ? { userId: 'user-1' } : null;
      },
      create: async () => {
        state.liked = true;
      },
      delete: async () => {
        state.liked = false;
      },
    },
  };

  return {
    $transaction: async <T>(fn: (transaction: typeof tx) => Promise<T>): Promise<T> => fn(tx),
  };
};

describe('like toggle service', () => {
  it('updates likeCount correctly when user likes then unlikes', async () => {
    const state: State = {
      videoExists: true,
      likeCount: 10,
      liked: false,
    };

    const service = createLikeToggleService(createStore(state));

    const liked = await service.like('video-1', 'user-1');
    expect(liked).toEqual({
      liked: true,
      likeCount: 11,
    });

    const unliked = await service.unlike('video-1', 'user-1');
    expect(unliked).toEqual({
      liked: false,
      likeCount: 10,
    });
  });
});
