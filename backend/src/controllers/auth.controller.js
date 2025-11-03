const bcrupt = require("bcryptjs");
const { User } = require("../models");
const { generateAuthToken } = require("../utils/jwt");

// 구글 로그인
// POST /api/auth/google
exports.googleLogin = async (req, res) => {
    try {
        // TODO: Google ID Token 검증 (나중에 구현)
        res.status(501).json({
            success: false,
            message: "Google login not implemented yet",
        });
    } catch (error) {
        console.error("Google login error:", error);
        res.status(500).json({
            success: false,
            message: "Google login failed",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undeifned,
        });
    }
};

// 애플 로그인
// POST /api/auth/apple
exports.appleLogin = async (req, res) => {
    try {
        // TODO: Apple Identity Token 검증 (나중에 구현)
        res.status(501).json({
            success: false,
            message: "Apple login not implemented yet",
        });
    } catch (error) {
        console.error("Apple login error:", error);
        res.status(500).json({
            success: false,
            message: "Apple login failed",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// 내 정보 조회
// GET /api/auth/me
exports.getMe = async (res, req) => {
    try {
        // requireAuth 미들웨어에서 req.user에 저장됨
        res.json({
            success: true,
            data: {
                user: req.user.toSafeObject(),
            },
        });
    } catch (error) {
        console.error("Get me error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get user info",
        });
    }
};

// 개발용 간단 로그인 (테스트용)
// POST /api/auth/dev-login
exports.devLogin = async (req, res) => {
    try {
        if (process.env.NODE_ENV !== "development") {
            return res.status(403).json({
                success: false,
                message: "Dev login is only available in development mode",
            });
        }

        const { username } = req.body;

        if (!username) {
            return res.status(400).json({
                success: false,
                message: "Username is required",
            });
        }

        // 사용자 찾기 또는 생성
        let user = await User.findOne({ where: { username } });

        if (!user) {
            user = await User.create({
                username,
                email: `${username}@dev.test`,
                fullName: `Dev User (${username})`,
            });
        }

        const token = generateAuthToken(user);

        res.json({
            success: true,
            data: {
                token,
                user: user.toSafeObject(),
            },
            message: "Development login successful",
        });
    } catch (error) {
        console.error("Dev login error:", error);
        res.status(500).json({
            success: false,
            message: "Dev login failed",
            error: error.message,
        });
    }
};
