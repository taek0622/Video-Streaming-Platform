const models = require("../models");
const bcrypt = require("bcryptjs");

const seedTestData = async () => {
    try {
        console.log("Seeding test data...");

        // 테스트 사용자 생성
        const hashedPassword = await bcrypt.hash("test1234", 10);

        const testUser = await models.User.create({
            username: "testuser",
            email: "test@example.com",
            passwordHash: hashedPassword,
            fullName: "Test User",
        });

        console.log("Test user created:", testUser.username);

        // 테스트 영상 생성
        const testVideo = await models.Video.create({
            title: "Test Video",
            description: "This is a test video",
            uploaderId: testUser.id,
            videoUrl: "/uploads/videos/test.mp4",
        });

        console.log("Test video created:", testVideo.title);

        // 테스트 댓글 생성
        const testComment = await models.Comment.create({
            videoId: testVideo.id,
            userId: testUser.id,
            content: "This is a test comment!",
        });

        console.log("Test comment created");

        console.log("Seeding completed!");
    } catch (error) {
        console.error("Seeding failed:", error);
    }
};

module.exports = { seedTestData };
