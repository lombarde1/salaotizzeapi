// src/controllers/dashboard.js

const Transaction = require('../models/transaction');
const Client = require('../models/client');
const Appointment = require('../models/appointment');
const Service = require('../models/service');
const Professional = require('../models/professional');
const { getOwnerUserId, getProfessionalId, canViewAllData } = require('../utils/userHelper');

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

    // Obter o ID do proprietário usando a função de utilidade
    const ownerUserId = await getOwnerUserId(req);

    // Get date range based on filter type
    const { start, end } = getDateRange(filterType.toLowerCase(), startDate, endDate);

    // Verificar se é um profissional e checar suas permissões
    if (req.user.role === 'professional') {
      const professional = await Professional.findOne({ userAccountId: req.user._id });
      
      if (!professional) {
        return res.status(403).json({
          status: 'error',
          message: 'Profissional não encontrado'
        });
      }
      
      // Verificar se o profissional pode visualizar dados
      // Na versão simplificada, usamos a propriedade visualizarDados
      const canView = professional.permissions && professional.permissions.visualizarDados;
      
      // Se não tiver permissão, mostrar apenas seus dados pessoais
      if (!canView) {
        const professionalId = professional._id;
        
        // Buscar total de agendamentos pendentes do profissional
        const appointmentsCount = await Appointment.countDocuments({
          userId: ownerUserId,
          professionalId,
          status: { $in: ['scheduled', 'confirmed'] },
          date: { $gte: new Date() }
        });
        
        // Buscar dados de comissão do profissional
        const commissionData = await Transaction.aggregate([
          {
            $match: {
              userId: ownerUserId,
              professional: professionalId,
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

    // Buscar receitas no período
    const income = await Transaction.aggregate([
      {
        $match: {
          userId: ownerUserId,
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

    // Buscar despesas no período
    const expenses = await Transaction.aggregate([
      {
        $match: {
          userId: ownerUserId,
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

    // Contagem de clientes ativos
    const clientsCount = await Client.countDocuments({
      userId: ownerUserId,
      status: 'active'
    });

    // Contagem de serviços realizados no período
    const servicesCount = await Transaction.countDocuments({
      userId: ownerUserId,
      type: 'income',
      category: 'service',
      date: { $gte: start, $lte: end }
    });

    // Contagem de agendamentos pendentes
    const pendingAppointments = await Appointment.countDocuments({
      userId: ownerUserId,
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
    console.error('Erro no dashboard summary:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Get daily chart data
const getDailyChartData = async (req, res) => {
  try {
    const { filterType = 'este_mes', startDate, endDate } = req.query;
    
    // Obter o ID do proprietário usando a função de utilidade
    const ownerUserId = await getOwnerUserId(req);

    // Get date range based on filter type
    const { start, end } = getDateRange(filterType.toLowerCase(), startDate, endDate);

    // Check professional permissions
    if (req.user.role === 'professional') {
      // Na versão simplificada, verificamos se o profissional pode visualizar dados
      const canView = await canViewAllData(req);
      
      if (!canView) {
        return res.status(403).json({
          status: 'error',
          message: 'Acesso negado. Permissões insuficientes.'
        });
      }
    }

    const dailyData = await Transaction.aggregate([
      {
        $match: {
          userId: ownerUserId,
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
    console.error('Erro no gráfico diário:', error);
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
    
    // Obter o ID do proprietário usando a função de utilidade
    const ownerUserId = await getOwnerUserId(req);
    
    // Check professional permissions
    if (req.user.role === 'professional') {
      // Na versão simplificada, verificamos se o profissional pode visualizar dados
      const canView = await canViewAllData(req);
      
      if (!canView) {
        return res.status(403).json({
          status: 'error',
          message: 'Acesso negado. Permissões insuficientes.'
        });
      }
    }

    // Default to current year, but allow specific year if provided
    const useYear = year ? parseInt(year) : new Date().getFullYear();
    
    const startDate = new Date(useYear, 0, 1);
    const endDate = new Date(useYear, 11, 31, 23, 59, 59, 999);

    const monthlyData = await Transaction.aggregate([
      {
        $match: {
          userId: ownerUserId,
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
    console.error('Erro no gráfico mensal:', error);
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