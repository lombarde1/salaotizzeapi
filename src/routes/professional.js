const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const professionalController = require('../controllers/professional');

const router = express.Router();

// Validation middleware
const validateProfessional = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('role').trim().notEmpty().withMessage('Professional role is required'),
    body('phone').optional().matches(/^\d+$/).withMessage('Phone must contain only digits'),
    body('email').optional().isEmail().withMessage('Please enter a valid email'),
    body('commissionValue').isNumeric().withMessage('Commission value must be a number')
];

// Create new professional
router.post('/', auth, validateProfessional, professionalController.createProfessional);

// List professionals
router.get('/', auth, professionalController.listProfessionals);

// Get professional by ID
router.get('/:id', auth, professionalController.getProfessional);

// Update professional
router.put('/:id', auth, validateProfessional, professionalController.updateProfessional);

// Delete/Deactivate professional
router.delete('/:id', auth, professionalController.deleteProfessional);

// Update commission settings
router.put('/:id/commission', auth, [
    body('commissionType').isIn(['percentage', 'fixed']).withMessage('Invalid commission type'),
    body('commissionValue').isNumeric().withMessage('Commission value must be a number')
], professionalController.updateCommission);

// Create professional account
router.post('/:id/account', auth, [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], professionalController.createProfessionalAccount);

module.exports = router;