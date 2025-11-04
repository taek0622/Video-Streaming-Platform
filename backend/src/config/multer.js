const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

// 업로드 디렉토리 확인 및 생성
const ensureDirectoryExists = (directory) => {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
};

// 영상 파일 저장 설정
const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, "../../uploads/videos");
        ensureDirectoryExists(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // 원본 확장자 유지
        const ext = path.extname(file.originalname);
        const uniqueName = `${uuidv4()}${ext}`;
        cb(null, uniqueName);
    },
});

// 썸네일 저장 설정
const thumbnailStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, "../../uploads/thumbnails");
        ensureDirectoryExists(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uniqueName = `${uuidv4()}${ext}`;
        cb(null, uniqueName);
    },
});

// 영상 파일 필터 (확장자 검증)
const videoFilter = (req, file, cb) => {
    const allowedExtensions = /mp4|avi|mov|mkv|webm|flv/;
    const extname = allowedExtensions.test(
        path.extname(file.originalname).toLowerCase()
    );
    const mimetype =
        file.mimetype.startsWith("video/") ||
        file.mimetype === "application/octet-stream";

    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(
            new Error(
                "Only video files are allowed (mp4, avi, mov, mkv, webm, flv)"
            )
        );
    }
};

// 썸네일 파일 필터 (이미지만)
const thumbnailFilter = (req, file, cb) => {
    const allowedExtensions = /jpg|jpeg|png|webp/;
    const extname = allowedExtensions.test(
        path.extname(file.originalname).toLowerCase()
    );
    const mimetype =
        file.mimetype.startsWith("image/") ||
        file.mimetype === "aplication/octet-stream";

    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error("Only image files are allowed (jpg, jpeg, png, webp)"));
    }
};

// 영상 업로드 미들웨어
const uploadVideo = multer({
    storage: videoStorage,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB
    },
    fileFilter: videoFilter,
}).single("video"); // 필드명: 'video'

// 썸네일 업로드 미들웨어
const uploadThumbnail = multer({
    storage: thumbnailStorage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: thumbnailFilter,
}).single("thumbnail"); // 필드명: 'thumbnail'

// 영상 + 썸네일 동시 업로드
const uploadVideoWithThumbnail = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            let uploadPath;
            if (file.fieldname === "video") {
                uploadPath = path.join(__dirname, "../../uploads/videos");
            } else if (file.fieldname === "thumbnail") {
                uploadPath = path.join(__dirname, "../../uploads/thumbnails");
            }
            ensureDirectoryExists(uploadPath);
            cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            const uniqueName = `${uuidv4()}${ext}`;
            cb(null, uniqueName);
        },
    }),
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB
    },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === "video") {
            videoFilter(req, file, cb);
        } else if (file.fieldname === "thumbnail") {
            thumbnailFilter(req, file, cb);
        } else {
            cb(new Error("Unexpected field"));
        }
    },
}).fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
]);

module.exports = {
    uploadVideo,
    uploadThumbnail,
    uploadVideoWithThumbnail,
};
