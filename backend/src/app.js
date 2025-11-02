const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { sequelize, testConnection } = require("./config/database");

const app = express();

// 기본 라우트
app.get("/", (req, res) => {
    res.json({
        message: "Video Streaming Platform API",
        version: "1.0.0",
    });
});

module.exports = app;
