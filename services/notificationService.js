const prisma = require('../lib/prisma');

/**
 * Create a new notification
 */
const createNotification = async (userId, type, title, message, data = null) => {
    try {
        const notification = await prisma.notification.create({
            data: {
                userId,
                type,
                title,
                message,
                data,
                read: false
            }
        });
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

/**
 * Get notifications for a user
 */
const getNotifications = async (userId, filters = {}) => {
    try {
        const { read, type, limit = 50, offset = 0 } = filters;

        const where = { userId };
        if (read !== undefined) where.read = read;
        if (type) where.type = type;

        const notifications = await prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset
        });

        const total = await prisma.notification.count({ where });

        return { notifications, total };
    } catch (error) {
        console.error('Error fetching notifications:', error);
        throw error;
    }
};

/**
 * Get unread notification count
 */
const getUnreadCount = async (userId) => {
    try {
        const count = await prisma.notification.count({
            where: {
                userId,
                read: false
            }
        });
        return count;
    } catch (error) {
        console.error('Error getting unread count:', error);
        throw error;
    }
};

/**
 * Mark notification as read
 */
const markAsRead = async (notificationId) => {
    try {
        const notification = await prisma.notification.update({
            where: { id: notificationId },
            data: { read: true }
        });
        return notification;
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
};

/**
 * Mark all notifications as read for a user
 */
const markAllAsRead = async (userId) => {
    try {
        const result = await prisma.notification.updateMany({
            where: {
                userId,
                read: false
            },
            data: { read: true }
        });
        return result;
    } catch (error) {
        console.error('Error marking all as read:', error);
        throw error;
    }
};

/**
 * Delete a notification
 */
const deleteNotification = async (notificationId) => {
    try {
        await prisma.notification.delete({
            where: { id: notificationId }
        });
        return true;
    } catch (error) {
        console.error('Error deleting notification:', error);
        throw error;
    }
};

module.exports = {
    createNotification,
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
};
