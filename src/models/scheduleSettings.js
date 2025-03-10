const mongoose = require('mongoose');

const workingHoursSchema = new mongoose.Schema({
    dayOfWeek: {
        type: Number,
        required: true,
        min: 0,
        max: 6
    },
    startTime: {
        type: String,
        required: true,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    endTime: {
        type: String,
        required: true,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    isWorking: {
        type: Boolean,
        default: true
    }
});

const breakSchema = new mongoose.Schema({
    dayOfWeek: {
        type: Number,
        required: true,
        min: 0,
        max: 6
    },
    startTime: {
        type: String,
        required: true,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    endTime: {
        type: String,
        required: true,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    description: {
        type: String,
        trim: true
    }
});

const scheduleSettingsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    professionalId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Professional'
    },
    workingHours: [workingHoursSchema],
    breaks: [breakSchema],
    slotDuration: {
        type: Number,
        required: true,
        min: 15,
        default: 30
    },
    timeOffDates: [{
        type: Date
    }]
}, {
    timestamps: true
});

// Validate working hours
scheduleSettingsSchema.pre('save', function(next) {
    // Validate time format and range
    const validateTime = (time) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
    };

    // Validate working hours
    for (const hours of this.workingHours) {
        if (!validateTime(hours.startTime) || !validateTime(hours.endTime)) {
            next(new Error('Invalid time format'));
            return;
        }

        const start = hours.startTime.split(':').map(Number);
        const end = hours.endTime.split(':').map(Number);
        if (start[0] > end[0] || (start[0] === end[0] && start[1] >= end[1])) {
            next(new Error('End time must be after start time'));
            return;
        }
    }

    // Validate breaks
    for (const breakTime of this.breaks) {
        if (!validateTime(breakTime.startTime) || !validateTime(breakTime.endTime)) {
            next(new Error('Invalid break time format'));
            return;
        }

        const start = breakTime.startTime.split(':').map(Number);
        const end = breakTime.endTime.split(':').map(Number);
        if (start[0] > end[0] || (start[0] === end[0] && start[1] >= end[1])) {
            next(new Error('Break end time must be after start time'));
            return;
        }
    }

    next();
});

const ScheduleSettings = mongoose.model('ScheduleSettings', scheduleSettingsSchema);

module.exports = ScheduleSettings;