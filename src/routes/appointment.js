const express = require('express');
const { body, query, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const checkAppointmentPermissions = require('../middleware/checkAppointmentPermissions');
const appointmentController = require('../controllers/appointment');

const router = express.Router();

// Validation middleware
const validateAppointment = [
    body('clientId').notEmpty().withMessage('Client ID is required'),
    body('professionalId').notEmpty().withMessage('Professional ID is required'),
    body('serviceId').notEmpty().withMessage('Service ID is required'),
    body('date').isISO8601().toDate().withMessage('Valid date is required'),
    body('notes').optional().trim(),
    body('color').optional().isIn(['default', 'blue', 'green', 'red', 'purple', 'yellow', 'orange']).withMessage('Invalid color'),
    body('sendReminder').optional().isBoolean().withMessage('sendReminder must be a boolean'),
    body('isOverride').optional().isBoolean().withMessage('isOverride must be a boolean'),
    body('recurrence').optional().isObject().withMessage('Recurrence must be an object'),
    body('recurrence.isRecurring').optional().isBoolean().withMessage('isRecurring must be a boolean'),
    body('recurrence.pattern').optional().isIn(['daily', 'weekly', 'monthly', 'custom']).withMessage('Invalid recurrence pattern'),
    body('recurrence.interval').optional().isInt({ min: 1 }).withMessage('Interval must be a positive integer'),
    body('recurrence.endDate').optional().isISO8601().toDate().withMessage('End date must be a valid date'),
    body('recurrence.occurrences').optional().isInt({ min: 1 }).withMessage('Occurrences must be a positive integer')
];

const validateStatus = [
    body('status')
        .isIn(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'])
        .withMessage('Invalid status')
];

const validateAvailabilityQuery = [
    query('professionalId').notEmpty().withMessage('Professional ID is required'),
    query('date').isISO8601().toDate().withMessage('Valid date is required'),
    query('serviceId').notEmpty().withMessage('Service ID is required')
];

// Create new appointment
router.post('/', auth, checkAppointmentPermissions, validateAppointment, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            status: 'error',
            errors: errors.array()
        });
    }
    await appointmentController.createAppointment(req, res);
});

// Get appointments with filters
router.get('/', auth, checkAppointmentPermissions, async (req, res) => {
    await appointmentController.getAppointments(req, res);
});

// Update appointment
router.put('/:id', auth, checkAppointmentPermissions, validateAppointment, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            status: 'error',
            errors: errors.array()
        });
    }
    await appointmentController.updateAppointment(req, res);
});

// Update appointment status
router.put('/:id/status', auth, checkAppointmentPermissions, validateStatus, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            status: 'error',
            errors: errors.array()
        });
    }
    await appointmentController.updateAppointmentStatus(req, res);
});

// Cancel appointment
router.post('/:id/cancel', auth, checkAppointmentPermissions, async (req, res) => {
    await appointmentController.cancelAppointment(req, res);
});

// Confirm appointment
router.post('/:id/confirm', auth, checkAppointmentPermissions, async (req, res) => {
    await appointmentController.confirmAppointment(req, res);
});

// Get available time slots
router.get('/availability', auth, validateAvailabilityQuery, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            status: 'error',
            errors: errors.array()
        });
    }
    await appointmentController.getAvailableSlots(req, res);
});

module.exports = router;