const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");

// OAuth 로그인
router.post("/google", authController.googleLogin);
router.post("/apple", authController.appleLogin);

// 내 정보 조회 (로그인 필수)
router.get("/me", requireAuth, authController.getMe);

// 개발용 로그인 (개발 환경에서만)
if (process.env.NODE_ENV === "development") {
    router.post("/dev-login", authController.devLogin);
}

module.exports = router;
