const { Video, User, Comment } = require("../models");
const { Op } = require("sequelize");

// 영상 목록 조회 (비로그인 가능)
// GET /api/videos
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
