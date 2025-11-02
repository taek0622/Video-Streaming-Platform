const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { sequelize, testConnection } = require("./config/database");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 업로드 영상 재생
app.use("/uploads", express.static("uploads"));

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

module.exports = app;
