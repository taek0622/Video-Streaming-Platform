import { VideoStatus, VideoVisibility } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { buildPlaybackUrl } from "../services/media/adaptive-transcoder";
import { buildThumbnailUrl } from "../services/media/media-url";

const HOME_LIMIT = 6;

type HomeVideoRow = {
    id: string;
    title: string;
    description: string | null;
    durationSeconds: number | null;
    playbackPath: string | null;
    viewCount: number;
    likeCount: number;
    createdAt: Date;
    uploader: {
        id: string;
        nickname: string;
    };
};

const calculateScore = (video: {
    viewCount: number;
    likeCount: number;
}): number => {
    return video.viewCount + video.likeCount * 10;
};

const hasReadyPlayback = <T extends {
    playbackPath: string | null;
    durationSeconds: number | null;
}>(
    video: T,
): video is T & { playbackPath: string; durationSeconds: number } => {
    return video.playbackPath !== null && video.durationSeconds !== null;
};

export const homeRouter = Router();

homeRouter.get("/", async (_req, res, next) => {
    try {
        const homeVideoQuery = {
            where: {
                visibility: VideoVisibility.PUBLIC,
                status: VideoStatus.READY,
                durationSeconds: {
                    not: null,
                },
                playbackPath: {
                    not: null,
                },
            },
            select: {
                id: true,
                title: true,
                description: true,
                durationSeconds: true,
                playbackPath: true,
                viewCount: true,
                likeCount: true,
                createdAt: true,
                uploader: {
                    select: {
                        id: true,
                        nickname: true,
                    },
                },
            },
        };

        const videos = (await prisma.video.findMany(
            homeVideoQuery as never,
        ) as unknown) as HomeVideoRow[];

        const videosWithPlayback = videos.filter(hasReadyPlayback);

        const popularVideos = videosWithPlayback
            .map((video) => ({
                ...video,
                score: calculateScore(video),
            }))
            .sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }

                return b.createdAt.getTime() - a.createdAt.getTime();
            })
            .slice(0, HOME_LIMIT)
            .map((video) => ({
                id: video.id,
                title: video.title,
                description: video.description,
                durationSeconds: video.durationSeconds,
                uploader: video.uploader,
                createdAt: video.createdAt,
                playbackUrl: buildPlaybackUrl(video.playbackPath),
                thumbnailUrl: buildThumbnailUrl(video.id),
                score: video.score,
                viewCount: video.viewCount,
                likeCount: video.likeCount,
            }));

        res.status(200).json(popularVideos);
    } catch (error) {
        next(error);
    }
});
