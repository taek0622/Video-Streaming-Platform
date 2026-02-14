import { describe, expect, it, vi } from 'vitest';
import { createVideoViewCounter, VIEW_THROTTLE_MS } from './view-counter';
import { buildAnonymousViewerKey, createViewerKeyResolver } from './viewer-key';

describe('video view counter', () => {
  it('does not increment when same viewer viewed within 1 hour', async () => {
    const videoFindUniqueMock = vi.fn().mockResolvedValue({
      id: 'video-1',
      viewCount: 42,
    });

    const videoUpdateMock = vi.fn().mockResolvedValue({
      viewCount: 43,
    });

    const viewEventFindUniqueMock = vi.fn().mockResolvedValue({
      lastViewedAt: new Date('2026-02-14T09:30:00.000Z'),
    });

    const viewEventUpsertMock = vi.fn().mockResolvedValue({});

    const counter = createVideoViewCounter({
      store: {
        video: {
          findUnique: videoFindUniqueMock,
          update: videoUpdateMock,
        },
        viewEvent: {
          findUnique: viewEventFindUniqueMock,
          upsert: viewEventUpsertMock,
        },
      },
      now: () => new Date('2026-02-14T10:00:00.000Z'),
    });

    const result = await counter.registerView({
      videoId: 'video-1',
      viewerKey: 'viewer-a',
    });

    expect(result).toEqual({
      counted: false,
      viewCount: 42,
    });
    expect(videoUpdateMock).not.toHaveBeenCalled();
    expect(viewEventUpsertMock).not.toHaveBeenCalled();
  });

  it('increments when last view is older than 1 hour', async () => {
    const videoFindUniqueMock = vi.fn().mockResolvedValue({
      id: 'video-1',
      viewCount: 42,
    });

    const videoUpdateMock = vi.fn().mockResolvedValue({
      viewCount: 43,
    });

    const viewEventFindUniqueMock = vi.fn().mockResolvedValue({
      lastViewedAt: new Date(Date.parse('2026-02-14T08:59:59.999Z')),
    });

    const viewEventUpsertMock = vi.fn().mockResolvedValue({});

    const now = new Date(Date.parse('2026-02-14T10:00:00.000Z'));

    const counter = createVideoViewCounter({
      store: {
        video: {
          findUnique: videoFindUniqueMock,
          update: videoUpdateMock,
        },
        viewEvent: {
          findUnique: viewEventFindUniqueMock,
          upsert: viewEventUpsertMock,
        },
      },
      now: () => now,
      throttleMs: VIEW_THROTTLE_MS,
    });

    const result = await counter.registerView({
      videoId: 'video-1',
      viewerKey: 'viewer-a',
    });

    expect(result).toEqual({
      counted: true,
      viewCount: 43,
    });
    expect(videoUpdateMock).toHaveBeenCalledOnce();
    expect(viewEventUpsertMock).toHaveBeenCalledWith({
      where: {
        videoId_viewerKey: {
          videoId: 'video-1',
          viewerKey: 'viewer-a',
        },
      },
      create: {
        videoId: 'video-1',
        viewerKey: 'viewer-a',
        lastViewedAt: now,
      },
      update: {
        lastViewedAt: now,
      },
    });
  });
});

describe('viewer key resolver', () => {
  it('supports injected ip/user-agent extractor in tests', () => {
    const resolver = createViewerKeyResolver({
      metadataExtractor: () => ({
        ip: '10.0.0.5',
        userAgent: 'UnitTestAgent/1.0',
      }),
      hasher: (input) => `hashed:${input}`,
    });

    const result = resolver({ user: undefined } as never);

    expect(result).toBe('hashed:10.0.0.5|UnitTestAgent/1.0');
  });

  it('builds anonymous key from ip and user-agent', () => {
    const key = buildAnonymousViewerKey(
      {
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      },
      (input) => `hash(${input})`,
    );

    expect(key).toBe('hash(127.0.0.1|Mozilla/5.0)');
  });
});
