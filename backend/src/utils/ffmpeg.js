const { exec } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const fs = require("fs").promises;

const execPromise = promisify(exec);

/**
 * MP4 영상을 HLS (fMP4) 형식으로 변환
 * @param {string} inputPath - 원본 MP4 파일 경로
 * @param {string} outputDir - HLS 파일을 저장할 디렉토리
 * @param {string} outputName - 출력 파일 이름 (확장자 제외)
 * @returns {Promise<Object>} - 변환 결과 정보
 */
const convertToHLS = async (inputPath, outputDir, outputName) => {
    try {
        // 출력 디렉토리 생성
        await fs.mkdir(outputDir, { recursive: true });

        const playlistPath = path.join(outputDir, `${outputName}.m3u8`);
        const segmentPattern = path.join(outputDir, `${outputName}_%03d.m4s`);

        // FFmpeg 명령어 (fMP4 기반 HLS)
        // -c:v copy: 비디오 코덱 복사 (빠른 변환, 재인코딩 없음)
        // -c:a copy: 오디오 코덱 복사
        // -f hls: HLS 형식
        // -hls_segment_type fmp4: fMP4 세그먼트 사용 (TS 대신)
        // -hls_fmp4_init_filename: 초기화 세그먼트 파일명
        // -hls_time 6: 각 세그먼트 길이 (6초)
        // -hls_list_size 0: 플레이리스트에 모든 세그먼트 포함
        // -hls_flags independent_segments: 각 세그먼트 독립적
        const ffmpegCommand = `ffmpeg -i "${inputPath}" \
        -c:v copy \
        -c:a copy \
        -f hls \
        -hls_time 6 \
        -hls_segment_type fmp4 \
        -hls_fmp4_init_filename "init.mp4" \
        -hls_segment_filename "${segmentPattern}" \
        -hls_list_size 0 \
        -hls_flags independent_segments \
        "${playlistPath}"`;

        console.log("Starting HLS (fMP4) conversion...");
        console.log("Input:", inputPath);
        console.log("Output:", playlistPath);

        const { stdout, stderr } = await execPromise(ffmpegCommand);

        console.log("HLS (fMP4) conversion completed");
        if (stderr) {
            console.log(
                "FFmpeg output:",
                stderr.substring(stderr.length - 500)
            );
        }

        // 생성된 세그먼트 파일 목록
        const files = await fs.readdir(outputDir);
        const segments = files.filter((f) => f.endsWith(".m4s"));
        const hasInit = files.includes("init.mp4");

        return {
            success: true,
            playlistPath: playlistPath.replace(
                path.join(__dirname, "../../"),
                ""
            ), // 상대 경로
            playlistUrl: playlistPath.replace(
                path.join(__dirname, "../../"),
                "/"
            ),
            initSegment: hasInit
                ? path
                      .join(outputDir, "init.mp4")
                      .replace(path.join(__dirname, "../../"), "/")
                : null,
            segmentCount: segments.length,
            segments: segments,
            format: "fmp4",
        };
    } catch (error) {
        console.error("HLS (fMP4) conversion failed:", error);
        throw new Error(`HLS conversion failed: ${error.message}`);
    }
};

/**
 * 영상 정보 추출 (길이, 해상도 등)
 * @param {string} videoPath - 영상 파일 경로
 * @return {Promise<Object>} - 영상 정보
 */
const getVideoInfo = async (videoPath) => {
    try {
        const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`;
        console.log("Running ffprobe:", command);

        const { stdout, stderr } = await execPromise(command);

        if (!stdout) {
            throw new Error("ffprobe returned empty output");
        }

        const info = JSON.parse(stdout);

        if (!info.streams || info.streams.length === 0) {
            throw new Error("No streams found in video");
        }

        if (!info.format) {
            throw new Error("No format information found");
        }

        const videoStream = info.streams.find((s) => s.codec_type === "video");
        const audioStream = info.streams.find((s) => s.codec_type === "audio");

        if (!videoStream) {
            throw new Error("No video stream found");
        }

        // duration 처리 (여러 소스에서 가져오기)
        let duration = 0;
        if (info.format.duration) {
            duration = parseFloat(info.format.duration);
        } else if (videoStream.duration) {
            duration = parseFloat(videoStream.duration);
        } else if (videoStream.tags && videoStream.tags.DURATION) {
            // 일부 포맷은 tags에 duration 있음
            const durationStr = videoStream.tags.DURATION; // "00:02:30.000000"
            const parts = durationStr.split(":");
            duration =
                parseInt(parts[0]) * 3600 +
                parseInt(parts[1]) * 60 +
                parseFloat(parts[2]);
        }

        // bitrate 처리 (optional)
        let bitrate = 0;
        if (info.format.bit_rate) {
            bitrate = parseInt(info.format.bit_rate);
        } else if (videoStream.bit_rate) {
            bitrate = parseInt(videoStream.bit_rate);
        }

        // size 처리 (optional)
        let size = 0;
        if (info.format.size) {
            size = parseInt(info.format.size);
        }

        // fps 처리
        let fps = 0;
        if (videoStream.r_frame_rate) {
            try {
                fps = eval(videoStream.r_frame_rate); // "30/1" -> 30
            } catch (e) {
                fps = 0;
            }
        } else if (videoStream.avg_frame_rate) {
            try {
                fps = eval(videoStream.avg_frame_rate);
            } catch (e) {
                fps = 0;
            }
        }

        const result = {
            duration: Math.floor(duration) || 0, // 초 단위
            width: videoStream.width || 0,
            height: videoStream.height || 0,
            videoCodec: videoStream.codec_name || "unknown",
            audioCodec: audioStream?.codec_name || null,
            bitrate: bitrate,
            size: size,
            fps: fps,
        };

        // 원본 영상에서만 자세한 로그, 세그먼트는 간단히
        if (videoPath.includes(".m4s") || videoPath.includes(".ts")) {
            console.log(`Segment info: ${result.width}x${result.height}`);
        } else {
            console.log(
                "Video info extracted:",
                JSON.stringify(result, null, 2)
            );
        }

        return result;
    } catch (error) {
        console.error("Failed to get video info:", error.message);
        console.error("Video path:", videoPath);

        // 파일이 존재하는지 확인
        try {
            await fs.access(videoPath);
            console.log("File exists");
        } catch (e) {
            console.error("File does not exist");
            throw new Error("Video file not found");
        }

        throw new Error(`Failed to get video info: ${error.message}`);
    }
};

/**
 * 영상에서 썸네일 생성
 * @param {string} videoPath - 영상 파일 경로
 * @param {string} outputPath - 썸네일 저장 경로
 * @param {number} timeInSeconds - 캡처할 시간 (초)
 * @returns {Promise<string>} - 썸네일 경로
 */
const generateThumbnail = async (videoPath, outputPath, timeInSeconds = 1) => {
    try {
        // 고화질 썸네일 생성
        const command = `ffmpeg -i "${videoPath}" -ss ${timeInSeconds} -vframes 1 -vf scale=1280:-1 -q:v 2 "${outputPath}"`;
        await execPromise(command);

        console.log("Thumbnail generated:", outputPath);
        return outputPath;
    } catch (error) {
        console.error("Failed to generate thumbnail:", error);
        throw new Error(`Failed to generate thumbnail: ${error.message}`);
    }
};

/**
 * 여러 화질의 HLS (fMP4) 생성 (Adaptive Bitrate Streaming)
 * @param {string} inputPath - 원본 MP4 파일 경로
 * @param {string} outputDir - HLS 파일을 저장할 디렉토리
 * @param {string} outputName - 출력 파일 이름
 * @returns {Promise<Object>} - 변환 결과
 */
const convertToAdaptiveHLS = async (inputPath, outputDir, outputName) => {
    try {
        await fs.mkdir(outputDir, { recursive: true });

        // 원본 영상 정보 확인
        const videoInfo = await getVideoInfo(inputPath);
        const originalHeight = videoInfo.height;

        console.log(`Original video: ${videoInfo.width}x${videoInfo.height}`);

        // 원본 해상도에 따라 변환할 화질 결정
        const allVariants = [
            {
                name: "1080p",
                height: 1080,
                bitrate: "5000k",
                maxrate: "5350k",
                bufsize: "7500k",
            },
            {
                name: "720p",
                height: 720,
                bitrate: "2800k",
                maxrate: "2996k",
                bufsize: "4200k",
            },
            {
                name: "480p",
                height: 480,
                bitrate: "1400k",
                maxrate: "1498k",
                bufsize: "2100k",
            },
            {
                name: "360p",
                height: 360,
                bitrate: "800k",
                maxrate: "856k",
                bufsize: "1200k",
            },
        ];

        // 원본보다 높은 해상도는 제외
        const variants = allVariants.filter((v) => v.height <= originalHeight);

        if (variants.length === 0) {
            // 원본이 매우 낮은 해상도라면 그대로 사용
            variants.push({
                name: "original",
                height: originalHeight,
                bitrate: "1400k",
                maxrate: "1498k",
                bufsize: "2100k",
            });
        }

        const masterPlaylist = path.join(
            outputDir,
            `${outputName}_master.m3u8`
        );
        let masterContent = "#EXTM3U\n#EXT-X-VERSION:7\n"; // Version 7 for fMP4

        for (const variant of variants) {
            const variantDir = path.join(outputDir, variant.name);
            await fs.mkdir(variantDir, { recursive: true });

            const playlistPath = path.join(variantDir, "playlist.m3u8");
            const segmentPattern = path.join(variantDir, "seg_%03d.m4s");

            // 해상도 계산 (aspect ratio 유지)
            const scale = `-2:${variant.height}`;

            const command = `ffmpeg -i "${inputPath}" \
            -vf scale=${scale} \
            -c:v libx264 \
            -preset medium \
            -b:v ${variant.bitrate} \
            -maxrate ${variant.maxrate} \
            -bufsize ${variant.bufsize} \
            -c:a aac \
            -b:a 128k \
            -f hls \
            -hls_time 6 \
            -hls_segment_type fmp4 \
            -hls_fmp4_init_filename "init.mp4" \
            -hls_segment_filename "${segmentPattern}" \
            -hls_list_size 0 \
            -hls_flags independent_segments \
            "${playlistPath}"`;

            console.log(`Converting ${variant.name} (${variant.height}p)...`);
            await execPromise(command);
            console.log(`${variant.name} completed`);

            // Master playlist에 추가
            const bandwidth = parseInt(variant.bitrate) * 1000 + 128000; // video + audio
            const resolution = await getActualResolution(variantDir);

            masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution},CODECS="avc1.64001f,mp4a.40.2"\n`;
            masterContent += `${variant.name}/playlist.m3u8\n`;
        }

        // Master playlist 저장
        await fs.writeFile(masterPlaylist, masterContent);

        console.log("Adaptive HLS (fMP4) conversion completed");

        return {
            success: true,
            masterPlaylistUrl: masterPlaylist.replace(
                path.join(__dirname, "../../"),
                "/"
            ),
            variants: variants.map((v) => ({
                name: v.name,
                height: v.height,
                bitrate: v.bitrate,
            })),
            format: "fmp4",
        };
    } catch (error) {
        console.error("Adaptive HLS conversion failed:", error);
        throw new Error(`Adaptive HLS conversion failed: ${error.message}`);
    }
};

// 실제 출력된 해상도 확인
const getActualResolution = async (variantDir) => {
    try {
        const files = await fs.readdir(variantDir);
        const firstSegment = files.find((f) => f.endsWith(".m4s"));

        if (firstSegment) {
            const segmentPath = path.join(variantDir, firstSegment);
            const info = await getVideoInfo(segmentPath);
            return `${info.width}x${info.height}`;
        }

        return "1280x720"; // fallback
    } catch (error) {
        console.log("Could not get actual resolution, using fallback");
        return "1280x720"; // fallback
    }
};

/**
 * 단순 변환 (재인코딩 없이 빠른 변환)
 * 원본이 이미 H.264/AAC라면 이 방법 사용
 */
const convertToHLSFast = async (inputPath, outputDir, outputName) => {
    try {
        await fs.mkdir(outputDir, { recursive: true });

        const playlistPath = path.join(outputDir, `${outputName}.m3u8`);
        const segmentPattern = path.join(outputDir, `${outputName}_%03d.m4s`);

        // 코덱 복사로 빠른 변환
        const ffmpegCommand = `ffmpeg -i "${inputPath}" \
        -c copy \
        -f hls \
        -hls_time 6 \
        -hls_segment_type fmp4 \
        -hls_fmp4_init_filename "init.mp4" \
        -hls_segment_filename "${segmentPattern}" \
        -hls_list_size 0 \
        -hls_flags independent_segments \
        -movflags +faststart \
        "${playlistPath}"`;

        console.log("Fast HLS conversion (no re-encoding)...");
        await execPromise(ffmpegCommand);
        console.log("Fast conversion completed");

        const files = await fs.readdir(outputDir);
        const segments = files.filter((f) => f.endsWith(".m4s"));

        return {
            success: true,
            playlistUrl: playlistPath.replace(
                path.join(__dirname, "../../"),
                "/"
            ),
            segmentCount: segments.length,
            format: "fmp4",
            encoded: false,
        };
    } catch (error) {
        console.error(
            "Fast conversion failed, falling back to normal conversion"
        );
        // 실패하면 일반 변환으로 fallback
        return await convertToHLS(inputPath, outputDir, outputName);
    }
};

module.exports = {
    convertToHLS,
    convertToHLSFast,
    getVideoInfo,
    generateThumbnail,
    convertToAdaptiveHLS,
};
