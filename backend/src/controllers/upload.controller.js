const { Video } = require("../models");
const path = require("path");
const fs = require("fs").promises;

// 영상 파일 업로드
// POST /api/upload/video
exports.uploadVideoFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No video file provided",
            });
        }

        const { title, description } = req.body;

        if (!title) {
            // 업로드된 파일 삭제
            await fs.unlink(req.file.path);
            return res.status(400).json({
                success: false,
                message: "Title is required",
            });
        }

        // 파일 정보
        const videoUrl = `/uploads/videos/${req.file.filename}`;
        const fileSize = req.file.size;
        const mimeType = req.file.mimetype;

        // TODO: 영상 길이(duration) 추출 (ffmpeg 필요, 나중에 구현)
        // const duration = await getVideoDuration(req.file.path);

        // 영상 메타데이터 저장
        const video = await Video.create({
            title,
            description: description || "",
            videoType: "vod",
            videoUrl,
            uploaderId: req.user.id,
            duration: null, // 나중에 ffmpeg로 추출
        });

        return res.status(201).json({
            success: true,
            data: {
                video: {
                    id: video.id,
                    title: video.title,
                    videoUrl: video.videoUrl,
                    fileSize,
                    mimeType,
                },
            },
            message: "Video uploaded successfully",
        });
    } catch (error) {
        console.error("Upload video error:", error);

        // 에러 발생 시 업로드된 파일 삭제
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error("Failed to delete file:", unlinkError);
            }
        }

        return res.status(500).json({
            success: false,
            message: "Failed to upload video",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// 썸네일 업로드
// POST /api/upload/thumbnail
exports.uploadThumbnailFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No thumbnail file provided",
            });
        }

        const { videoId } = req.body;

        if (!videoId) {
            await fs.unlink(req.file.path);
            return res.status(400).json({
                success: false,
                message: "Video ID is required",
            });
        }

        // 영상 존재 및 소유권 확인
        const video = await Video.findByPk(videoId);

        if (!video) {
            await fs.unlink(req.file.path);
            return res.status(404).json({
                success: false,
                message: "Video not found",
            });
        }

        if (video.uploaderId !== req.user.id) {
            const oldThumbnailPath = path.join(
                __dirname,
                "../../",
                video.thumbnailUrl
            );
            try {
                await fs.unlink(oldThumbnailPath);
            } catch (error) {
                console.error("Failed to delete old thumbnail:", error);
            }
        }

        // 새 썸네일 경로 저장
        const thumbnailUrl = `/uploads/thumbnails/${req.file.filename}`;
        video.thumbnailUrl = thumbnailUrl;
        await video.save();

        return res.json({
            success: true,
            data: {
                thumbnailUrl,
            },
            message: "Thumbnail uploaded successfully",
        });
    } catch (error) {
        console.error("Upload thumbnail error:", error);

        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error("Failed to delete file:", unlinkError);
            }
        }

        return res.status(500).json({
            success: false,
            message: "Failed to upload thumbnail",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// 영상 + 썸네일 동시 업로드
// POST /api/upload/video-with-thumbnail
exports.uploadVideoWithThumbnail = async (req, res) => {
    try {
        if (!req.files || !req.files.video) {
            return res.status(400).json({
                success: false,
                message: "No video file provided",
            });
        }

        const { title, description } = req.body;

        if (!title) {
            // 업로르된 파일들 삭제
            if (req.files.video) await fs.unlink(req.files.video[0].path);
            if (req.files.thumbnail)
                await fs.unlink(req.files.thumbnail[0].path);

            return res.status(400).json({
                success: false,
                message: "Title is required",
            });
        }

        const videoFile = req.files.video[0];
        const thumbnailFile = req.files.thumbnail
            ? req.files.thumbnail[0]
            : null;

        const videoUrl = `/uploads/videos/${videoFile.filename}`;
        const thumbnailUrl = thumbnailFile
            ? `/uploads/thumbnails/${thumbnailFile.filename}`
            : null;

        // 영상 메타데이터 저장
        const video = await Video.create({
            title,
            description: description || "",
            videoType: "vod",
            videoUrl,
            thumbnailUrl,
            uploaderId: req.user.id,
        });

        return res.status(201).json({
            success: true,
            data: {
                video: {
                    id: video.id,
                    title: video.title,
                    videoUrl: video.videoUrl,
                    thumbnailUrl: video.thumbnailUrl,
                    fileSize: videoFile.size,
                    mimeType: videoFile.mimetype,
                },
            },
            message: "Video and thumbnail uploaded successfully",
        });
    } catch (error) {
        console.error("Upload video with thumbnail error:", error);

        // 에러 발생 시 업로드된 파일들 삭제
        if (req.files) {
            try {
                if (req.files.video) await fs.unlink(req.files.video[0].path);
                if (req.files.thumbnail)
                    await fs.unlink(req.files.thumbnail[0].path);
            } catch (unlinkError) {
                console.error("Failed to delete files:", unlinkError);
            }
        }

        return res.status(500).json({
            success: false,
            message: "Failed to upload video",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};
