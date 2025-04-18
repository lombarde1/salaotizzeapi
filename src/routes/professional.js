const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const professionalController = require('../controllers/professional');
const validator = require('../middleware/validator');

const router = express.Router();

// Validation middleware
const validateProfessional = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone')
        .optional()
        .matches(/^\d+$/)
        .withMessage('Phone must contain only digits'),
    body('email')
        .optional()
        .isEmail()
        .withMessage('Please enter a valid email'),
    body('cpf')
        .optional()
        .trim(),
    body('visualizarDados')
        .optional()
        .isBoolean()
        .withMessage('visualizarDados must be a boolean')
];

// Validation for commission data
const validateCommission = [
    body('commissionType')
        .isIn(['percentage', 'fixed'])
        .withMessage('Commission type must be percentage or fixed'),
    body('commissionValue')
        .isNumeric()
        .withMessage('Commission value must be a number')
        .custom((value, { req }) => {
            if (req.body.commissionType === 'percentage' && (value < 0 || value > 100)) {
                throw new Error('Percentage commission must be between 0 and 100');
            }
            if (value < 0) {
                throw new Error('Commission value cannot be negative');
            }
            return true;
        })
];

// Validation for professional account creation
const validateAccount = [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long')
];

// Parameter validation
const validateId = [
    param('id').isMongoId().withMessage('Invalid professional ID')
];

// Routes
// Create new professional
router.post(
    '/', 
    auth, 
    validateProfessional, 
    validator,
    professionalController.createProfessional
);

// List professionals with filtering
router.get(
    '/', 
    auth, 
    professionalController.listProfessionals
);

// Get professional by ID
router.get(
    '/:id', 
    auth, 
    validateId,
    validator,
    professionalController.getProfessional
);

// Update professional
router.put(
    '/:id', 
    auth, 
    validateId,
    validateProfessional, 
    validator,
    professionalController.updateProfessional
);

// Delete/Deactivate professional
router.delete(
    '/:id', 
    auth, 
    validateId,
    validator,
    professionalController.deleteProfessional
);

// Update commission settings
router.put(
    '/:id/commission', 
    auth, 
    validateId,
    validateCommission, 
    validator,
    professionalController.updateCommission
);

// Create professional account
router.post(
    '/:id/account', 
    auth, 
    validateId,
    validateAccount, 
    validator,
    professionalController.createProfessionalAccount
);

module.exports = router;