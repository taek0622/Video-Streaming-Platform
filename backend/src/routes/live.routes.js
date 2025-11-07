const express = require("express");
const router = express.Router();
const liveController = require("../controllers/live.controller");
const { requireAuth, optionalAuth } = require("../middleware/auth.middleware");

// 라이브 스트림 생성 (로그인 필수)
router.post("/start", requireAuth, liveController.startLive);

// 현재 라이브 중인 스트림 목록 (비로그인 가능)
router.get("/", optionalAuth, liveController.getLiveStreams);

// 모든 라이브 스트림 목록 (비로그인 가능)
router.get("/all", optionalAuth, liveController.getAllLivesStreams);

// 내 라이브 스트림 목록 (로그인 필수)
router.get("/my-streams", requireAuth, liveController.getMyStreams);

// 라이브 스트림 상세 (비로그인 가능)
router.get("/:id", optionalAuth, liveController.getLiveDetail);

// 라이브 스트림 수동 종료 (로그인 필수, 본인만)
router.post("/:id/end", requireAuth, liveController.endLive);

// 라이브 스트림 삭제 (로그인 필수, 본인만)
router.delete("/:id", requireAuth, liveController.deleteLive);

module.exports = router;
