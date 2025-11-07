const NodeMediaServer = require("node-media-server");
const { Video } = require("../models");
const path = require("path");
const fs = require("fs");
// const { execSync } = require("child_process");

// uploads/live 디렉토리 확인 및 생성
const liveDir = path.join(__dirname, "../../uploads/live");
if (!fs.existsSync(liveDir)) {
    fs.mkdirSync(liveDir, { recursive: true });
    console.log("Created live directory:", liveDir);
}

// FFmpeg 경로 자동 감지
let ffmpegPath = "/opt/homebrew/bin/ffmpeg"; // 기본값

// try {
//     ffmpegPath = execSync("which ffmpeg").toString().trim();
//     console.log("FFmpeg found at:", ffmpegPath);
// } catch (error) {
//     console.warn("Could not auto-detect ffmpeg, using default path");
// }

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
    trans: {
        ffmpeg: ffmpegPath,
        task: [
            {
                app: "live",
                hls: true,
                hlsFlags:
                    // "[hls_time=2:hls_list_size=3:hls_flags=delete_segments]",
                    "[hls_time=6:hls_list_size=0]",
                hlsKeep: true, // 세그먼트 자동 삭제 true로 변경 (디버깅용)
                dash: false,
            },
        ],
    },
};

console.log("");
console.log("=".repeat(80));
console.log("Node-Media-Server Configuration");
console.log("=".repeat(80));
console.log("FFmpeg Path:", config.trans.ffmpeg);
console.log("Media Root:", config.http.mediaroot);
console.log("Live Directory:", liveDir);
console.log("Log Type:", config.logType);
console.log("=".repeat(80));
console.log("");

// node-media-server 인스턴스 생성
const nms = new NodeMediaServer(config);

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
    // console.log("");
    // console.log("=".repeat(80));
    // console.log("RTMP PUBLISH ATTEMPT");
    // console.log("=".repeat(80));

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

    // streamPath는 session 객체에서 가져오기
    // const streamPath = session.streamPath;
    // StreamPath 형식: /live/STREAM_KEY
    const streamKey = session.streamName; // 또는 getStreamKeyFromPath(streamPath)
    // console.log("Extracted Stream Key:", streamKey);

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
        await video.update({ isLive: true });
        // console.log("Stream authorized, starting broadcast...");
        console.log("Video marked as live");

        // 라이브 상태로 업데이트
        // await video.update({ isLive: true });

        // console.log("=".repeat(80));
        // console.log("");
    } catch (error) {
        // console.error("Error during stream authentication:", error);
        console.error("Database error:", error);
        session.reject();
    }
});

// 스트림 게시 시작됨 (인증 통과 후)
nms.on("postPublish", async (id, StreamPath, args) => {
    const session = id;
    console.log("");
    // console.log("STREAM STARTED");
    console.log("[postPublish] STREAM BROADCASTING");
    console.log("Stream Name:", session.streamName);
    // console.log(
    //     "HLS URL: http://localhost:8888/live/" +
    //         session.streamName +
    //         "/index.m3u8"
    // );
    // console.log(
    //     "HLS Path:",
    //     path.join(__dirname, "../../uploads/live/", session.streamName)
    // );
    console.log(
        "Expected HLS URL:",
        `http://localhost:8888/live/${session.streamName}/index.m3u8`
    );
    console.log("Expected HLS Path:", path.join(liveDir, session.streamName));
    console.log("");

    // 5초 후 디렉토리 확인
    setTimeout(() => {
        const streamDir = path.join(liveDir, session.streamName);
        if (fs.existsSync(streamDir)) {
            const files = fs.readdirSync(streamDir);
            console.log("HLS files created:", files);
        } else {
            console.log("HLS directory not created:", streamDir);
            console.log("Check FFmpeg path and permissions!");
        }
    }, 5000);
});

// 스트림 종료 이벤트
nms.on("donePublish", async (id, StreamPath, args) => {
    // console.log("");
    // console.log("=".repeat(80));
    // console.log("RTMP STREAM ENDED");
    // console.log("=".repeat(80));

    const session = id;
    console.log("");
    console.log("[donePublish] STREAM ENDED");
    // console.log("Session ID:", session.id);
    console.log("Stream Name:", session.streamName);
    console.log("");

    const streamKey = session.streamName;
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
                // console.log("Video status updated to offline:", video.title);
                console.log("Video marked as offline");
            }
        } catch (error) {
            // console.error("Error updating video status:", error);
            console.error("Database error:", error);
        }
    }

    // console.log("=".repeat(80));
    // console.log("");
});

// Transcode 시작
nms.on("preConvert", (id, StreamPath, args) => {
    console.log("");
    // console.log("TRANSCODE STARTING");
    console.log("[preConvert] HLS TRANSCODING STARTING");
    console.log("ID:", id);
    console.log("Stream Path:", StreamPath);
    console.log("Args:", args);
    console.log("");
});

// Transcode 완료
nms.on("postConvert", (id, StreamPath, args) => {
    console.log("");
    // console.log("TRANSCODE COMPLETED");
    console.log("[postConvert] HLS TRANSCODING COMPLETED");
    console.log("ID:", id);
    console.log("Stream Path:", StreamPath);
    console.log("");
});

// Transcode 실패
nms.on("doneConvert", (id, StreamPath, args) => {
    console.log("");
    // console.log("TRANSCODE ENDED");
    console.log("[doneConvert] HLS TRANSCODING FINISHED");
    console.log("ID:", id);
    console.log("Stream Path:", StreamPath);
    console.log("");
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
        try {
            const ffmpegVersion = execSync(`${config.trans.ffmpeg} -version`)
                .toString()
                .split("\n")[0];
            console.log("FFmpeg:", ffmpegVersion);
        } catch (error) {
            console.error("FFmpeg not found at:", config.trans.ffmpeg);
            console.error("Please update the ffmpeg path in mediaServer.js");
            process.exit(1);
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
        // console.log(`FFmpeg: ${ffmpegPath}`);
        // console.log(`Media Root: ${config.http.mediaroot}`);
        // console.log(`Log Type: ${config.logType} (3=info, all logs)`);
        console.log("=".repeat(80));
        console.log("");
    },
};
