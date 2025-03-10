const Transaction = require('../models/transaction');
const Client = require('../models/client');
const Professional = require('../models/professional');
const Service = require('../models/service');
const Product = require('../models/product');

// Helper function to get the effective userId and check permissions
const getEffectiveUserIdAndCheckPermissions = async (req) => {
    let userId = req.user._id;
    let canAccessReports = true;

    if (req.user.role === 'professional') {
        const professional = await Professional.findOne({ userAccountId: userId });
        if (!professional) {
            throw new Error('Professional not found');
        }
        if (!professional.permissions.viewReports) {
            canAccessReports = false;
        }
        userId = professional.userId; // Use the parent account's userId
    }

    return { userId, canAccessReports };
};

// Financial Reports
const getFinancialSummary = async (req, res) => {
    try {
        const { userId, canAccessReports } = await getEffectiveUserIdAndCheckPermissions(req);
        if (!canAccessReports) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. Insufficient permissions.'
            });
        }

        const { startDate, endDate, groupBy = 'day' } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                status: 'error',
                message: 'Start date and end date are required'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid date format'
            });
        }

        const groupByFormat = {
            day: '%Y-%m-%d',
            week: '%Y-W%V',
            month: '%Y-%m',
            year: '%Y'
        }[groupBy];

        const transactions = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    date: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: {
                        period: { $dateToString: { format: groupByFormat, date: '$date' } },
                        type: '$type'
                    },
                    total: { $sum: '$amount' },
                    totalCommissions: {
                        $sum: {
                            $cond: [
                                { $and: [
                                    { $eq: ['$type', 'income'] },
                                    { $exists: ['$commission'] }
                                ]},
                                '$commission.amount',
                                0
                            ]
                        }
                    },
                    paidCommissions: {
                        $sum: {
                            $cond: [
                                { $and: [
                                    { $eq: ['$type', 'income'] },
                                    { $exists: ['$commission'] },
                                    { $eq: ['$commission.status', 'paid'] }
                                ]},
                                '$commission.amount',
                                0
                            ]
                        }
                    }
                }
            },
            {
                $group: {
                    _id: '$_id.period',
                    income: {
                        $sum: { $cond: [{ $eq: ['$_id.type', 'income'] }, '$total', 0] }
                    },
                    expenses: {
                        $sum: { $cond: [{ $eq: ['$_id.type', 'expense'] }, '$total', 0] }
                    },
                    totalCommissions: { $sum: '$totalCommissions' },
                    paidCommissions: { $sum: '$paidCommissions' }
                }
            },
            { $sort: { '_id': 1 } }
        ]);

        res.json({
            status: 'success',
            data: transactions
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

// Professional Reports
const getProfessionalPerformance = async (req, res) => {
    try {
        const { userId, canAccessReports } = await getEffectiveUserIdAndCheckPermissions(req);
        if (!canAccessReports) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. Insufficient permissions.'
            });
        }

        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                status: 'error',
                message: 'Start date and end date are required'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const performance = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    type: 'income',
                    category: 'service',
                    date: { $gte: start, $lte: end }
                }
            },
            {
                $lookup: {
                    from: 'professionals',
                    localField: 'professionalId',
                    foreignField: '_id',
                    as: 'professional'
                }
            },
            {
                $unwind: '$professional'
            },
            {
                $group: {
                    _id: '$professionalId',
                    name: { $first: '$professional.name' },
                    totalServices: { $sum: 1 },
                    totalRevenue: { $sum: '$amount' },
                    totalCommission: { $sum: '$commission' }
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    totalServices: 1,
                    totalRevenue: 1,
                    totalCommission: 1,
                    averageTicket: { $divide: ['$totalRevenue', '$totalServices'] }
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        res.json({
            status: 'success',
            data: performance
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

// Client Reports
const getTopClients = async (req, res) => {
    try {
        const { userId, canAccessReports } = await getEffectiveUserIdAndCheckPermissions(req);
        if (!canAccessReports) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. Insufficient permissions.'
            });
        }

        const { startDate, endDate, limit = 10 } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                status: 'error',
                message: 'Start date and end date are required'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const topClients = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    type: 'income',
                    clientId: { $exists: true },
                    date: { $gte: start, $lte: end }
                }
            },
            {
                $lookup: {
                    from: 'clients',
                    localField: 'clientId',
                    foreignField: '_id',
                    as: 'client'
                }
            },
            {
                $unwind: '$client'
            },
            {
                $group: {
                    _id: '$clientId',
                    name: { $first: '$client.name' },
                    totalSpent: { $sum: '$amount' },
                    visitsCount: { $sum: 1 },
                    lastVisit: { $max: '$date' }
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    totalSpent: 1,
                    visitsCount: 1,
                    lastVisit: 1,
                    averageTicket: { $divide: ['$totalSpent', '$visitsCount'] }
                }
            },
            { $sort: { totalSpent: -1 } },
            { $limit: parseInt(limit) }
        ]);

        res.json({
            status: 'success',
            data: topClients
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

// Service and Product Reports
const getPopularServices = async (req, res) => {
    try {
        const { userId, canAccessReports } = await getEffectiveUserIdAndCheckPermissions(req);
        if (!canAccessReports) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. Insufficient permissions.'
            });
        }

        const { startDate, endDate, limit = 10 } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                status: 'error',
                message: 'Start date and end date are required'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const popularServices = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    type: 'income',
                    category: 'service',
                    date: { $gte: start, $lte: end }
                }
            },
            {
                $lookup: {
                    from: 'services',
                    localField: 'serviceId',
                    foreignField: '_id',
                    as: 'service'
                }
            },
            {
                $unwind: '$service'
            },
            {
                $group: {
                    _id: '$serviceId',
                    name: { $first: '$service.name' },
                    totalRevenue: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    totalRevenue: 1,
                    count: 1,
                    averagePrice: { $divide: ['$totalRevenue', '$count'] }
                }
            },
            { $sort: { count: -1 } },
            { $limit: parseInt(limit) }
        ]);

        res.json({
            status: 'success',
            data: popularServices
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

module.exports = {
    getFinancialSummary,
    getProfessionalPerformance,
    getTopClients,
    getPopularServices
};