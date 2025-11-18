const express = require("express");
const router = express.Router();
const videoConntroller = require("../controllers/video.controller");
const { requireAuth, optionalAuth } = require("../middleware/auth.middleware");

// ==================== 검색 및 통계 라우트 ===================

// 통합 영상 검색 (VOD + Live)
router.get("/search", optionalAuth, videoConntroller.searchVideos);

// 인기 영상 (조회수 Top)
router.get("/trending", optionalAuth, videoConntroller.getTrendingVideos);

// 전체 통계
router.get("/stats", videoConntroller.getStats);

// 특정 게시자 통계
router.get("/stats/uploader/:userId", videoConntroller.getUploaderStats);

// 영상 목록 조회 (비로그인 가능)
router.get("/", optionalAuth, videoConntroller.getVideos);

// 특정 사용자의 영상 목록 (비로그인 가능)
router.get(
    "/uploader/:userId",
    optionalAuth,
    videoConntroller.getVideosByUploader
);

// 영상 상세 조회 (비로그인 가능)
router.get("/:id", optionalAuth, videoConntroller.getVideoDetail);

// 영상 생성 (로그인 필수)
router.post("/", requireAuth, videoConntroller.createVideo);

// 영상 수정 (로그인 필수, 본인만)
router.put("/:id", requireAuth, videoConntroller.updateVideo);

// 영상 삭제 (로그인 필수, 본인만)
router.delete("/:id", requireAuth, videoConntroller.deleteVideo);

// HLS 상태 확인
router.get("/:id/hls-status", videoConntroller.getHLSStatus);

module.exports = router;
