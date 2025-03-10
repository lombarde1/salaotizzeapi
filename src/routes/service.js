const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const serviceController = require('../controllers/service');

const router = express.Router();

// Validation middleware
const validateService = [
    body('name').trim().notEmpty().withMessage('Nome é obrigatório'),
    body('price').isFloat({ min: 0 }).withMessage('Preço deve ser um número positivo'),
    body('duration').optional().isInt({ min: 0 }).withMessage('Duração deve ser um número positivo'),
    body('commissionType').optional().isIn(['fixed', 'percentage']).withMessage('Tipo de comissão inválido'),
    body('commissionValue').optional().isFloat({ min: 0 }).withMessage('Valor da comissão deve ser positivo')
];

// Create new service
router.post('/', auth, validateService, serviceController.createService);

// List services with filters
router.get('/', auth, serviceController.getServices);

// Get service by ID
router.get('/:id', auth, serviceController.getService);

// Update service
router.put('/:id', auth, validateService, serviceController.updateService);

// Delete/Deactivate service
router.delete('/:id', auth, serviceController.deleteService);

// Get service categories
router.get('/categories', auth, serviceController.getCategories);

module.exports = router;