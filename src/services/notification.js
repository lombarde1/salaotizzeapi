const Notification = require('../models/notification');
const Professional = require('../models/professional');

/**
 * Gets the effective user ID (handles parent-child relationship)
 * @param {string} userId - Original user ID
 * @returns {Promise<string>} Effective user ID
 */
const getEffectiveUserId = async (userId) => {
    try {
        const professional = await Professional.findOne({ userAccountId: userId });
        return professional ? professional.userId : userId;
    } catch (error) {
        return userId;
    }
};

/**
 * Creates a new notification
 * @param {Object} data - Notification data
 * @returns {Promise<Notification>} Created notification
 */
const createNotification = async (data) => {
    try {
        let notifications = [];

        if (data.type === 'commission_available') {
            // For commission notifications, send directly to the professional's account
            notifications.push(new Notification({
                ...data,
                userId: data.userId
            }));

            // Find the professional to get the parent account info
            const professional = await Professional.findOne({ userAccountId: data.userId });
            if (professional && professional.userId) {
                // Send a different notification to the parent account
                notifications.push(new Notification({
                    userId: professional.userId,
                    title: 'Comissão Paga',
                    message: `Comissão paga para o profissional ${professional.name}`,
                    type: 'system',
                    relatedTo: data.relatedTo
                }));
            }
        } else {
            // For other notifications, use the effective user ID
            const effectiveUserId = await getEffectiveUserId(data.userId);
            notifications.push(new Notification({
                ...data,
                userId: effectiveUserId
            }));
        }

        // Save all notifications
        const savedNotifications = await Promise.all(notifications.map(n => n.save()));
        return savedNotifications[0]; // Return the primary notification
    } catch (error) {
        throw new Error(`Error creating notification: ${error.message}`);
    }
};

/**
 * Gets notifications for a user
 * @param {string} userId - User ID
 * @param {Object} options - Filter options
 * @returns {Promise<Array<Notification>>} List of notifications
 */
const getNotifications = async (userId, options = {}) => {
    try {
        const effectiveUserId = await getEffectiveUserId(userId);
        const query = { userId: effectiveUserId };
        const { unreadOnly, type, limit = 10 } = options;

        if (unreadOnly) {
            query.isRead = false;
        }

        if (type) {
            query.type = type;
        }

        const notifications = await Notification
            .find(query)
            .sort({ createdAt: -1 })
            .limit(limit);

        return notifications;
    } catch (error) {
        throw new Error(`Error fetching notifications: ${error.message}`);
    }
};

/**
 * Marks a notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID
 * @returns {Promise<Boolean>} Operation success
 */
const markAsRead = async (notificationId, userId) => {
    try {
        const effectiveUserId = await getEffectiveUserId(userId);
        const result = await Notification.updateOne(
            { _id: notificationId, userId: effectiveUserId },
            { $set: { isRead: true } }
        );
        return result.modifiedCount > 0;
    } catch (error) {
        throw new Error(`Error marking notification as read: ${error.message}`);
    }
};

/**
 * Marks all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<Boolean>} Operation success
 */
const markAllAsRead = async (userId) => {
    try {
        const effectiveUserId = await getEffectiveUserId(userId);
        const result = await Notification.updateMany(
            { userId: effectiveUserId, isRead: false },
            { $set: { isRead: true } }
        );
        return result.modifiedCount > 0;
    } catch (error) {
        throw new Error(`Error marking all notifications as read: ${error.message}`);
    }
};

/**
 * Gets unread notifications count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Unread notifications count
 */
const getUnreadCount = async (userId) => {
    try {
        const effectiveUserId = await getEffectiveUserId(userId);
        return await Notification.countDocuments({ userId: effectiveUserId, isRead: false });
    } catch (error) {
        throw new Error(`Error counting unread notifications: ${error.message}`);
    }
};

/**
 * Removes expired notifications
 * @returns {Promise<void>}
 */
const removeExpiredNotifications = async () => {
    try {
        await Notification.deleteMany({
            expiresAt: { $lt: new Date() }
        });
    } catch (error) {
        throw new Error(`Error removing expired notifications: ${error.message}`);
    }
};

/**
 * Cleans up old read notifications
 * @param {number} days - Days threshold
 * @returns {Promise<void>}
 */
const cleanOldNotifications = async (days = 30) => {
    try {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - days);

        await Notification.deleteMany({
            isRead: true,
            createdAt: { $lt: threshold }
        });
    } catch (error) {
        throw new Error(`Error cleaning old notifications: ${error.message}`);
    }
};

module.exports = {
    createNotification,
    getNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    removeExpiredNotifications,
    cleanOldNotifications
};