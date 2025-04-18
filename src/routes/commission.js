// Novo arquivo: src/routes/commission.js

const express = require('express');
const { body, query } = require('express-validator');
const auth = require('../middleware/auth');
const commissionController = require('../controllers/commission');

const router = express.Router();

// Validação para pagamento de comissões
const validateCommissionPayment = [
    body('paymentMethod').isIn(['cash', 'credit_card', 'debit_card', 'pix', 'transfer'])
        .withMessage('Invalid payment method'),
    body('transactionIds').optional().isArray().withMessage('Transaction IDs must be an array'),
    body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('payAll').optional().isBoolean().withMessage('payAll must be a boolean')
];

// Listar todas as comissões pendentes
router.get('/pending', auth, commissionController.getPendingCommissions);

// Obter resumo de comissões para dashboard
router.get('/summary', auth, commissionController.getCommissionsSummary);

// Obter detalhes de comissões de um profissional específico
router.get('/professional/:professionalId', auth, commissionController.getProfessionalCommissions);

// Pagar comissões de um profissional
router.post('/pay/:professionalId', auth, validateCommissionPayment, commissionController.payCommissions);

module.exports = router;