const Transaction = require('../models/transaction');
const Client = require('../models/client');
const Appointment = require('../models/appointment');
const Service = require('../models/service');
const Professional = require('../models/professional');

// Get dashboard summary
const getDashboardSummary = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let userId = req.user._id;

        // If user is a professional, get their parent account's userId
        let professional = null;
        if (req.user.role === 'professional') {
            professional = await Professional.findOne({ userAccountId: userId });
            if (professional) {
                userId = professional.userId; // This is the owner's/company's userId
            } else {
                return res.status(403).json({
                    status: 'error',
                    message: 'Professional not found'
                });
            }
        }

        // Check if user is a professional and get their permissions
        let professionalPermissions = null;
        if (req.user.role === 'professional') {
            const professional = await Professional.findOne({ userAccountId: userId });
            if (!professional) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Professional not found'
                });
            }
            professionalPermissions = professional.permissions;

            // If professional doesn't have dashboard access, only show their commission data
            if (!professionalPermissions.viewFullDashboard) {
                const commissionData = await Transaction.aggregate([
                    {
                        $match: {
                            userId: professional.userId,
                            'professional': professional._id,
                            date: { $gte: startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30)),
                                   $lte: endDate ? new Date(endDate) : new Date() }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalCommission: { $sum: '$commission.amount' },
                            pendingCommission: {
                                $sum: {
                                    $cond: [{ $eq: ['$commission.status', 'pending'] }, '$commission.amount', 0]
                                }
                            },
                            paidCommission: {
                                $sum: {
                                    $cond: [{ $eq: ['$commission.status', 'paid'] }, '$commission.amount', 0]
                                }
                            }
                        }
                    }
                ]);

                const appointmentsCount = await Appointment.countDocuments({
                    userId: professional.userId,
                    professionalId: professional._id,
                    status: { $in: ['scheduled', 'confirmed'] },
                    date: { $gte: new Date() }
                });

                return res.json({
                    status: 'success',
                    data: {
                        totalCommission: commissionData.length > 0 ? commissionData[0].totalCommission : 0,
                        pendingCommission: commissionData.length > 0 ? commissionData[0].pendingCommission : 0,
                        paidCommission: commissionData.length > 0 ? commissionData[0].paidCommission : 0,
                        pendingAppointments: appointmentsCount
                    }
                });
            }
        }

        // Validate dates
        const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
        const end = endDate ? new Date(endDate) : new Date();

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid date format'
            });
        }

        // Get revenue
        const income = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    type: 'income',
                    date: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        // Get expenses
        const expenses = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    type: 'expense',
                    date: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        // Count active clients
        const clientsCount = await Client.countDocuments({
            userId,
            status: 'active'
        });

        // Count services performed
        const servicesCount = await Transaction.countDocuments({
            userId,
            type: 'income',
            category: 'service',
            date: { $gte: start, $lte: end }
        });

        // Get pending appointments
        const pendingAppointments = await Appointment.countDocuments({
            userId,
            status: { $in: ['scheduled', 'confirmed'] },
            date: { $gte: new Date() }
        });

        const totalIncome = income.length > 0 ? income[0].total : 0;
        const totalExpenses = expenses.length > 0 ? expenses[0].total : 0;

        res.json({
            status: 'success',
            data: {
                revenue: totalIncome,
                expenses: totalExpenses,
                profit: totalIncome - totalExpenses,
                clients: clientsCount,
                services: servicesCount,
                pendingAppointments
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

// Get monthly chart data
const getMonthlyChartData = async (req, res) => {
    try {
        let userId = req.user._id;
        
        // If user is a professional, get their parent account's userId
        if (req.user.role === 'professional') {
            const professional = await Professional.findOne({ userAccountId: userId });
            if (!professional) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Professional not found'
                });
            }
            if (!professional.permissions.viewFullDashboard) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Access denied. Insufficient permissions.'
                });
            }
            userId = professional.userId; // This is the owner's/company's userId
        }

        const { year = new Date().getFullYear() } = req.query;

        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31);

        const monthlyData = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: '$date' },
                        type: '$type'
                    },
                    total: { $sum: '$amount' }
                }
            },
            {
                $group: {
                    _id: '$_id.month',
                    income: {
                        $sum: {
                            $cond: [{ $eq: ['$_id.type', 'income'] }, '$total', 0]
                        }
                    },
                    expenses: {
                        $sum: {
                            $cond: [{ $eq: ['$_id.type', 'expense'] }, '$total', 0]
                        }
                    }
                }
            },
            { $sort: { '_id': 1 } }
        ]);

        res.json({
            status: 'success',
            data: monthlyData
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

// Get daily chart data
const getDailyChartData = async (req, res) => {
    try {
        const userId = req.user._id;

        // Check professional permissions
        if (req.user.role === 'professional') {
            const professional = await Professional.findOne({ userAccountId: userId });
            if (!professional || !professional.permissions.viewFullDashboard) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Access denied. Insufficient permissions.'
                });
            }
        }

        const { startDate, endDate } = req.query;

        const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
        const end = endDate ? new Date(endDate) : new Date();

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid date format'
            });
        }

        const dailyData = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    date: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                        type: '$type'
                    },
                    total: { $sum: '$amount' }
                }
            },
            {
                $group: {
                    _id: '$_id.date',
                    income: {
                        $sum: {
                            $cond: [{ $eq: ['$_id.type', 'income'] }, '$total', 0]
                        }
                    },
                    expenses: {
                        $sum: {
                            $cond: [{ $eq: ['$_id.type', 'expense'] }, '$total', 0]
                        }
                    }
                }
            },
            { $sort: { '_id': 1 } }
        ]);

        res.json({
            status: 'success',
            data: dailyData
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

module.exports = {
    getDashboardSummary,
    getMonthlyChartData,
    getDailyChartData
};