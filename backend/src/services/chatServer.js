const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const { User } = require("../models");

let wss = null;

// videoId별 접속자 관리
const rooms = new Map(); // videoID -> Set of clients

/**
 * WebSocket 서버 초기화
 */
const initChatServer = (httpServer) => {
    wss = new WebSocket.Server({
        server: httpServer,
        path: "/chat", // ws://localhost:3000/chat
    });

    wss.on("connection", (ws, req) => {
        console.log("WebSocket connected from:", req.socket.remoteAddress);

        let currentUser = null;
        let currentVideoId = null;

        // 메시지 수신
        ws.on("message", async (data) => {
            try {
                const message = JSON.parse(data.toString());

                switch (message.type) {
                    case "join":
                        await handleJoin(ws, message);
                        break;
                    case "message":
                        await handleMessage(ws, message);
                        break;
                    case "leave":
                        handleLeave(ws);
                        break;
                    default:
                        sendError(ws, "Unknown message type");
                }
            } catch (error) {
                console.error("Message parse error:", error);
                sendError(ws, "Invalid message format");
            }
        });

        // 방 입장 처리
        async function handleJoin(ws, message) {
            try {
                const { token, videoId } = message;

                console.log(`Join request: videoId=${videoId}`);

                // JWT 토큰 검증
                if (!token) {
                    sendError(ws, "Authentication required");
                    return;
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findByOk(decoded.id);

                if (!user) {
                    sendError(ws, "User not found");
                    return;
                }

                currentUser = {
                    id: user.id,
                    username: user.username,
                    profileImage: user.profileImage,
                };
                currentVideoId = videoId;

                // ws 객체에 정보 저장
                ws.videoId = videoId;
                ws.userId = user.id;
                ws.username = user.username;

                // 방 참가자 관리
                if (!rooms.has(videoId)) {
                    rooms.set(videoId, new Set());
                }
                rooms.get(videoId).add(ws);

                console.log(`${user.username} joined video ${videoId}`);
                console.log(
                    `Current viewers in video ${videoId}: ${
                        rooms.get(videoId).size
                    }`
                );

                // 입장 알림 (방 전체)
                broadcastToRoom(videoId, {
                    type: "system",
                    action: "join",
                    message: `${user.username} joined the chat`,
                    username: user.username,
                    timestamp: new Date().toISOString(),
                    viewerCount: rooms.get(videoId).size,
                });

                // 본인에게 입장 성공 알림
                send(ws, {
                    type: "joined",
                    success: true,
                    videoId,
                    user: currentUser,
                    viewerCount: rooms.get(videoId).size,
                });
            } catch (error) {
                console.error("Join error:", error);
                sendError(ws, "Failed to join chat");
            }
        }

        // 메시지 전송 처리
        async function handleMessage(ws, message) {
            try {
                if (!currentUser || !currentVideoId) {
                    sendError(ws, "Not joined to any room");
                    return;
                }

                const { content } = message;

                if (!content || content.trim().length === 0) {
                    sendError(ws, "Message cannot be empty");
                    return;
                }

                if (content.length > 500) {
                    sendError(ws, "Message too long (max 500 characters)");
                    return;
                }

                const chatMessage = {
                    type: "message",
                    userId: currentUser.id,
                    username: currentUser.username,
                    profileImage: currentUser.profileImage,
                    content: content.trim(),
                    timestamp: new Date().toISOString(),
                };

                console.log(
                    `Message from ${
                        currentUser.username
                    } in video ${currentVideoID}: ${content.substring(0, 50)}`
                );

                // 같은 방의 모든 사용자에게 브로드캐스트
                broadcastToRoom(currentVideoId, chatMessage);
            } catch (error) {
                console.error("Message error:", error);
                sendErroe(ws, "Failed to send message");
            }
        }

        // 방 퇴장 처리
        function handleLeave(ws) {
            if (currentVideoId & rooms.has(currentVideoId)) {
                rooms.get(currentVideoId).delete(ws);

                if (currentUser) {
                    console.log(
                        `${currentUser.username} left video ${currentVideoId}`
                    );
                    console.log(
                        `Remaining viewers: ${rooms.get(currentVideoId).size}`
                    );

                    // 퇴장 알림
                    broadcastToRoom(currentVideoId, {
                        type: "system",
                        action: "leave",
                        message: `${currentUser.username} left the chat`,
                        username: currentUser.username,
                        timestamp: new Date().toISOString(),
                        viewerCount: rooms.get(currentVideoId).size,
                    });
                }

                // 방이 비었으면 삭제
                if (rooms.get(currentVideoId).size === 0) {
                    rooms.delete(currentVideoId);
                    console.log(`Room ${currentVideoId} deleted (empty)`);
                }
            }
        }

        // 연결 해제
        ws.on("close", () => {
            console.log("WebSocket disconnected");
            handleLeave(ws);
        });

        // 에러 처리
        ws.on("error", (error) => {
            console.error("WebSocket error:", error);
        });
    });

    console.log("");
    console.log("=".repeat(80));
    console.log("WebSocket Chat Server Started");
    console.log("=".repeat(80));
    console.log("Path: /chat");
    console.log("=".repeat(80));
    console.log("");

    return wss;
};

/**
 * 특정 방에 메시지 브로드캐스트
 */
function broadcastToRoom(videoId, message) {
    if (!rooms.has(videoId)) return;

    const data = JSON.stringify(message);
    const clients = rooms.get(videoId);

    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

/**
 * 특정 클라이언트에게 메시지 전송
 */
function send(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

/**
 * 에러 메시지 전송
 */
function sendError(ws, message) {
    send(ws, {
        type: "error",
        message,
        timestamp: new Date().toISOString(),
    });
}

/**
 * 현재 시청자 수 조회
 */
const getViewerCount = (videoId) => {
    return rooms.has(videoId) ? rooms.get(videoId).size : 0;
};

/**
 * 특정 방에 시스템 메시지 전송 (서버에서 직접)
 */
const sendSystemMessage = (videoId, message) => {
    broadcastToRoom(videoId, {
        type: "system",
        action: "notification",
        message,
        timestamp: new Date().toISOString(),
    });
};

module.exports = {
    initChatServer,
    getViewerCount,
    sendSystemMessage,
};
