const { Video, User } = require("../models");
const { v4: uuidv4 } = require("uuid");
const { getViewerCount } = require("../services/chatServer");

/**
 * 라이브 스트리밍 시작 (스트림 키 생성)
 * POST /api/live/start
 */
exports.startLive = async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title) {
            return res.status(400).json({
                success: false,
                messagge: "Title is required",
            });
        }

        // 스트림 키 생성 (UUID)
        const streamKey = uuidv4();

        // 라이브 영상 메타데이터 생성
        const video = await Video.create({
            title,
            description: description || "",
            videoType: "live",
            streamKey,
            uploaderId: req.user.id,
            isLive: false, // 실제 스트림 시작 전
            hlsStatus: null, // 라이브는 HLS 변환 안 함
        });

        console.log(`Live stream created: ${video.title} (ID: ${video.id})`);
        console.log(`Stream Key: ${streamKey}`);

        return res.status(201).json({
            success: true,
            data: {
                video: {
                    id: video.id,
                    title: video.title,
                    description: video.description,
                    streamKey: video.streamKey,
                    isLive: video.isLive,
                    // RTMP URL (스트리머가 OBS에 입력)
                    rtmpUrl: `rtmp://localhost:1935/live`,
                    streamKeyToUse: streamKey,
                    fullRtmpUrl: `rtmp://localhost:1935/live/${streamKey}`,
                    // HLS 재생 ULR (시청자용)
                    playbackUrl: `http://localhost:3000/live/${streamKey}/index.m3u8`,
                },
            },
            message: "Live stream created. Use the stream key in OBS.",
        });
    } catch (error) {
        console.error("Start live error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create live stream",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

/**
 * 현재 라이브 중인 스트림 목록
 * GET /api/live
 */
exports.getLiveStreams = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { count, rows } = await Video.findAndCountAll({
            where: {
                videoType: "live",
                isLive: true, // 현재 방송 중인 것만
            },
            include: [
                {
                    model: User,
                    as: "uploader",
                    attributes: ["id", "username", "profileImage", "fullName"],
                },
            ],
            order: [["created_at", "DESC"]],
            limit: parseInt(limit),
            offset: offset,
        });

        // 각 라이브 스트림의 시청자 수 추가
        const liveStreamsWithViewers = rows.map((video) => {
            const videoJson = video.toJSON();
            return {
                ...videoJson,
                viewerCount: getViewerCount(video.id),
                playbackUrl: `http://localhost:3000/live/${video.streamKey}/index.m3u8`,
            };
        });

        return res.json({
            success: true,
            data: {
                streams: liveStreamsWithViewers,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / parseInt(limit)),
                },
            },
        });
    } catch (error) {
        console.error("Get live streams error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get live streams",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

/**
 * 모든 라이브 스트림 목록 (방송 중/대기 중 모두)
 * GET /api/live/all
 */
exports.getAllLivesStreams = async (req, res) => {
    try {
        const { page = 1, limit = 20, status = "all" } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const whereClause = { videoType: "live" };

        if (status === "live") {
            whereClause.isLive = true;
        } else if (status === "offline") {
            whereClause.isLive = false;
        }

        const { count, rows } = await Video.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    as: "uploader",
                    attributes: ["id", "username", "profileImage", "fullName"],
                },
            ],
            order: [
                ["isLive", "DESC"],
                ["created_at", "DESC"],
            ],
            limit: parseInt(limit),
            offset: offset,
        });

        const streamsWithViewers = rows.map((video) => {
            const videoJson = video.toJSON();
            return {
                ...videoJson,
                viewerCount: video.isLive ? getViewerCount(video.id) : 0,
                playbackUrl: video.isLive
                    ? `http://localhost:3000/live/${video.streamKey}/index.m3u8`
                    : null,
            };
        });

        return res.json({
            success: true,
            data: {
                streams: streamsWithViewers,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / parseInt(limit)),
                },
            },
        });
    } catch (error) {
        console.error("Get all live streams error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get live streams",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

/**
 * 라이브 스트림 상세 정보
 * GET /api/live/:id
 */
exports.getLiveDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const video = await Video.findByPk(id, {
            include: [
                {
                    model: User,
                    as: "uploader",
                    attributes: ["id", "username", "profileImage", "fullName"],
                },
            ],
        });

        if (!video || video.videoType !== "live") {
            return res.status(404).json({
                success: false,
                message: "Live stream not found",
            });
        }

        // 조회수 증가 (라이브도 조회수 카운트)
        if (video.isLive) {
            video.increment("views").catch((err) => {
                console.error("Failed to increment views:", err);
            });
        }

        return res.json({
            success: true,
            data: {
                stream: {
                    ...video.toJSON(),
                    views: video.views + (video.isLive ? 1 : 0),
                    viewerCount: video.isLive ? getViewerCount(video.id) : 0,
                    playbackUrl: video.isLive
                        ? `http://localhost:3000/live/${video.streamKey}/index.m3u8`
                        : null,
                    status: video.isLive ? "live" : "offline",
                },
            },
        });
    } catch (error) {
        console.error("Get live detail error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get live stream detail",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

/**
 * 라이브 스트림 수동 종료 (스트리머가 직접 종료)
 * POST /api/live/:id/end
 */
exports.endLive = async (req, res) => {
    try {
        const { id } = req.params;

        const video = await Video.findByPk(id);

        if (!video || video.videoType !== "live") {
            return res.status(404).json({
                success: false,
                message: "Live stream not found",
            });
        }

        // 소유자 확인
        if (video.uploaderId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to end this stream",
            });
        }

        if (!video.isLive) {
            return res.status(400).json({
                success: false,
                message: "Stream is not live",
            });
        }

        // 라이브 상태 종료
        await video.update({ isLive: false });

        console.log(
            `Live stream ended manually: ${video.title} (ID: ${video.id})`
        );

        return res.json({
            success: true,
            message: "Live stream ended successfully",
            data: {
                videoId: video.id,
                title: video.title,
                isLive: false,
            },
        });
    } catch (error) {
        console.error("End live error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to end live stream",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

/**
 * 라이브 스트림 삭제
 * DELETE /api/live/:id
 */
exports.deleteLive = async (req, res) => {
    try {
        const { id } = req.params;

        const video = await Video.findByPk(id);

        if (!video || video.videoType !== "live") {
            return res.status(404).json({
                success: false,
                message: "Live stream not found",
            });
        }

        // 소유자 확인
        if (video.uploaderId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to delete this stream",
            });
        }

        // 방송 중이면 삭제 불가
        if (video.isLive) {
            return res.status(400).json({
                success: false,
                message:
                    "Cannot delete a live stream that is currently broadcasting. End the stream first.",
            });
        }

        await video.destroy();

        console.log(`Live stream deleted: ${video.title} (ID: ${video.id})`);

        return res.json({
            success: true,
            message: "Live stream deleted successfully",
        });
    } catch (error) {
        console.error("Delete live error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete live stream",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

/**
 * 내 라이브 스트림 목록
 * GET /api/live/my-streams
 */
exports.getMyStreams = async (req, res) => {
    try {
        const streams = await Video.findAll({
            where: {
                uploaderId: req.user.id,
                videoType: "live",
            },
            order: [["created_at", "DESC"]],
            limit: 50,
        });

        const streamsWithViewers = streams.map((video) => {
            const videoJson = video.toJSON();
            return {
                ...videoJson,
                viewerCount: video.isLive ? getViewerCount(video.id) : 0,
                playbackUrl: video.isLive
                    ? `http://localhost:3000/live/${video.streamKey}/index.m3u8`
                    : null,
                rtmpUrl: `rtmp://localhost:1935/live/${video.streamKey}`,
            };
        });

        return res.json({
            success: true,
            data: {
                streams: streamsWithViewers,
                total: streams.length,
            },
        });
    } catch (error) {
        console.error("Get my streams error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get streams",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};
