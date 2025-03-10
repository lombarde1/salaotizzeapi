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
    body('notes').optional().trim()
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