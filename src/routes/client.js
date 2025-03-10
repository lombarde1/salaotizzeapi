const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const clientController = require('../controllers/client');

const router = express.Router();

// Validation middleware
const validateClient = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').optional().matches(/^\d+$/).withMessage('Phone must contain only digits'),
    body('email').optional().isEmail().withMessage('Please enter a valid email')
];

// Create new client
router.post('/', auth, validateClient, clientController.createClient);

// List clients with pagination and filters
router.get('/', auth, clientController.listClients);

// Quick search for autocomplete
router.get('/search', auth, clientController.quickSearch);

// Get client by ID
router.get('/:id', auth, clientController.getClient);

// Update client
router.patch('/:id', auth, validateClient, clientController.updateClient);

// Delete/Deactivate client
router.delete('/:id', auth, clientController.deleteClient);

// Get client history
router.get('/:id/history', auth, clientController.getClientHistory);

module.exports = router;