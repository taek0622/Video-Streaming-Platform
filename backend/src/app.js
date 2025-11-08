const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
require("dotenv").config();

const { sequelize, testConnection } = require("./config/database");
const models = require("./models"); // import model

// 미디어 서버 및 채팅 서버
const { startMediaServer } = require("./services/mediaServer");
const { initChatServer } = require("./services/chatServer");

const app = express();

// HTTP 서버 생성 (ws)
const httpServer = http.createServer(app);

// Middleware (순서 중요)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log("");
console.log("=".repeat(80));
console.log("Setting up static file routes");
console.log("=".repeat(80));

// 정적 파일 서빙 (우선순위 높게)
// 업로드 영상 재생
const uploadsPath = path.join(__dirname, "../uploads");
const livePath = path.join(__dirname, "../uploads/live");

console.log("Uploads directory:", uploadsPath);
console.log("Live directory:", livePath);

// uploads 폴더 전체 서빙
app.use(
    "/uploads",
    (req, res, next) => {
        console.log("[Static] /uploads request:", req.path);
        next();
    },
    express.static(uploadsPath)
);

// live 폴더 직접 서빙 (CORS 설정 포함)
app.use(
    "live",
    (req, res, next) => {
        console.log("[Static] /live request:", req.path);

        // CORS 헤더 설정
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type, Range");

        // OPTIONS 요청 처리
        if (req.method === "OPTIONS") {
            return res.sendStatus(200);
        }

        // Content-Type 설정
        if (req.path.endsWith(".m3u8")) {
            res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        } else if (req.path.endsWith(".m4s")) {
            res.setHeader("Content-Type", "video/iso.segment");
        }

        next();
    },
    express.static(livePath, {
        setHeaders: (res, filePath) => {
            console.log("[Static] Serving file:", filePath);
        },
    })
);

console.log("=".repeat(80));
console.log("");

// API ROUTES
const authRoutes = require("./routes/auth.routes");
const videoRoutes = require("./routes/video.routes");
const commentRoutes = require("./routes/comment.routes");
const uploadRoutes = require("./routes/upload.routes");
const liveRoutes = require("./routes/live.routes");

// API 라우트
app.use("/api/auth", authRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api", commentRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/live", liveRoutes);

// UTILITY ROUTES
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
            hls: "/live/:streamKey/index.m3u8",
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

// 디버깅용: live 디렉토리 내용 확인
app.get("/debug/live", (req, res) => {
    const fs = require("fs");
    const livePath = path.join(__dirname, "../uploads/live");

    try {
        const dirs = fs.readdirSync(livePath);
        const result = {};

        dirs.forEach((dir) => {
            const dirPath = path.join(livePath, dir);
            if (fs.statSync(dirPath).isDirectory()) {
                result[dir] = fs.readdirSync(dirPath);
            }
        });

        res.json({
            success: true,
            livePath,
            streams: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

// ERROR HANDLERS
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
    console.log("[404] Not found:", req.method, req.path);
    res.status(404).json({
        success: false,
        message: "Route not found",
        path: req.path,
    });
});

// SERVER START
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
            console.log("");
            console.log("=".repeat(80));
            console.log("HTTP Server Started");
            console.log("=".repeat(80));
            console.log(`Port: ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
            console.log(`API: http://localhost:${PORT}`);
            console.log(
                `HLS: http://localhost:${PORT}/live/:streamKey:index.m3u8`
            );
            console.log(`Debug: http://localhost:${PORT}/debug/live`);
            console.log("=".repeat(80));
            console.log("");
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
