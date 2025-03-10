const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const notificationController = require('../controllers/notification');

const router = express.Router();

// Validation middleware
const validateNotification = [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
    body('type').isIn(['appointment', 'cancellation', 'reminder', 'system', 'financial'])
        .withMessage('Invalid notification type'),
    body('relatedTo.model').trim().notEmpty().withMessage('Related model is required'),
    body('relatedTo.id').notEmpty().withMessage('Related ID is required'),
    body('expiresAt').optional().isISO8601().withMessage('Invalid expiration date')
];

// Create new notification
router.post('/', auth, validateNotification, notificationController.createNotification);

// Get notifications with filters
router.get('/', auth, notificationController.getNotifications);

// Mark notification as read
router.put('/:id/read', auth, notificationController.markAsRead);

// Mark all notifications as read
router.put('/read-all', auth, notificationController.markAllAsRead);

// Get unread notifications count
router.get('/unread-count', auth, notificationController.getUnreadCount);

module.exports = router;