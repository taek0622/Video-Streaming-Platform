const { verifyToken } = require("../utils/jwt");
const { User } = require("../models");

// 필수 인증 미들웨어
// JWT 토큰이 없거나 유효하지 않으면 401 에러
const requireAuth = async (req, res, next) => {
    try {
        // Authorization 헤더에서 토큰 추출
        const authHeader = req.header("Authorization");

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please provide a token.",
            });
        }

        // "Bearer TOKEN" 형식에서 토큰만 추출
        const token = authHeader.replace("Bearer ", "");

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is missing",
            });
        }

        // 토큰 검증
        const decoded = verifyToken(token);

        // 사용자 조회
        const user = await User.findByPk(decoded.id, {
            attributes: { exclud: ["passwordHash"] },
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found. Token may be invalid.",
            });
        }

        // req.user에 사용자 정보 저장
        req.user = user;
        next();
    } catch (error) {
        console.error("Auth middleware error:", error.message);
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};

// 선택적 인증 미들웨어
// 토큰이 있으면 검증하고, 없어도 진행
// (비로그인 상태에서도 접근 가능한 API에 사용)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.header("Authorization");

        if (!authHeader) {
            // 토큰 없음 - 그냥 진행
            return next();
        }

        const token = authHeader.replace("Bearer", "");

        if (token) {
            try {
                const decoded = verifyToken(token);
                const user = await User.findByPk(decoded.id, {
                    attributes: { exclude: ["passwordHash"] },
                });

                if (user) {
                    req.user = user;
                }
            } catch (error) {
                // 토큰이 잘못되어도 무시하고 진행
                console.log(
                    "Optional auth: Invalid token, continuing without auth"
                );
            }
        }

        next();
    } catch (error) {
        // 에러가 나도 그냥 진행
        next();
    }
};

// 리소스 소유자 확인 미들웨어
// 예: 자기 영상만 삭제/수정 가능
const checkOwnership = (resourceType) => {
    return async (req, res, next) => {
        try {
            const { User, Video, Comment } = require("../models");

            let resource;
            const resourceId = req.params.id;

            switch (resourceType) {
                case "video":
                    resource = await Video.findByPk(resourceId);
                    if (!resource) {
                        return res.status(404).json({
                            success: false,
                            message: "Video not found",
                        });
                    }
                    if (resource.uploaderId !== req.user.id) {
                        return res.status(403).json({
                            success: false,
                            message:
                                "You do not have permission to modify this video",
                        });
                    }
                    break;

                case "comment":
                    resource = await Comment.findByPk(resourceId);
                    if (!resource) {
                        return res.status(404).json({
                            success: false,
                            message: "Comment not found",
                        });
                    }
                    if (resource.userId !== req.user.id) {
                        return res.status(403).json({
                            success: false,
                            message:
                                "You do not have permission to modify this comment",
                        });
                    }
                    break;
                default:
                    return res.status(400).json({
                        success: false,
                        message: "Invalid resource type",
                    });
            }

            // 리소스를 req에 저장 (중복 조회 방지)
            req.resource = resource;
            next();
        } catch (error) {
            console.error("Ownership check error:", error);
            return res.status(500).json({
                success: false,
                message: "Error checking ownership",
            });
        }
    };
};

module.exports = {
    requireAuth,
    optionalAuth,
    checkOwnership,
};
