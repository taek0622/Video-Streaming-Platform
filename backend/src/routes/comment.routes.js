const express = require("express");
const router = express.Router();
const commentController = require("../controllers/comment.controller");
const { requireAuth } = require("../middleware/auth.middleware");

// 특정 영상의 댓글 목록 (비로그인 가능)
router.get("/videos/:videoId/comments", commentController.getComments);

// 댓글 작성 (로그인 필수)
router.post(
    "/videos/:videoId/comments",
    requireAuth,
    commentController.createComment
);

// 특정 댓글 조회 (비로그인 가능)
router.get("/comments/:id", commentController.getComment);

// 댓글 수정 (로그인 필수, 본인만)
router.put("/comments/:id", requireAuth, commentController.updateComment);

// 댓글 삭제 (로그인 필수, 본인만)
router.delete("/comments/:id", requireAuth, commentController.deleteComment);

module.exports = router;
