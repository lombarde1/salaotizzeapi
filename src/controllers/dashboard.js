// src/controllers/dashboard.js

const Transaction = require('../models/transaction');
const Client = require('../models/client');
const Appointment = require('../models/appointment');
const Service = require('../models/service');
const Professional = require('../models/professional');

// Helper function to get date range based on filter type
const getDateRange = (filterType, customStartDate, customEndDate) => {
  const now = new Date();
  let start, end;
  
  switch (filterType) {
    case 'hoje': // Today
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;
      
    case 'esta_semana': // This Week
      const dayOfWeek = now.getDay();
      const startDaysAgo = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust for starting on Monday
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - startDaysAgo);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - startDaysAgo - 1), 23, 59, 59, 999);
      break;
      
    case 'este_mes': // This Month
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
      
    case 'este_ano': // This Year
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
      
    case 'personalizado': // Custom date range
      if (!customStartDate || !customEndDate) {
        throw new Error('Custom date range requires both start and end dates');
      }
      
      start = new Date(customStartDate);
      end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date format');
      }
      break;
      
    default: // Default to last 30 days
      start = new Date(now);
      start.setDate(start.getDate() - 30);
      end = new Date(now);
      break;
  }
  
  return { start, end };
};

// Get dashboard summary with filter
const getDashboardSummary = async (req, res) => {
  try {
    const { filterType = 'este_ano', startDate, endDate } = req.query;
    let userId = req.user._id;

    // Get date range based on filter type
    const { start, end } = getDateRange(filterType.toLowerCase(), startDate, endDate);

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
              date: { $gte: start, $lte: end }
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
            pendingAppointments: appointmentsCount,
            dateFilter: {
              type: filterType,
              startDate: start,
              endDate: end
            }
          }
        });
      }
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
        pendingAppointments,
        dateFilter: {
          type: filterType,
          startDate: start,
          endDate: end
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Get daily chart data - Fixed version
const getDailyChartData = async (req, res) => {
  try {
    const { filterType = 'este_mes', startDate, endDate } = req.query;
    let userId = req.user._id;

    // Get date range based on filter type
    const { start, end } = getDateRange(filterType.toLowerCase(), startDate, endDate);

    // Check professional permissions
    if (req.user.role === 'professional') {
      const professional = await Professional.findOne({ userAccountId: userId });
      if (!professional || !professional.permissions.viewFullDashboard) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. Insufficient permissions.'
        });
      }
      userId = professional.userId;
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
      data: {
        transactions: dailyData,
        dateFilter: {
          type: filterType,
          startDate: start,
          endDate: end
        }
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
    const { filterType = 'este_ano', year } = req.query;
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

    // Default to current year, but allow specific year if provided
    const useYear = year ? parseInt(year) : new Date().getFullYear();
    
    const startDate = new Date(useYear, 0, 1);
    const endDate = new Date(useYear, 11, 31, 23, 59, 59, 999);

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
      data: {
        transactions: monthlyData,
        dateFilter: {
          type: filterType,
          year: useYear,
          startDate: startDate,
          endDate: endDate
        }
      }
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
  getDailyChartData,
  getDateRange // Export for testing
};