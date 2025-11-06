const { Video } = require("../models");
const path = require("path");
const fs = require("fs").promises;
const { v4: uuidv4 } = require("uuid");
const {
    convertToHLS,
    convertToHLSFast,
    getVideoInfo,
    generateThumbnail,
    convertToAdaptiveHLS,
} = require("../utils/ffmpeg");

/**
 * 영상 파일 업로드 (HLS fMP4 변환 포함)
 * POST /api/upload/video
 */
exports.uploadVideoFile = async (req, res) => {
    let video = null;

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No video file provided",
            });
        }

        const {
            title,
            description,
            quality = "single", // quality: 'single' (단일 화질) or 'adaptive' (다중 화질)
            keepOriginal = "false", // 원본 유지 여부 (기본: 삭제)
        } = req.body;

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

        // 영상 메타데이터 저장 (HLS 변환 전)
        video = await Video.create({
            title,
            description: description || "",
            videoType: "vod",
            videoUrl,
            uploaderId: req.user.id,
            hlsStatus: "processing", // HLS 변환 중
        });

        // 클라이언트에게 즉시 응답 (변환은 백그라운드에서)
        res.status(201).json({
            success: true,
            data: {
                video: {
                    id: video.id,
                    title: video.title,
                    videoUrl: video.videoUrl,
                    hlsStatus: "processing",
                    message:
                        "Video uploaded. HLS (fMP4) conversion in progress...",
                },
            },
            message: "Video uploaded successfully. Converting to HLS (fMP4)...",
        });

        // 백그라운드에서 HLS 변환 및 썸네일 생성
        const shouldKeepOriginal = keepOriginal === "true";
        processVideoInBackground(
            video.id,
            req.file.path,
            quality,
            shouldKeepOriginal
        );
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

        if (video) {
            await video.update({ hlsStatus: "failed" });
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

/**
 * 썸네일 업로드
 * POST /api/upload/thumbnail
 */
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
            await fs.unlink(req.file.path);
            return res.status(403).json({
                success: false,
                message: "You do not have permission to update this video",
            });
        }

        // 기존 썸네일 삭제
        if (video.thumbnailUrl) {
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

/**
 * 영상 + 썸네일 동시 업로드
 * POST /api/upload/video-with-thumbnail
 */
exports.uploadVideoWithThumbnail = async (req, res) => {
    let video = null;

    try {
        if (!req.files || !req.files.video) {
            return res.status(400).json({
                success: false,
                message: "No video file provided",
            });
        }

        const {
            title,
            description,
            quality = "single",
            keepOriginal = "false",
        } = req.body;

        if (!title) {
            // 업로드된 파일들 삭제
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
            hlsStatus: "processing",
        });

        res.status(201).json({
            success: true,
            data: {
                video: {
                    id: video.id,
                    title: video.title,
                    videoUrl: video.videoUrl,
                    thumbnailUrl: video.thumbnailUrl,
                    hlsStatus: "processing",
                },
            },
            message:
                "Video and thumbnail uploaded. Converting to HLS (fMP4)...",
        });

        // 백그라운드 처리
        const shouldKeepOriginal = keepOriginal === "true";
        processVideoInBackground(
            video.id,
            videoFile.path,
            quality,
            shouldKeepOriginal
        );
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

        if (video) {
            await video.update({ hlsStatus: "failed" });
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

/**
 * 백그라운드 영상 처리
 * @param {number} videoId - 영상 ID
 * @param {string} videoPath - 원본 영상 파일 경로
 * @param {string} quality - 'single' or 'adaptive'
 * @param {boolean} keepOriginal - 원본 파일 유지 여부
 */
async function processVideoInBackground(
    videoId,
    videoPath,
    quality = "single",
    keepOriginal = false
) {
    try {
        console.log(
            `Processing video ${videoId} (quality: ${quality}, keepOriginal: ${keepOriginal})...`
        );

        const video = await Video.findByPk(videoId);
        if (!video) {
            console.error("Video not found:", videoId);
            return;
        }

        // 영상 정보 추출
        console.log("Extracting video info...");
        const videoInfo = await getVideoInfo(videoPath);

        await video.update({
            duration: videoInfo.duration,
            width: videoInfo.width,
            height: videoInfo.height,
        });

        console.log(
            `Video info: ${videoInfo.width}x${videoInfo.height}, ${videoInfo.duration}s, ${videoInfo.videoCodec}`
        );

        // HLS 변환
        const videoFileName = path.basename(videoPath, path.extname(videoPath));
        const hlsDir = path.join(path.dirname(videoPath), "hls", videoFileName);

        let hlsResult;

        if (quality === "adaptive") {
            // 다중 화질 (ABR)
            console.log("Converting to Adaptive HLS (fMP4)...");
            hlsResult = await convertToAdaptiveHLS(videoPath, hlsDir, "stream");

            await video.update({
                hlsUrl: hlsResult.masterPlaylistUrl,
                hlsStatus: "completed",
            });
        } else {
            // 단일 화질 (빠른 변환 시도)
            console.log("Converting to HLS (fMP4)...");

            // H.264/AAC 체크 후 빠른 변환 시도
            const isCompatible =
                videoInfo.videoCodec === "h264" &&
                (videoInfo.audioCodec === "aac" || !videoInfo.audioCodec);

            if (isCompatible) {
                console.log("Using fast conversion (codec copy)");
                hlsResult = await convertToHLSFast(
                    videoPath,
                    hlsDir,
                    "playlist"
                );
            } else {
                console.log("Using standard conversion (re-encoding)");
                hlsResult = await convertToHLS(videoPath, hlsDir, "playlist");
            }

            await video.update({
                hls: hlsResult.playlistUrl,
                hlsStatus: "completed",
            });
        }

        // 썸네일 생성 (없으면)
        if (!video.thumbnailUrl) {
            console.log("Generating thumbnail...");
            const thumbnailDir = path.join(
                __dirname,
                "../../uploads/thumbnails"
            );
            await fs.mkdir(thumbnailDir, { recursive: true });

            const thumbnailPath = path.join(
                thumbnailDir,
                `${videoFileName}.jpg`
            );
            const thumbnailTime = Math.min(videoInfo.duration * 0.1, 5);
            await generateThumbnail(videoPath, thumbnailPath, thumbnailTime);

            await video.update({
                thumbnailUrl: `/uploads/thumbnails/${videoFileName}.jpg`,
            });
        }

        // 원본 파일 삭제 (옵션)
        if (!keepOriginal) {
            console.log("Deleting original file...");
            try {
                await fs.unlink(videoPath);
                console.log("Original file deleted");

                // DB에서 videoUrl을 null로 설정 (HLS만 사용)
                await video.update({ videoUrl: null });
            } catch (error) {
                console.error("Failed to delete original file:", error);
                // 삭제 실패해도 계속 진행
            }
        } else {
            console.log("Original file kept");
        }

        console.log(`Video ${videoId} processing completed!`);
        console.log(`   Format: fMP4`);
        console.log(`   Segments: ${hlsResult.segmentCount || "N/A"}`);
        console.log(`   Quality: ${quality}`);
        console.log(`   Original: ${keepOriginal ? "Kept" : "Deleted"}`);
    } catch (error) {
        console.error(`Video ${videoId} processing failed`, error);

        const video = await Video.findByPk(videoId);
        if (video) {
            await video.update({ hlsStatus: "failed" });
        }
    }
}
