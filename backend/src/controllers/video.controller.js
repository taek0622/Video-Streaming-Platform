const { Video, User, Comment } = require("../models");
const { Op, fn, col, literal } = require("sequelize");

// ==================== 통합 영상 검색 ====================
/**
 * 통합 영상 검색 (VOD + Live)
 * GET /api/videos/search
 */
exports.searchVideos = async (req, res) => {
    try {
        const {
            q = "", // 검색어
            page = 1,
            limit = 20,
            sort = "random", // random, created_at, views, title
            order = "DESC",
            type = "all", // all, vod, live
            liveOnly = false, // true면 현재 방송중인 것만
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // 검색 조건 구성
        const whereClause = {};

        // 타입 필터
        if (type === "vod") {
            whereClause.videoType = "vod";
        } else if (type === "live") {
            whereClause.videoType = "live";
        }
        // type === "all"이면 조건 추가 안 함

        // 현재 방송중만 보기
        if (liveOnly === "true" || liveOnly === true) {
            whereClause.isLive = true;
        }

        // 검색어가 있으면 제목/설명에서 검색
        if (q && q.trim().length > 0) {
            const searchTerm = q.trim();

            whereClause[Op.or] = [
                // 제목에서 검색 (대소문자 구분 없음)
                {
                    title: {
                        [Op.iLike]: `%${searchTerm}%`,
                    },
                },
                // 설명에서 검색
                {
                    description: {
                        [Op.iLike]: `%${searchTerm}%`,
                    },
                },
                {
                    "$uploader.full_name$": {
                        [Op.iLike]: `%${searchTerm}%`,
                    },
                },
            ];
        }

        // 정렬 옵션 설정
        let orderClause;

        if (sort === "random") {
            // 무작위 정렬
            orderClause = [literal("RANDOM()")];
        } else {
            // 일반 정렬
            const allowedSortFields = [
                "created_at",
                "views",
                "title",
                "updated_at",
            ];
            const allowedOrders = ["ASC", "DESC"];

            const sortField = allowedSortFields.includes(sort)
                ? sort
                : "created_at";
            const sortOrder = allowedOrders.includes(order.toUpperCase())
                ? order.toUpperCase()
                : "DESC";

            orderClause = [[sortField, sortOrder]];
        }

        // 검색 실행
        const { count, rows } = await Video.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    as: "uploader",
                    attributes: ["id", "username", "profileImage", "fullName"],
                },
            ],
            order: orderClause,
            limit: parseInt(limit),
            offset: offset,
            distinct: true,
            subQuery: false, // 게시자 검색을 위해 필요
        });

        // 응답 데이터 가공
        const videos = rows.map((video) => {
            const videoJson = video.toJSON();

            return {
                ...videoJson,
                // 재생 URL 추가
                playbackUrl:
                    videoJson.videoType === "live" && videoJson.isLive
                        ? `http://localhost:3000/live/${videoJson.streamKey}/index.m3u8`
                        : videoJson.hlsUrl
                        ? `http://localhost:3000${videoJson.hlsUrl}`
                        : videoJson.videoUrl
                        ? `http://localhost:3000${videoJson.videoUrl}`
                        : null,
                // 상태 표시
                status:
                    videoJson.videoType === "live"
                        ? videoJson.isLive
                            ? "live"
                            : "offline"
                        : videoJson.hlsStatus === "completed"
                        ? "ready"
                        : videoJson.hlsStatus,
            };
        });

        return res.json({
            success: true,
            data: {
                videos,
                search: {
                    query: q,
                    type,
                    sort,
                    liveOnly,
                },
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / parseInt(limit)),
                },
            },
        });
    } catch (error) {
        console.error("Search videos error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to search videos",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// ==================== 조회수 통계 ====================
/**
 * 인기 영상 (조회수 Top)
 * GET /api/videos/trending
 */
exports.getTrendingVideos = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            period = "all", // all, day, week, month
            type = "all", // all, vod, live
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // 기간 필터
        const whereClause = {};

        if (type === "vod") {
            whereClause.videoType = "vod";
        } else if (type === "live") {
            whereClause.videoType = "live";
        }

        // 기간별 필터 (created_at 기준)
        if (period !== "all") {
            const now = new Date();
            let startDate;

            switch (period) {
                case "day":
                    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case "week":
                    startDate = new Date(
                        now.getTime() - 7 * 24 * 60 * 60 * 1000
                    );
                    break;
                case "month":
                    startDate = new Date(
                        now.getTime() - 30 * 24 * 60 * 60 * 1000
                    );
                    break;
            }

            if (startDate) {
                whereClause.created_at = {
                    [Op.gte]: startDate,
                };
            }
        }

        // 조회수 순으로 정렬
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
                ["views", "DESC"],
                ["created_at", "DESC"],
            ],
            limit: parseInt(limit),
            offset: offset,
        });

        const videos = rows.map((video, index) => {
            const videoJson = video.toJSON();
            return {
                ...videoJson,
                rank: offset + index + 1, // 순위 추가
                playbackUrl:
                    videoJson.videoType === "live" && videoJson.isLive
                        ? `http://localhost:3000/live/${videoJson.streamKey}/index.m3u8`
                        : videoJson.hlsUrl
                        ? `http://localhost:3000${videoJson.hlsUrl}`
                        : videoJson.videoUrl
                        ? `http://localhost:3000${videoJson.videoUrl}`
                        : null,
            };
        });

        return res.json({
            success: true,
            data: {
                videos,
                filter: {
                    period,
                    type,
                },
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / parseInt(limit)),
                },
            },
        });
    } catch (error) {
        console.error("Get trending videos error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get trending videos",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

/**
 * 전체 통계
 * GET /api/videos/stats
 */
exports.getStats = async (req, res) => {
    try {
        // 전체 영상 수
        const totalVideos = await Video.count();

        // VOD 수
        const vodCount = await Video.count({
            where: { videoType: "vod" },
        });

        // 라이브 스트림 수
        const liveCount = await Video.count({
            where: { videoType: "live" },
        });

        // 현재 방송중인 스트림 수
        const activeLiveCount = await Video.count({
            where: { videoType: "live", isLive: true },
        });

        // 전체 조회수
        const totalViews = await Video.sum("views");

        // 최근 24시간 업로드 수
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentUploads = await Video.count({
            where: {
                created_at: {
                    [Op.gte]: yesterday,
                },
            },
        });

        // 가장 인기있는 영상
        const topVideo = await Video.findOne({
            include: [
                {
                    model: User,
                    as: "uploader",
                    attributes: ["id", "username", "profileImage"],
                },
            ],
            order: [["views", "DESC"]],
        });

        // 전체 사용자 수
        const totalUsers = await User.count();

        return res.json({
            success: true,
            data: {
                videos: {
                    total: totalVideos,
                    vod: vodCount,
                    live: liveCount,
                    activeLive: activeLiveCount,
                },
                views: {
                    total: totalViews || 0,
                    average:
                        totalVideos > 0
                            ? Math.round(totalViews / totalVideos)
                            : 0,
                },
                recent: {
                    uploadsLast24h: recentUploads,
                },
                topVideo: topVideo
                    ? {
                          id: topVideo.id,
                          title: topVideo.title,
                          views: topVideo.views,
                          uploader: topVideo.uploader,
                      }
                    : null,
                users: {
                    total: totalUsers,
                },
            },
        });
    } catch (error) {
        console.error("Get stats error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get statistics",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

/**
 * 특정 게시자의 통계
 * GET /api/videos/stats/uploader/:userId
 */
exports.getUploaderStats = async (req, res) => {
    try {
        const { userId } = req.params;

        // 사용자 확인
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                succesS: false,
                message: "User not found",
            });
        }

        // 총 영상 수
        const totalVideos = await Video.count({
            where: { uploaderId: userId },
        });

        // VOD 수
        const vodCount = await Video.count({
            where: {
                uploaderId: userId,
                videoType: "vod",
            },
        });

        // 라이브 스트림 수
        const liveCount = await Video.count({
            where: {
                uploaderId: userId,
                videoType: "live",
            },
        });

        // 총 조회수
        const totalViews = await Video.sum("views", {
            where: { uploaderId: userId },
        });

        // 평균 조회수
        const avgViews =
            totalVideos > 0 ? Math.round(totalViews / totalVideos) : 0;

        // 가장 인기있는 영상
        const topVideo = await Video.findOne({
            where: { uploaderId: userId },
            order: [["views", "DESC"]],
            attirbutes: ["id", "title", "views", "videoType"],
        });

        // 최근 업로드 (5개)
        const recentVideos = await Video.findAll({
            where: { uploaderId: userId },
            order: [["created_at", "DESC"]],
            limit: 5,
            attributes: ["id", "title", "views", "videoType", "created_at"],
        });

        return res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    fullName: user.fullName,
                    profileImage: user.profileImage,
                },
                stats: {
                    totalVideos,
                    vodCount,
                    liveCount,
                    totalViews: totalViews || 0,
                    avgViews,
                },
                topVideo,
                recentVideos,
            },
        });
    } catch (error) {
        console.error("Get uploader stats error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get uploader statistics",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

/**
 * 영상 목록 조회 (비로그인 가능)
 * GET /api/videos
 */
exports.getVideos = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            type = "vod",
            sort = "created_at",
            order = "DESC",
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // 정렬 옵션 검증
        const allowedSortFields = ["created_at", "views", "title"];
        const allowedOrders = ["ASC", "DESC"];
        const sortField = allowedSortFields.includes(sort)
            ? sort
            : "created_at";
        const sortOrder = allowedOrders.includes(order.toUpperCase())
            ? order.toUpperCase()
            : "DESC";

        const whereClause = { videoType: type };

        // 라이브 스트리밍의 경우 현재 방송 중인 것만
        if (type === "live") {
            whereClause.isLive = true;
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
            order: [[sortField, sortOrder]],
            limit: parseInt(limit),
            offset: offset,
            distinct: true,
        });

        return res.json({
            success: true,
            data: {
                videos: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / parseInt(limit)),
                },
            },
        });
    } catch (error) {
        console.error("Get videos error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get videos",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// 영상 상세 조회 (비로그인 가능)
// GET /api/videos/:id
exports.getVideoDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const video = await Video.findByPk(id, {
            include: [
                {
                    model: User,
                    as: "uploader",
                    attributes: ["id", "username", "profileImage", "fullName"],
                },
                {
                    model: Comment,
                    as: "comments",
                    include: [
                        {
                            model: User,
                            as: "author",
                            attributes: ["id", "username", "profileImage"],
                        },
                    ],
                    order: [["created_at", "DESC"]],
                    limit: 10, // 최근 댓글 10개만
                },
            ],
        });

        if (!video) {
            return res.status(404).json({
                success: false,
                message: "Video not found",
            });
        }

        // 조회수 증가 (비동기로 처리, 응답 속도에 영향 없음)
        video.increment("views").catch((err) => {
            console.error("Failed to increment views:", err);
        });

        return res.json({
            success: true,
            data: {
                video: {
                    ...video.toJSON(),
                    views: video.views + 1, // 즉시 반영
                },
            },
        });
    } catch (error) {
        console.error("Get video detail error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get video detail",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// 영상 업로드 메타데이서 생성 (로그인 필수)
// POST /api/videos
//  실제 파일 업로드는 별도 엔드포인트에서 처리
exports.createVideo = async (req, res) => {
    try {
        const {
            title,
            description,
            videoType = "vod",
            videoUrl,
            thumbnailUrl,
            duration,
        } = req.body;

        // 필수 필드 검증
        if (!title) {
            return res.status(400).json({
                success: false,
                message: "Title is required",
            });
        }

        if (videoType === "vod" && !videoUrl) {
            return res.status(400).json({
                success: false,
                message: "Video URL is required for VOD type",
            });
        }

        // 영상 생성
        const video = await Video.create({
            title,
            description,
            videoType,
            videoUrl,
            thumbnailUrl,
            duration,
            uploaderId: req.user.id,
        });

        // 업로더 정보 포함하여 반환
        const videoWithUploader = await Video.findByPk(video.id, {
            include: [
                {
                    model: User,
                    as: "uploader",
                    attributes: ["id", "username", "profileImage", "fullName"],
                },
            ],
        });

        return res.status(201).json({
            success: true,
            data: {
                video: videoWithUploader,
            },
            message: "Video created successfully",
        });
    } catch (error) {
        console.error("Create video error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create video",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// 영상 수정 (로그인 필수, 본인만 가능)
// PUT /api/videos/:id
exports.updateVideo = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, thumbnailUrl } = req.body;

        const video = await Video.findByPk(id);

        if (!video) {
            return res.status(404).json({
                success: false,
                message: "Video not found",
            });
        }

        // 소유자 확인
        if (video.uploaderId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to update this video",
            });
        }

        // 업데이트할 필드만 수정
        if (title !== undefined) video.title = title;
        if (description !== undefined) video.description = description;
        if (thumbnailUrl !== undefined) video.thumbnailUrl = thumbnailUrl;

        await video.save();

        // 업로드 정보 포함하여 반환
        const updatedVideo = await Video.findByPk(video.id, {
            include: [
                {
                    model: User,
                    as: "uploader",
                    attributes: ["id", "username", "profileImage", "fullName"],
                },
            ],
        });

        return res.json({
            success: true,
            data: {
                video: updatedVideo,
            },
            message: "Video updated successfully",
        });
    } catch (error) {
        console.error("Update video error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update video",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// 영상 삭제 (로그인 필수, 본인만 가능)
// DELETE /api/videos/:id
exports.deleteVideo = async (req, res) => {
    try {
        const { id } = req.params;

        const video = await Video.findByPk(id);

        if (!video) {
            return res.status(404).json({
                success: false,
                message: "Video not found",
            });
        }

        // 소유자 확인
        if (video.uploaderId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to delete this video",
            });
        }

        // TODO: 실제 파일도 삭제 (나중에 구현)
        // const fs = require('fs').promises;
        // if (video.videoUrl) {
        //     await fs.unlink(path.join(__dirname, '../../', video.videoUrl));
        // }

        await video.destroy();

        return res.json({
            success: true,
            menubar: "Video deleted successfully",
        });
    } catch (error) {
        console.error("Delete video error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete video",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// 특정 사용자의 영상 목록 조회 (비로그인 가능)
// GET /api/videos/uploader/:userId
exports.getVideosByUploader = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const uploader = await User.findByPk(userId);
        if (!uploader) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const { count, rows } = await Video.findAndCountAll({
            where: { uploaderId: userId },
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

        return res.json({
            success: true,
            data: {
                uploader: {
                    id: uploader.id,
                    username: uploader.username,
                    profileImage: uploader.profileImage,
                    fullName: uploader.fullName,
                },
                videos: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / parseInt(limit)),
                },
            },
        });
    } catch (error) {
        console.error("Get videos by uploader error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get videos",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

/**
 * HLS 변환 상태 확인
 * GET /api/videos/:id/hls-status
 */
exports.getHLSStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const video = await Video.findByPk(id, {
            attributes: [
                "id",
                "title",
                "hlsStatus",
                "hlsUrl",
                "videoUrl",
                "thumbnailUrl",
            ],
        });

        if (!video) {
            return res.status(404).json({
                success: false,
                message: "Video not found",
            });
        }

        return res.json({
            success: true,
            data: {
                videoId: video.id,
                title: video.title,
                hlsStatus: video.hlsStatus,
                hlsUrl: video.hlsUrl,
                videoUrl: video.videoUrl,
                thumbnailUrl: video.thumbnailUrl,
                isReady: video.hlsStatus === "completed",
            },
        });
    } catch (error) {
        console.error("Get HLS status error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get HLS status",
        });
    }
};
