// src/routes/reports.js (aprimorado)

const express = require('express');
const auth = require('../middleware/auth');
const { 
    getFinancialSummary,
    getProfessionalPerformance,
    getTopClients,
    getPopularServices,
    getPaymentMethodReport,
    getPaymentStatusReport,
    getDetailedTransactions,
    getClientHistory
} = require('../controllers/reports');

const router = express.Router();

// Relatórios Financeiros
router.get('/financial/summary', auth, getFinancialSummary);
router.get('/financial/payment-methods', auth, getPaymentMethodReport);
router.get('/financial/payment-status', auth, getPaymentStatusReport);
router.get('/transactions', auth, getDetailedTransactions);

// Relatórios de Profissionais
router.get('/professionals/performance', auth, getProfessionalPerformance);

// Relatórios de Clientes
router.get('/clients/top', auth, getTopClients);
router.get('/clients/:clientId/history', auth, getClientHistory);

// Relatórios de Serviços e Produtos
router.get('/services/popular', auth, getPopularServices);

module.exports = router;