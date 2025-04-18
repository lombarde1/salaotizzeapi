const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const transactionController = require('../controllers/transaction');

const router = express.Router();

// Validation middleware
const validateTransaction = [
    body('type').isIn(['income', 'expense']).withMessage('Invalid transaction type'),
    body('category').notEmpty().withMessage('Category is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('paymentMethod').isIn(['cash', 'credit_card', 'debit_card', 'pix', 'transfer'])
        .withMessage('Invalid payment method')
];

const validateService = [
    body('serviceId').notEmpty().withMessage('Service ID is required'),
    body('professionalId').notEmpty().withMessage('Professional ID is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('paymentMethod').isIn(['cash', 'credit_card', 'debit_card', 'pix', 'transfer'])
        .withMessage('Invalid payment method')
];

const validateProduct = [
    body('productId').notEmpty().withMessage('Product ID is required'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('paymentMethod').isIn(['cash', 'credit_card', 'debit_card', 'pix', 'transfer'])
        .withMessage('Invalid payment method')
];

// Transaction routes
router.post('/', auth, validateTransaction, transactionController.createTransaction);
router.get('/', auth, transactionController.getTransactions);

// Service transaction routes
router.post('/service', auth, validateService, transactionController.registerService);

// Product transaction routes
// Adicione esta rota ao arquivo routes/transaction.js

const validateMultipleProducts = [
    body('clientId').optional(),
    body('items').isArray().withMessage('Items deve ser um array'),
    body('items.*.productId').notEmpty().withMessage('Product ID é obrigatório'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantidade deve ser pelo menos 1'),
    body('paymentMethod').isIn(['cash', 'credit_card', 'debit_card', 'pix', 'transfer'])
        .withMessage('Forma de pagamento inválida')
];

// Adicione esta rota junto com as outras rotas no arquivo
router.post('/products', auth, validateMultipleProducts, transactionController.registerMultipleProducts);
// Financial summary route
router.get('/summary', auth, transactionController.getFinancialSummary);

// Transaction status routes
router.put('/:id/status', auth, [
    body('status').isIn(['paid', 'pending', 'cancelled']).withMessage('Invalid status')
], transactionController.updateTransactionStatus);

// Commission routes
router.put('/:id/commission/pay', auth, [
    body('paymentMethod').isIn(['cash', 'credit_card', 'debit_card', 'pix', 'transfer'])
        .withMessage('Invalid payment method')
], transactionController.payCommission);

module.exports = router;