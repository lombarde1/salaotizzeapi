const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true
    },
    type: {
        type: String,
        enum: ['appointment', 'cancellation', 'reminder', 'system', 'financial', 'commission_available'],
        required: [true, 'Notification type is required']
    },
    relatedTo: {
        model: {
            type: String,
            required: [true, 'Related model is required']
        },
        id: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, 'Related ID is required']
        }
    },
    isRead: {
        type: Boolean,
        default: false
    },
    expiresAt: {
        type: Date,
        validate: {
            validator: function(value) {
                return !value || value > new Date();
            },
            message: 'Expiration date must be in the future'
        }
    }
}, {
    timestamps: true
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;