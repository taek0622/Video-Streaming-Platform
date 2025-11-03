const jwt = require("jsonwebtoken");

// JWT 토큰 생성
const generateToken = (
    payload,
    expiresIn = process.env.JWT_EXPIRES_IN || "7d"
) => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

// JWT 토큰 검증
const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw new Error("Invalid or expired token");
    }
};

// 사용자 정보로 JWT 생성
const generateAuthToken = (user) => {
    return generateToken({
        id: user.id,
        username: user.username,
        email: user.email,
    });
};

module.exports = {
    generateToken,
    verifyToken,
    generateAuthToken,
};
