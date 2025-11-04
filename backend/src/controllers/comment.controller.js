const { Comment, User, Video } = require("../models");

// 특정 영상의 댓글 목록 조회 (비로그인 가능)
// GET /api/videos/:videoId/comments
exports.getComments = async (req, res) => {
    try {
        const { videoId } = req.params;
        const {
            page = 1,
            limit = 20,
            sort = "created_at",
            order = "DESC",
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // 영상 존재 확인
        const video = await Video.findByPk(videoId);
        if (!video) {
            return res.status(404).json({
                success: false,
                message: "Video not found",
            });
        }

        // 정렬 옵션 검증
        const allowedSortFields = ["created_at", "updated_at"];
        const allowedOrders = ["ASC", "DESC"];
        const sortField = allowedSortFields.includes(sort)
            ? sort
            : "created_at";
        const sortOrder = allowedOrders.includes(order.toUpperCase())
            ? order.toUpperCase()
            : "DESC";

        const { count, rows } = await Comment.findAndCountAll({
            where: { videoId },
            include: [
                {
                    model: User,
                    as: "author",
                    attributes: ["id", "username", "profileImage", "fullName"],
                },
            ],
            order: [[sortField, sortOrder]],
            limit: parseInt(limit),
            offset: offset,
        });

        return res.json({
            success: true,
            data: {
                comments: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / parseInt(limit)),
                },
            },
        });
    } catch (error) {
        console.error("Get comments error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get comments",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// 댓글 작성 (로그인 필수)
// POST /api/videos/:videoId/comments
exports.createComment = async (req, res) => {
    try {
        const { videoId } = req.params;
        const { content } = req.body;

        // 내용 검증
        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Comment content is required",
            });
        }

        if (content.length > 1000) {
            return res.status(400).json({
                success: false,
                message: "Comment content must be less than 1000 characters",
            });
        }

        // 영상 존재 확인
        const video = await Video.findByPk(videoId);
        if (!video) {
            return res.status(404).json({
                success: false,
                message: "Video not found",
            });
        }

        // 댓글 생성
        const comment = await Comment.create({
            videoId,
            userId: req.user.id,
            content: content.trim(),
        });

        // 작성자 정보 포함하여 반환
        const commentWithAuthor = await Comment.findByPk(comment.id, {
            include: [
                {
                    model: User,
                    as: "author",
                    attributes: ["id", "username", "profileImage", "fullName"],
                },
            ],
        });

        return res.status(201).json({
            success: true,
            data: {
                comment: commentWithAuthor,
            },
            message: "Comment created successfully",
        });
    } catch (error) {
        console.error("Create comment error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create comment",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// 댓글 수정 (로그인 필수, 본인만 가능)
// PUT /api/comments/:id
exports.updateComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;

        // 내용 검증
        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Comment content is required",
            });
        }

        if (content.length > 1000) {
            return res.status(400).json({
                success: false,
                message: "Comment content must be less than 1000 characters",
            });
        }

        // 댓글 조회
        const comment = await Comment.findByPk(id);

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: "Comment not found",
            });
        }

        // 소유자 확인
        if (comment.userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to update this comment",
            });
        }

        // 댓글 수정
        comment.content = content.trim();
        await comment.save();

        // 작성자 정보 포함하여 반환
        const updatedComment = await Comment.findByPk(comment.id, {
            include: [
                {
                    model: User,
                    as: "author",
                    attributes: ["id", "username", "profileImage", "fullName"],
                },
            ],
        });

        return res.json({
            success: true,
            data: {
                comment: updatedComment,
            },
            message: "Comment updated successfully",
        });
    } catch (error) {
        console.error("Update comment error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update comment",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// 댓글 삭제 (로그인 필수, 본인만 가능)
// DELETE /api/comments/:id
exports.deleteComment = async (req, res) => {
    try {
        const { id } = req.params;

        // 댓글 조회
        const comment = await Comment.findByPk(id);

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: "Comment not found",
            });
        }

        // 소유자 확인
        if (comment.userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to delete this comment",
            });
        }

        await comment.destroy();

        return res.json({
            success: true,
            message: "Comment deleted successfully",
        });
    } catch (error) {
        console.error("Delete comment error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete comment",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// 특정 댓글 조회 (비로그인 가능)
// GET /api/comments/:id
exports.getComment = async (req, res) => {
    try {
        const { id } = req.params;

        const comment = await Comment.findByPk(id, {
            include: [
                {
                    model: User,
                    as: "author",
                    attributes: ["id", "username", "profileImage", "fullName"],
                },
                {
                    model: Video,
                    as: "video",
                    attributes: ["id", "title"],
                },
            ],
        });

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: "Comment not found",
            });
        }

        return res.json({
            success: true,
            data: {
                comment,
            },
        });
    } catch (error) {
        console.error("Get comment error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get comment",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};
