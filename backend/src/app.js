const express = require("express");
const cors = require("cors");
const http = require("http");
require("dotenv").config();

const { sequelize, testConnection } = require("./config/database");
const models = require("./models"); // import model

// 미디어 서버 및 채팅 서버
const { startMediaServer } = require("./services/mediaServer");
const { initChatServer } = require("./services/chatServer");

const app = express();

// HTTP 서버 생성 (ws)
const httpServer = http.createServer(app);

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
const uploadRoutes = require("./routes/upload.routes");
const liveRoutes = require("./routes/live.routes"); // 추가 예정

// API 라우트
app.use("/api/auth", authRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api", commentRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/live", liveRoutes); // 추가 예정

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
            videos: "/api/videos",
            live: "/api/live",
            upload: "/api/upload",
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

        // HTTP 서버 시작
        httpServer.listen(PORT, () => {
            console.log(`HTTP Server is running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
            console.log(`http://localhost:${PORT}`);
        });

        // WS 채팅 서버 초기화
        initChatServer(httpServer);

        // Node-Media-Server 시작 (RTMP)
        startMediaServer();

        // 서버 시작
        // app.listen(PORT, () => {
        //     console.log(`Server is running on port ${PORT}`);
        //     console.log(`Environment: ${process.env.NODE_ENV}`);
        //     console.log(`http://localhost:${PORT}`);
        //     console.log(`API Docs: https://localhost:${PORT}/`);
        // });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
