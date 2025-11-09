const NodeMediaServer = require("node-media-server");
const { Video } = require("../models");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

// uploads/live 디렉토리 확인 및 생성
const liveDir = path.join(__dirname, "../../uploads/live");
if (!fs.existsSync(liveDir)) {
    fs.mkdirSync(liveDir, { recursive: true });
    console.log("Created live directory:", liveDir);
}

// FFmpeg 경로 자동 감지
let ffmpegPath = "/opt/homebrew/bin/ffmpeg"; // 기본값

// 활성 FFmpeg 프로세스 관리
const activeStreams = new Map(); // streamKey -> ffmpeg process

const config = {
    logType: 3, // 0-fatal, 1-error, 2-warn, 3-info (모든 로그 출력)

    rtmp: {
        port: 1935,
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60,
    },
    http: {
        port: 8888,
        allow_origin: "*",
        mediaroot: path.join(__dirname, "../../uploads"),
    },
};

console.log("");
console.log("=".repeat(80));
console.log("Node-Media-Server Configuration");
console.log("=".repeat(80));
console.log("FFmpeg Path:", ffmpegPath);
console.log("Media Root:", config.http.mediaroot);
console.log("Live Directory:", liveDir);
console.log("Log Type:", config.logType);
console.log("=".repeat(80));
console.log("");

// node-media-server 인스턴스 생성
const nms = new NodeMediaServer(config);

/**
 * FFmpeg로 RTMP -> HLS 변환 시작
 */
function startHLSConversion(streamKey) {
    if (activeStreams.has(streamKey)) {
        console.log(`HLS conversion already running for ${streamKey}`);
        return;
    }

    const streamDir = path.join(liveDir, streamKey);
    const rtmpUrl = `rtmp://localhost:1935/live/${streamKey}`;
    const playlistPath = path.join(streamDir, "index.m3u8");
    const segmentPattern = path.join(streamDir, "seg_%03d.m4s");

    console.log("");
    console.log("=".repeat(80));
    console.log("Starting HLS Conversion");
    console.log("=".repeat(80));
    console.log("Stream Key:", streamKey);
    console.log("RTMP URL:", rtmpUrl);
    console.log("Output Directory:", streamDir);
    console.log("Playlist:", playlistPath);
    console.log("=".repeat(80));
    console.log("");

    // FFmpeg 프로세스 시작
    const ffmpeg = spawn(
        ffmpegPath,
        [
            "-i",
            rtmpUrl,
            "-c:v",
            "copy",
            "-c:a",
            "copy",
            "-f",
            "hls",
            "-hls_time",
            "6",
            "-hls_list_size",
            "10",
            "-hls_segment_type",
            "fmp4",
            "-hls_fmp4_init_filename",
            "init.mp4",
            "-hls_flags",
            "delete_segments+independent_segments",
            "-hls_segment_filename",
            segmentPattern,
            "-g",
            "60",
            "-sc_threshold",
            "0",
            "-start_at_zero",
            "-vsync",
            "cfr",
            "-avoid_negative_ts",
            "make_zero",
            "-fflags",
            "+genpts",
            playlistPath,
        ],
        {
            env: {
                ...process.env,
                PATH: process.env.PATH + ":/opt/homebrew/bin:/usr/local/bin",
            },
        }
    );

    activeStreams.set(streamKey, ffmpeg);

    ffmpeg.stdout.on("data", (data) => {
        console.log(`[FFmpeg ${streamKey}] ${data}`);
    });

    ffmpeg.stderr.on("data", (data) => {
        const message = data.toString();
        // FFmpeg는 대부분 stderr로 출력
        if (message.includes("frame=") || message.includes("time=")) {
            // 진행 상황 로그는 간단히
            process.stdout.write(`[FFmpeg ${streamKey}] Converting...\r`);
        } else {
            console.log(`[FFmpeg ${streamKey}] ${message}`);
        }
    });

    ffmpeg.on("close", (code) => {
        console.log("");
        console.log(`[FFmpeg ${streamKey}] Process exited with code ${code}`);
        activeStreams.delete(streamKey);
    });

    ffmpeg.on("error", (error) => {
        console.error(`[FFmpeg ${streamKey}] Error:`, error);
        activeStreams.delete(streamKey);
    });

    // 5초 후 파일 생성 확인
    setTimeout(() => {
        if (fs.existsSync(streamDir)) {
            const files = fs.readdirSync(streamDir);
            console.log("");
            console.log(`[${streamKey}] HLS files created:`, files);
            console.log(
                `[${streamKey}] Playback URL: http://localhost:8888/live/${streamKey}/index.m3u8`
            );
            console.log("");
        } else {
            console.log(`[${streamKey}] Warning: HLS directory not found`);
        }
    }, 5000);
}

/**
 * FFmpeg 프로세스 종료
 */
function stopHLSConversion(streamKey) {
    const ffmpeg = activeStreams.get(streamKey);
    if (ffmpeg) {
        console.log(`Stopping HLS conversion for ${streamKey}`);
        ffmpeg.kill("SIGTERM");
        activeStreams.delete(streamKey);
    }
}

// 모든 이벤트 로깅
nms.on("preConnect", (id, args) => {
    console.log("[preConnect]", `id=${id} args=${JSON.stringify(args)}`);
});

nms.on("postConnect", (id, args) => {
    console.log("[postConnect]", `id=${id} args=${JSON.stringify(args)}`);
});

nms.on("doneConnect", (id, args) => {
    console.log("[doneConnect]", `id=${id}`);
});

// 스트림 게시 시작 이벤트
nms.on("prePublish", async (id, StreamPath, args) => {
    // id는 실제로 session 객체
    const session = id;

    console.log("");
    console.log("=".repeat(80));
    console.log("[prePublish] RTMP STREAM STARTING");
    console.log("=".repeat(80));
    console.log("Session ID:", session.id);
    console.log("Stream Path:", session.streamPath);
    console.log("Stream Name:", session.streamName);
    console.log("Stream App:", session.streamApp);
    console.log("=".repeat(80));

    // StreamPath 형식: /live/STREAM_KEY
    const streamKey = session.streamName; // 또는 getStreamKeyFromPath(streamPath)

    if (!streamKey) {
        console.log("No stream key provided");
        session.reject();
        return;
    }

    try {
        // 데이터베이스에서 스트림 키 확인
        const video = await Video.findOne({
            where: {
                streamKey: streamKey,
                videoType: "live",
            },
        });

        if (!video) {
            console.log("Invalide stream key, rejecting");
            session.reject();
            return;
        }

        console.log("Valid stream key for video:", video.title);

        // 중요: 스트림 키별 디렉토리 생성
        const streamDir = path.join(liveDir, streamKey);
        if (!fs.existsSync(streamDir)) {
            fs.mkdirSync(streamDir, { recursive: true });
            console.log("Created stream directory:", streamDir);
        }

        await video.update({ isLive: true });
        console.log("Video marked as live");
    } catch (error) {
        console.error("Database error:", error);
        session.reject();
    }
});

// 스트림 게시 시작됨 (인증 통과 후)
nms.on("postPublish", async (id, StreamPath, args) => {
    const session = id;
    const streamKey = session.streamName;

    console.log("");
    console.log("[postPublish] STREAM BROADCASTING");
    console.log("Stream Name:", streamKey);
    console.log("");

    // HLS 변환 시작
    setTimeout(() => {
        startHLSConversion(streamKey);
    }, 1000); // 1초 대기 후 시작 (RTMP 스트림 안정화)
});

// 스트림 종료 이벤트
nms.on("donePublish", async (id, StreamPath, args) => {
    const session = id;
    const streamKey = session.streamName;

    console.log("");
    console.log("[donePublish] STREAM ENDED");
    console.log("Stream Name:", streamKey);
    console.log("");

    // HLS 변환 중지
    stopHLSConversion(streamKey);

    if (streamKey) {
        try {
            const video = await Video.findOne({
                where: {
                    streamKey: streamKey,
                    videoType: "live",
                },
            });

            if (video) {
                await video.update({ isLive: false });
                console.log("Video marked as offline");
            }
        } catch (error) {
            console.error("Database error:", error);
        }
    }
});

module.exports = {
    nms,
    startMediaServer: () => {
        // 시작 전 한 번 더 확인
        console.log("");
        console.log("=".repeat(80));
        console.log("Pre-flight Check");
        console.log("=".repeat(80));

        // FFmpeg 확인
        const { execSync } = require("child_process");

        // FFmpeg 경로 자동 감지 시도
        try {
            ffmpegPath = execSync("which ffmpeg").toString().trim();
            console.log("FFmpeg found at:", ffmpegPath);
        } catch (error) {
            console.log("Using default FFmpeg path:", ffmpegPath);
        }

        // FFmpeg 버전 확인
        try {
            const ffmpegVersion = execSync(`"${ffmpegPath}" -version`, {
                env: {
                    ...process.env,
                    PATH: process.env.PATH + ":/opt/homebrew/bin:/ur/local/bin",
                },
            })
                .toString()
                .split("\n")[0];
            console.log("FFmpeg version:", ffmpegVersion);
        } catch (error) {
            console.error("FFmpeg check failed:", error.message);
            console.error("Trying to start anyway...");
        }

        // 디렉토리 확인
        console.log("Live directory exists:", fs.existsSync(liveDir));
        console.log("Live directory path:", liveDir);

        console.log("=".repeat(80));
        console.log("");

        nms.run();

        console.log("");
        console.log("=".repeat(80));
        console.log("Node-Media-Server Started");
        console.log("=".repeat(80));
        console.log(`RTMP Server: rtmp://localhost:${config.rtmp.port}/live`);
        console.log(`HTTP Server: http://localhost:${config.http.port}`);
        console.log("=".repeat(80));
        console.log("");

        // 프로세스 종료 시 모든 FFmpeg 프로세스 정리
        process.on("exit", () => {
            console.log("Cleaning up FFmpeg processes...");
            activeStreams.forEach((ffmpeg, streamKey) => {
                stopHLSConversion(streamKey);
            });
        });

        process.on("SIGINT", () => {
            console.log("Received SIGINT, shutting down...");
            activeStreams.forEach((ffmpeg, streamKey) => {
                stopHLSConversion(streamKey);
            });
            process.exit(0);
        });
    },
};
