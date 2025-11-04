const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { sequelize, testConnection } = require("./config/database");
const models = require("./models"); // import model

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 업로드 영상 재생
app.use("/uploads", express.static("uploads"));

// import route
const authRoutes = require("./routes/auth.routes");
const videoRoutes = require("./routes/video.routes");
const commentRoutes = require("./routes/comment.routes");

// API 라우트
app.use("/api/auth", authRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api", commentRoutes);

// 서버 상태 확인
app.get("/status", (req, res) => {
    res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
    });
});

// 기본 라우트
app.get("/", (req, res) => {
    res.json({
        message: "Video Streaming Platform API",
        version: "1.0.0",
        endpoints: {
            auth: "/api/auth",
            status: "/status",
        },
    });
});

// 테스트용: 모델 확인
app.get("/models", (req, res) => {
    const modelNames = Object.keys(models).filter(
        (key) => key !== "sequelize" && key !== "Sequelize"
    );
    res.json({
        models: modelNames,
        message: "Available models",
    });
});

// Middleware 에러 처리
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
});

// 404 처리
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        // DB 연결 테스트
        await testConnection();

        // DB 동기화 (개발 환경)
        if (process.env.NODE_ENV === "development") {
            // force: true - 테이블 삭제 후 재생성
            // alter: true - 테이블 구조 변경 (컬럼 추가/삭제)
            await sequelize.sync({ force: false, alter: true });
            console.log("Database synchronized");
            console.log(
                "Models:",
                Object.keys(models)
                    .filter((key) => key !== "sequelize" && key !== "Sequelize")
                    .join(", ")
            );

            // 테스트 데이터 추가 (최초 1회만)
            // const { seedTestData } = require("./utils/seedData");
            // await seedTestData();
        }

        // 서버 시작
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
            console.log(`http://localhost:${PORT}`);
            console.log(`API Docs: https://localhost:${PORT}/`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
