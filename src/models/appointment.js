const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Client'
    },
    professionalId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Professional'
    },
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Service'
    },
    date: {
        type: Date,
        required: true
    },
    duration: {
        type: Number,
        required: true,
        min: 1
    },
    status: {
        type: String,
        required: true,
        enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'],
        default: 'scheduled'
    },
    notes: {
        type: String,
        trim: true
    },
    reminderSent: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Middleware to validate date is not in the past
appointmentSchema.pre('save', function(next) {
    if (this.isModified('date')) {
        const now = new Date();
        if (this.date < now) {
            next(new Error('Appointment date cannot be in the past'));
            return;
        }
    }
    next();
});

// Method to check if status transition is valid
appointmentSchema.methods.canTransitionTo = function(newStatus) {
    const validTransitions = {
        'scheduled': ['confirmed', 'cancelled'],
        'confirmed': ['completed', 'cancelled', 'no_show'],
        'completed': [],
        'cancelled': [],
        'no_show': []
    };

    return validTransitions[this.status].includes(newStatus);
};

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;