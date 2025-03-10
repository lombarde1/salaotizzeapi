const express = require('express');
const auth = require('../middleware/auth');
const { 
    getFinancialSummary,
    getProfessionalPerformance,
    getTopClients,
    getPopularServices
} = require('../controllers/reports');

const router = express.Router();

// Financial Reports
router.get('/financial/summary', auth, getFinancialSummary);

// Professional Reports
router.get('/professionals/performance', auth, getProfessionalPerformance);

// Client Reports
router.get('/clients/top', auth, getTopClients);

// Service Reports
router.get('/services/popular', auth, getPopularServices);

module.exports = router;