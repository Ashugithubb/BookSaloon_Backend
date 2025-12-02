const notificationService = require('../services/notificationService');

/**
 * Initialize Socket.IO with connected users
 */
const connectedUsers = new Map(); // userId -> socketId

const initializeSocket = (io) => {
    io.on('connection', (socket) => {
        console.log('🔌 New socket connection:', socket.id);

        // User authentication - join user-specific room
        socket.on('authenticate', (userId) => {
            if (userId) {
                socket.join(`user:${userId}`);
                connectedUsers.set(userId, socket.id);
                console.log(`✅ User ${userId} authenticated and joined room`);

                // Send unread count on connection
                notificationService.getUnreadCount(userId)
                    .then(count => {
                        socket.emit('unread_count', count);
                    })
                    .catch(err => console.error('Error getting unread count:', err));
            }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            // Remove user from connected users
            for (const [userId, socketId] of connectedUsers.entries()) {
                if (socketId === socket.id) {
                    connectedUsers.delete(userId);
                    console.log(`❌ User ${userId} disconnected`);
                    break;
                }
            }
        });
    });
};

/**
 * Emit notification to a specific user
 */
const emitNotification = (io, userId, notification) => {
    const roomName = `user:${userId}`;
    console.log(`📡 [emitNotification] Emitting to room: ${roomName}`);
    console.log(`📡 [emitNotification] Connected users:`, Array.from(connectedUsers.keys()));
    io.to(roomName).emit('new_notification', notification);
    console.log(`📨 Notification sent to user ${userId}:`, notification.title);
};

/**
 * Emit unread count update to a user
 */
const emitUnreadCount = (io, userId, count) => {
    io.to(`user:${userId}`).emit('unread_count', count);
};

module.exports = {
    initializeSocket,
    emitNotification,
    emitUnreadCount,
    connectedUsers
};
