const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/upload.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const {
    uploadVideo,
    uploadThumbnail,
    uploadVideoWithThumbnail,
} = require("../config/multer");

// 영상 파일만 업로드 (로그인 필수)
router.post(
    "/video",
    requireAuth,
    (req, res, next) => {
        uploadVideo(req, res, (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message,
                });
            }
            next();
        });
    },
    uploadController.uploadVideoFile
);

// 썸네일만 업로드 (로그인 필수)
router.post(
    "/thumbnail",
    requireAuth,
    (req, res, next) => {
        uploadThumbnail(req, res, (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message,
                });
            }
            next();
        });
    },
    uploadController.uploadThumbnailFile
);

// 영상 + 썸네일 동시 업로드 (로그인 필수)
router.post(
    "/video-with-thumbnail",
    requireAuth,
    (req, res, next) => {
        uploadVideoWithThumbnail(req, res, (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message,
                });
            }
            next();
        });
    },
    uploadController.uploadVideoWithThumbnail
);

module.exports = router;
