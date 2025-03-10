const Appointment = require('../models/appointment');
const ScheduleSettings = require('../models/scheduleSettings');
const Service = require('../models/service');
const Professional = require('../models/professional');
const Client = require('../models/client');
const notificationService = require('../services/notification');

// Helper function to check availability
const checkAvailability = async (professionalId, date, duration) => {
    // Get professional's schedule settings
    const settings = await ScheduleSettings.findOne({ professionalId });
    if (!settings) {
        throw new Error('Professional schedule not configured');
    }

    const appointmentDate = new Date(date);
    const dayOfWeek = appointmentDate.getDay();
    const timeString = appointmentDate.toTimeString().slice(0, 5);

    // Check working hours
    const workingHours = settings.workingHours.find(h => h.dayOfWeek === dayOfWeek && h.isWorking);
    if (!workingHours) {
        throw new Error('Professional not working on this day');
    }

    if (timeString < workingHours.startTime || timeString > workingHours.endTime) {
        throw new Error('Time outside working hours');
    }

    // Check breaks
    const isInBreak = settings.breaks.some(b => {
        return b.dayOfWeek === dayOfWeek &&
               timeString >= b.startTime &&
               timeString <= b.endTime;
    });

    if (isInBreak) {
        throw new Error('Time conflicts with break time');
    }

    // Check time off dates
    const isTimeOff = settings.timeOffDates.some(d => {
        const offDate = new Date(d);
        return offDate.toDateString() === appointmentDate.toDateString();
    });

    if (isTimeOff) {
        throw new Error('Professional is off on this date');
    }

    // Check existing appointments
    const endTime = new Date(appointmentDate.getTime() + duration * 60000);
    const conflictingAppointment = await Appointment.findOne({
        professionalId,
        date: { $lt: endTime },
        $or: [
            { status: 'scheduled' },
            { status: 'confirmed' }
        ],
        $expr: {
            $gt: [
                { $add: ['$date', { $multiply: ['$duration', 60000] }] },
                appointmentDate.getTime()
            ]
        }
    });

    if (conflictingAppointment) {
        throw new Error('Time slot conflicts with existing appointment');
    }

    return true;
};

// Create new appointment
exports.createAppointment = async (req, res) => {
    try {
        const { clientId, professionalId, serviceId, date, notes } = req.body;

        // Validate entities exist
        const [client, professional, service] = await Promise.all([
            Client.findById(clientId),
            Professional.findById(professionalId),
            Service.findById(serviceId)
        ]);

        if (!client || !professional || !service) {
            return res.status(404).json({
                status: 'error',
                message: 'Client, professional or service not found'
            });
        }

        // Check if professional provides the service
        if (!professional.services.includes(serviceId)) {
            return res.status(400).json({
                status: 'error',
                message: 'Professional does not provide this service'
            });
        }

        // Create appointment
        const appointment = new Appointment({
            clientId,
            professionalId,
            serviceId,
            date,
            notes,
            duration: service.duration,
            status: 'scheduled'
        });

        await appointment.save();

        // Create notification for new appointment
        const formattedDate = new Date(date).toLocaleString();
        await notificationService.createNotification({
            userId: professional.userAccountId || professional._id,
            title: "Novo agendamento",
            message: `Agendamento com ${client.name} para ${formattedDate}`,
            type: "appointment",
            relatedTo: {
                model: "Appointment",
                id: appointment._id
            }
        });

        res.status(201).json({
            status: 'success',
            data: { appointment }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Cancel appointment
exports.cancelAppointment = async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id)
            .populate('clientId')
            .populate('professionalId');

        if (!appointment) {
            return res.status(404).json({
                status: 'error',
                message: 'Appointment not found'
            });
        }

        appointment.status = 'cancelled';
        await appointment.save();

        // Create notification for cancelled appointment
        const formattedDate = appointment.date.toLocaleString();
        await notificationService.createNotification({
            userId: appointment.professionalId.userAccountId || appointment.professionalId._id,
            title: "Agendamento cancelado",
            message: `Agendamento com ${appointment.clientId.name} para ${formattedDate} foi cancelado`,
            type: "appointment_cancelled",
            relatedTo: {
                model: "Appointment",
                id: appointment._id
            }
        });

        res.status(200).json({
            status: 'success',
            data: { appointment }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Confirm appointment
exports.confirmAppointment = async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id)
            .populate('clientId')
            .populate('professionalId');

        if (!appointment) {
            return res.status(404).json({
                status: 'error',
                message: 'Appointment not found'
            });
        }

        appointment.status = 'confirmed';
        await appointment.save();

        // Create notification for confirmed appointment
        const formattedDate = appointment.date.toLocaleString();
        await notificationService.createNotification({
            userId: appointment.professionalId.userAccountId || appointment.professionalId._id,
            title: "Agendamento confirmado",
            message: `Agendamento com ${appointment.clientId.name} para ${formattedDate} foi confirmado`,
            type: "appointment_confirmed",
            relatedTo: {
                model: "Appointment",
                id: appointment._id
            }
        });

        res.status(200).json({
            status: 'success',
            data: { appointment }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Get appointments with filters
exports.getAppointments = async (req, res) => {
    try {
        const query = { userId: req.user._id };
        const { status, startDate, endDate, clientId, professionalId } = req.query;

        if (status) query.status = status;
        if (clientId) query.clientId = clientId;
        if (professionalId) query.professionalId = professionalId;
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        const appointments = await Appointment.find(query)
            .populate('clientId', 'name phone email')
            .populate('professionalId', 'name')
            .populate('serviceId', 'name duration price')
            .sort({ date: 1 });

        res.json({
            status: 'success',
            data: { appointments }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Update appointment status
exports.updateAppointmentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const appointment = await Appointment.findOne({
            _id: id,
            userId: req.user._id
        });

        if (!appointment) {
            return res.status(404).json({
                status: 'error',
                message: 'Appointment not found'
            });
        }

        if (!appointment.canTransitionTo(status)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid status transition'
            });
        }

        appointment.status = status;
        await appointment.save();

        res.json({
            status: 'success',
            data: { appointment }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Get available time slots
exports.getAvailableSlots = async (req, res) => {
    try {
        const { professionalId, date, serviceId } = req.query;

        const settings = await ScheduleSettings.findOne({ professionalId });
        if (!settings) {
            return res.status(404).json({
                status: 'error',
                message: 'Professional schedule not configured'
            });
        }

        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({
                status: 'error',
                message: 'Service not found'
            });
        }

        const queryDate = new Date(date);
        const dayOfWeek = queryDate.getDay();

        // Get working hours for the day
        const workingHours = settings.workingHours.find(h => h.dayOfWeek === dayOfWeek && h.isWorking);
        if (!workingHours) {
            return res.json({
                status: 'success',
                data: { slots: [] }
            });
        }

        // Generate all possible slots
        const slots = [];
        const [startHour, startMinute] = workingHours.startTime.split(':').map(Number);
        const [endHour, endMinute] = workingHours.endTime.split(':').map(Number);

        queryDate.setHours(startHour, startMinute, 0, 0);
        const endTime = new Date(queryDate);
        endTime.setHours(endHour, endMinute, 0, 0);

        while (queryDate < endTime) {
            try {
                await checkAvailability(professionalId, queryDate, service.duration);
                slots.push(new Date(queryDate));
            } catch (error) {
                // Slot not available, skip
            }
            queryDate.setMinutes(queryDate.getMinutes() + settings.slotDuration);
        }

        res.json({
            status: 'success',
            data: { slots }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};