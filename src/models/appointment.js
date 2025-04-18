const mongoose = require('mongoose');
const Professional = require('./professional');

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
    },
    sendReminder: {
        type: Boolean,
        default: true
    },
    // Novos campos
    color: {
        type: String,
        enum: ['default', 'blue', 'green', 'red', 'purple', 'yellow', 'orange'],
        default: 'default'
    },
    isOverride: {
        type: Boolean,
        default: false,
        description: "Indica se o agendamento foi encaixado em um horário já ocupado"
    },
    // Suporte para agendamentos recorrentes
    recurrence: {
        isRecurring: {
            type: Boolean,
            default: false
        },
        pattern: {
            type: String,
            enum: ['daily', 'weekly', 'monthly', 'custom'],
            default: 'weekly'
        },
        interval: {
            type: Number,
            default: 1,
            min: 1
        },
        endDate: {
            type: Date
        },
        occurrences: {
            type: Number,
            min: 1
        },
        parentAppointmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Appointment'
        }
    }
}, {
    timestamps: true
});

// Middleware to validate date is not in the past
appointmentSchema.pre('save', function(next) {
    if (this.isModified('date')) {
        const now = new Date();
        if (this.date < now && !this.isOverride) {
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

// Helper function to convert day index to day name
const getDayName = (dayIndex) => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[dayIndex];
};

// Método para verificar se um horário está fora do expediente do profissional
appointmentSchema.statics.isOutsideWorkingHours = async function(professionalId, date) {
    const professional = await Professional.findById(professionalId);
    if (!professional || !professional.workingHours) return true;
    
    const appointmentDate = new Date(date);
    const dayOfWeek = appointmentDate.getDay();
    const dayName = getDayName(dayOfWeek);
    
    // Extract hours and minutes
    const hours = appointmentDate.getHours().toString().padStart(2, '0');
    const minutes = appointmentDate.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;
    
    // Check if professional works on this day
    if (!professional.workingHours[dayName] || 
        !professional.workingHours[dayName].start || 
        !professional.workingHours[dayName].end) {
        return true;
    }
    
    // Check working hours
    const startTime = professional.workingHours[dayName].start;
    const endTime = professional.workingHours[dayName].end;
    
    if (timeString < startTime || timeString > endTime) {
        return true;
    }
    
    return false;
};

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;