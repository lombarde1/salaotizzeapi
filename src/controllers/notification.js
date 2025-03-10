const { validationResult } = require('express-validator');
const notificationService = require('../services/notification');

// Create new notification
const createNotification = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                status: 'error',
                errors: errors.array()
            });
        }

        const notification = await notificationService.createNotification(req.body);
        res.status(201).json({
            status: 'success',
            data: { notification }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

// Get notifications for current user
const getNotifications = async (req, res) => {
    try {
        const { unreadOnly, type, limit } = req.query;
        const userId = req.user._id;

        const notifications = await notificationService.getNotifications(userId, {
            unreadOnly: unreadOnly === 'true',
            type,
            limit: parseInt(limit) || 10
        });

        res.json({
            status: 'success',
            data: { notifications }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

// Mark notification as read
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const success = await notificationService.markAsRead(id, userId);
        if (!success) {
            return res.status(404).json({
                status: 'error',
                message: 'Notification not found or already read'
            });
        }

        res.json({
            status: 'success',
            message: 'Notification marked as read'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user._id;
        await notificationService.markAllAsRead(userId);

        res.json({
            status: 'success',
            message: 'All notifications marked as read'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

// Get unread notifications count
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user._id;
        const count = await notificationService.getUnreadCount(userId);

        res.json({
            status: 'success',
            data: { count }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

module.exports = {
    createNotification,
    getNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount
};