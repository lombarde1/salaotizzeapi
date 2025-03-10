const express = require('express');
const auth = require('../middleware/auth');
const { getDashboardSummary, getMonthlyChartData, getDailyChartData } = require('../controllers/dashboard');

const router = express.Router();

// Get dashboard summary
router.get('/summary', auth, getDashboardSummary);

// Get monthly chart data
router.get('/charts/monthly', auth, getMonthlyChartData);

// Get daily chart data
router.get('/charts/daily', auth, getDailyChartData);

module.exports = router;