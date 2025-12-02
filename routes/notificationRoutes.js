const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const notificationService = require('../services/notificationService');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { read, type, limit, offset } = req.query;
        const filters = {
            read: read === 'true' ? true : read === 'false' ? false : undefined,
            type,
            limit: limit ? parseInt(limit) : 50,
            offset: offset ? parseInt(offset) : 0
        };

        const result = await notificationService.getNotifications(req.user.id, filters);
        res.json(result);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Failed to fetch notifications' });
    }
});

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
router.get('/unread-count', protect, async (req, res) => {
    try {
        const count = await notificationService.getUnreadCount(req.user.id);
        res.json({ count });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ message: 'Failed to get unread count' });
    }
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
router.put('/:id/read', protect, async (req, res) => {
    try {
        const notification = await notificationService.markAsRead(req.params.id);
        res.json(notification);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(404).json({ message: 'Notification not found' });
    }
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
router.put('/read-all', protect, async (req, res) => {
    try {
        const result = await notificationService.markAllAsRead(req.user.id);
        res.json({ message: 'All notifications marked as read', count: result.count });
    } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({ message: 'Failed to mark all as read' });
    }
});

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        await notificationService.deleteNotification(req.params.id);
        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(404).json({ message: 'Notification not found' });
    }
});

module.exports = router;
