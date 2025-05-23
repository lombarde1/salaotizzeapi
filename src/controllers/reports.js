// src/controllers/reports.js

const Transaction = require('../models/transaction');
const Client = require('../models/client');
const Professional = require('../models/professional');
const Service = require('../models/service');
const Product = require('../models/product');
const mongoose = require('mongoose');

// Helper function para obter o ID do usuário efetivo e verificar permissões
const getEffectiveUserIdAndCheckPermissions = async (req) => {
    let userId = req.user._id;
    let canAccessReports = true;

    if (req.user.role === 'professional') {
        const professional = await Professional.findOne({ userAccountId: userId });
        if (!professional) {
            throw new Error('Profissional não encontrado');
        }

        // Verificar a permissão visualizarDados no sistema atual
        if (!professional.permissions || !professional.permissions.visualizarDados) {
            canAccessReports = false;
        }
        
        userId = professional.userId; // Usar o ID da conta do proprietário
    }

    return { userId, canAccessReports };
};

// Helper function para obter intervalo de datas baseado no filtro
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

// Financial Reports
const getFinancialSummary = async (req, res) => {
    try {
        const { userId, canAccessReports } = await getEffectiveUserIdAndCheckPermissions(req);
        if (!canAccessReports) {
            return res.status(403).json({
                status: 'error',
                message: 'Acesso negado. Permissões insuficientes para visualizar relatórios financeiros.'
            });
        }

        // Usar filterType ou fallback para startDate/endDate
        const { filterType, startDate, endDate, groupBy = 'day' } = req.query;
        
        let start, end;
        
        if (filterType) {
            const dateRange = getDateRange(filterType, startDate, endDate);
            start = dateRange.start;
            end = dateRange.end;
        } else if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
        } else {
            return res.status(400).json({
                status: 'error',
                message: 'Filtro de data ou intervalo de datas é necessário'
            });
        }

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                status: 'error',
                message: 'Formato de data inválido'
            });
        }

        const groupByFormat = {
            day: '%Y-%m-%d',
            week: '%Y-W%V',
            month: '%Y-%m',
            year: '%Y'
        }[groupBy];

        // Converter userId para ObjectId se não for
        let userIdObj;
        try {
            userIdObj = mongoose.Types.ObjectId(userId);
        } catch (e) {
            userIdObj = userId;
        }

        const transactions = await Transaction.aggregate([
            {
                $match: {
                    userId: userIdObj,
                    date: { $gte: start, $lte: end }
                }
            },
            {
                $project: {
                    type: 1,
                    amount: 1,
                    date: 1,
                    commission: 1,
                    hasCommission: {
                        $cond: [
                            { $ifNull: ["$commission", false] },
                            true,
                            false
                        ]
                    },
                    commissionAmount: { $ifNull: ["$commission.amount", 0] },
                    commissionStatus: { $ifNull: ["$commission.status", ""] }
                }
            },
            {
                $group: {
                    _id: {
                        period: { $dateToString: { format: groupByFormat, date: '$date' } },
                        type: '$type'
                    },
                    total: { $sum: '$amount' },
                    // Somar comissões apenas se estiverem presentes
                    totalCommissions: {
                        $sum: {
                            $cond: [
                                { $and: [
                                    { $eq: ['$type', 'income'] },
                                    '$hasCommission'
                                ]},
                                '$commissionAmount',
                                0
                            ]
                        }
                    },
                    // Somar comissões pagas
                    paidCommissions: {
                        $sum: {
                            $cond: [
                                { $and: [
                                    { $eq: ['$type', 'income'] },
                                    '$hasCommission',
                                    { $eq: ['$commissionStatus', 'paid'] }
                                ]},
                                '$commissionAmount',
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

        // Calcular os totais
        const totals = transactions.reduce((acc, item) => {
            acc.income += item.income || 0;
            acc.expenses += item.expenses || 0;
            acc.profit = acc.income - acc.expenses;
            acc.totalCommissions += item.totalCommissions || 0;
            acc.paidCommissions += item.paidCommissions || 0;
            return acc;
        }, { income: 0, expenses: 0, profit: 0, totalCommissions: 0, paidCommissions: 0 });

        res.json({
            status: 'success',
            data: {
                transactions,
                totals,
                dateFilter: {
                    type: filterType || 'custom',
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

// Professional Reports
const getProfessionalPerformance = async (req, res) => {
    try {
        const { userId, canAccessReports } = await getEffectiveUserIdAndCheckPermissions(req);
        if (!canAccessReports) {
            return res.status(403).json({
                status: 'error',
                message: 'Acesso negado. Permissões insuficientes para visualizar desempenho de profissionais.'
            });
        }

        // Usar filterType ou fallback para startDate/endDate
        const { filterType, startDate, endDate } = req.query;
        
        let start, end;
        
        if (filterType) {
            const dateRange = getDateRange(filterType, startDate, endDate);
            start = dateRange.start;
            end = dateRange.end;
        } else if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
        } else {
            return res.status(400).json({
                status: 'error',
                message: 'Filtro de data ou intervalo de datas é necessário'
            });
        }

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                status: 'error',
                message: 'Formato de data inválido'
            });
        }

        const performance = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    type: 'income',
                    category: 'service',
                    date: { $gte: start, $lte: end },
                    professional: { $ne: null }
                }
            },
            {
                $lookup: {
                    from: 'professionals',
                    localField: 'professional',
                    foreignField: '_id',
                    as: 'professionalInfo'
                }
            },
            {
                $unwind: {
                    path: '$professionalInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $group: {
                    _id: '$professional',
                    name: { $first: '$professionalInfo.name' },
                    totalServices: { $sum: 1 },
                    totalRevenue: { $sum: '$amount' },
                    totalCommission: { 
                        $sum: { 
                            $cond: [
                                { $exists: ['$commission'] },
                                '$commission.amount',
                                0
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    totalServices: 1,
                    totalRevenue: 1,
                    totalCommission: 1,
                    averageTicket: {
                        $cond: [
                            { $eq: ['$totalServices', 0] },
                            0,
                            { $divide: ['$totalRevenue', '$totalServices'] }
                        ]
                    }
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        res.json({
            status: 'success',
            data: {
                performance,
                dateFilter: {
                    type: filterType || 'custom',
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

// Client Reports
const getTopClients = async (req, res) => {
    try {
        const { userId, canAccessReports } = await getEffectiveUserIdAndCheckPermissions(req);
        if (!canAccessReports) {
            return res.status(403).json({
                status: 'error',
                message: 'Acesso negado. Permissões insuficientes para visualizar dados de clientes.'
            });
        }

        // Usar filterType ou fallback para startDate/endDate
        const { filterType, startDate, endDate, limit = 10 } = req.query;
        
        let start, end;
        
        if (filterType) {
            const dateRange = getDateRange(filterType, startDate, endDate);
            start = dateRange.start;
            end = dateRange.end;
        } else if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
        } else {
            return res.status(400).json({
                status: 'error',
                message: 'Filtro de data ou intervalo de datas é necessário'
            });
        }

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                status: 'error',
                message: 'Formato de data inválido'
            });
        }

        const topClients = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    type: 'income',
                    client: { $ne: null },
                    date: { $gte: start, $lte: end }
                }
            },
            {
                $lookup: {
                    from: 'clients',
                    localField: 'client',
                    foreignField: '_id',
                    as: 'clientInfo'
                }
            },
            {
                $unwind: {
                    path: '$clientInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $group: {
                    _id: '$client',
                    name: { $first: '$clientInfo.name' },
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
                    averageTicket: {
                        $cond: [
                            { $eq: ['$visitsCount', 0] },
                            0,
                            { $divide: ['$totalSpent', '$visitsCount'] }
                        ]
                    }
                }
            },
            { $sort: { totalSpent: -1 } },
            { $limit: parseInt(limit) }
        ]);

        res.json({
            status: 'success',
            data: {
                clients: topClients,
                dateFilter: {
                    type: filterType || 'custom',
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

// Service and Product Reports
const getPopularServices = async (req, res) => {
    try {
        const { userId, canAccessReports } = await getEffectiveUserIdAndCheckPermissions(req);
        if (!canAccessReports) {
            return res.status(403).json({
                status: 'error',
                message: 'Acesso negado. Permissões insuficientes para visualizar dados de serviços.'
            });
        }

        // Usar filterType ou fallback para startDate/endDate
        const { filterType, startDate, endDate, limit = 10 } = req.query;
        
        let start, end;
        
        if (filterType) {
            const dateRange = getDateRange(filterType, startDate, endDate);
            start = dateRange.start;
            end = dateRange.end;
        } else if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
        } else {
            return res.status(400).json({
                status: 'error',
                message: 'Filtro de data ou intervalo de datas é necessário'
            });
        }

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                status: 'error',
                message: 'Formato de data inválido'
            });
        }

        const popularServices = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    type: 'income',
                    category: 'service',
                    date: { $gte: start, $lte: end },
                    'reference.model': 'Service',
                    'reference.id': { $ne: null }
                }
            },
            {
                $lookup: {
                    from: 'services',
                    localField: 'reference.id',
                    foreignField: '_id',
                    as: 'serviceInfo'
                }
            },
            {
                $unwind: {
                    path: '$serviceInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $group: {
                    _id: '$reference.id',
                    name: { $first: '$serviceInfo.name' },
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
                    averagePrice: {
                        $cond: [
                            { $eq: ['$count', 0] },
                            0,
                            { $divide: ['$totalRevenue', '$count'] }
                        ]
                    }
                }
            },
            { $sort: { count: -1 } },
            { $limit: parseInt(limit) }
        ]);

        res.json({
            status: 'success',
            data: {
                services: popularServices,
                dateFilter: {
                    type: filterType || 'custom',
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

// Relatório detalhado por tipo de pagamento
const getPaymentMethodReport = async (req, res) => {
    try {
        const { userId, canAccessReports } = await getEffectiveUserIdAndCheckPermissions(req);
        if (!canAccessReports) {
            return res.status(403).json({
                status: 'error',
                message: 'Acesso negado. Permissões insuficientes para visualizar relatórios de pagamento.'
            });
        }

        // Usar filterType ou fallback para startDate/endDate
        const { filterType, startDate, endDate } = req.query;
        
        let start, end;
        
        if (filterType) {
            const dateRange = getDateRange(filterType, startDate, endDate);
            start = dateRange.start;
            end = dateRange.end;
        } else if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
        } else {
            return res.status(400).json({
                status: 'error',
                message: 'Filtro de data ou intervalo de datas é necessário'
            });
        }

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                status: 'error',
                message: 'Formato de data inválido'
            });
        }

        const paymentStats = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    type: 'income',
                    date: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: '$paymentMethod',
                    count: { $sum: 1 },
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { total: -1 } }
        ]);

        const totalAmount = paymentStats.reduce((sum, method) => sum + method.total, 0);
        const totalCount = paymentStats.reduce((sum, method) => sum + method.count, 0);

        // Adicionar percentagem para cada método
        const paymentMethods = paymentStats.map(method => ({
            method: method._id,
            count: method.count,
            total: method.total,
            percentage: totalAmount > 0 ? (method.total / totalAmount * 100).toFixed(2) : 0
        }));

        res.json({
            status: 'success',
            data: {
                paymentMethods,
                totals: {
                    amount: totalAmount,
                    count: totalCount
                },
                dateFilter: {
                    type: filterType || 'custom',
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

// Relatório detalhado de status de pagamentos
const getPaymentStatusReport = async (req, res) => {
    try {
        const { userId, canAccessReports } = await getEffectiveUserIdAndCheckPermissions(req);
        if (!canAccessReports) {
            return res.status(403).json({
                status: 'error',
                message: 'Acesso negado. Permissões insuficientes para visualizar relatórios de status de pagamento.'
            });
        }

        // Usar filterType ou fallback para startDate/endDate
        const { filterType, startDate, endDate } = req.query;
        
        let start, end;
        
        if (filterType) {
            const dateRange = getDateRange(filterType, startDate, endDate);
            start = dateRange.start;
            end = dateRange.end;
        } else if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
        } else {
            return res.status(400).json({
                status: 'error',
                message: 'Filtro de data ou intervalo de datas é necessário'
            });
        }

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                status: 'error',
                message: 'Formato de data inválido'
            });
        }

        const statusStats = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    date: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { total: -1 } }
        ]);

        const totalAmount = statusStats.reduce((sum, status) => sum + status.total, 0);
        const totalCount = statusStats.reduce((sum, status) => sum + status.count, 0);

        // Adicionar percentagem para cada status
        const paymentStatuses = statusStats.map(status => ({
            status: status._id,
            count: status.count,
            total: status.total,
            percentage: totalAmount > 0 ? (status.total / totalAmount * 100).toFixed(2) : 0
        }));

        res.json({
            status: 'success',
            data: {
                paymentStatuses,
                totals: {
                    amount: totalAmount,
                    count: totalCount
                },
                dateFilter: {
                    type: filterType || 'custom',
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

// Relatório detalhado de transações
const getDetailedTransactions = async (req, res) => {
    try {
        const { userId, canAccessReports } = await getEffectiveUserIdAndCheckPermissions(req);
        if (!canAccessReports) {
            return res.status(403).json({
                status: 'error',
                message: 'Acesso negado. Permissões insuficientes para visualizar detalhes de transações.'
            });
        }

        const { 
            filterType, 
            startDate, 
            endDate, 
            status, 
            paymentMethod, 
            professionalId,
            clientId,
            page = 1, 
            limit = 20 
        } = req.query;
        
        // Usar date helper para lidar com diferentes tipos de filtro
        let start, end;
        
        if (filterType) {
            const dateRange = getDateRange(filterType, startDate, endDate);
            start = dateRange.start;
            end = dateRange.end;
        } else if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
        } else {
            return res.status(400).json({
                status: 'error',
                message: 'Filtro de data ou intervalo de datas é necessário'
            });
        }

        // Construir a query com todos os filtros possíveis
        const query = {
            userId,
            date: { $gte: start, $lte: end }
        };

        if (status) query.status = status;
        if (paymentMethod) query.paymentMethod = paymentMethod;
        if (professionalId) query.professional = mongoose.Types.ObjectId(professionalId);
        if (clientId) query.client = mongoose.Types.ObjectId(clientId);

        // Paginação
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Obter transações com informações de cliente e profissional
        const transactions = await Transaction.find(query)
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('client', 'name email phone')
            .populate('professional', 'name')
            .lean();

        // Obter o total para paginação
        const total = await Transaction.countDocuments(query);

        res.json({
            status: 'success',
            data: {
                transactions,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / parseInt(limit))
                },
                dateFilter: {
                    type: filterType || 'custom',
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

// Histórico completo de cliente
const getClientHistory = async (req, res) => {
    try {
        const { userId, canAccessReports } = await getEffectiveUserIdAndCheckPermissions(req);
        if (!canAccessReports) {
            return res.status(403).json({
                status: 'error',
                message: 'Acesso negado. Permissões insuficientes para visualizar histórico de clientes.'
            });
        }

        const { clientId } = req.params;
        
        if (!clientId) {
            return res.status(400).json({
                status: 'error',
                message: 'ID do cliente é obrigatório'
            });
        }

        // Buscar informações do cliente
        const client = await Client.findOne({ 
            _id: clientId,
            userId
        }).lean();

        if (!client) {
            return res.status(404).json({
                status: 'error',
                message: 'Cliente não encontrado'
            });
        }

        // Buscar transações deste cliente
        const transactions = await Transaction.find({
            userId,
            client: clientId
        })
        .sort({ date: -1 })
        .populate('professional', 'name')
        .populate({
            path: 'reference.id',
            select: 'name'
        })
        .lean();

        // Calcular métricas financeiras do cliente
        const totalSpent = transactions.reduce((total, transaction) => {
            if (transaction.type === 'income') {
                return total + transaction.amount;
            }
            return total;
        }, 0);

        // Agrupar transações por serviço/produto
        const serviceGroups = {};
        transactions.forEach(transaction => {
            if (transaction.reference && transaction.reference.model) {
                const refType = transaction.reference.model;
                if (!serviceGroups[refType]) {
                    serviceGroups[refType] = [];
                }
                serviceGroups[refType].push(transaction);
            }
        });

        // Buscar os serviços/produtos mais frequentes
        const favoriteItems = Object.keys(serviceGroups).map(type => {
            const items = serviceGroups[type];
            return {
                type,
                count: items.length,
                totalSpent: items.reduce((sum, item) => sum + item.amount, 0)
            };
        }).sort((a, b) => b.count - a.count);

        res.json({
            status: 'success',
            data: {
                client,
                summary: {
                    totalSpent,
                    transactionsCount: transactions.length,
                    lastVisit: client.lastVisit,
                    favoriteServices: favoriteItems.slice(0, 5)
                },
                transactions
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

// Caso o professional queira visualizar apenas seus próprios dados
// Caso o professional queira visualizar apenas seus próprios dados
const getProfessionalOwnData = async (req, res) => {
    try {
        // Verificar se é um profissional
        if (req.user.role !== 'professional') {
            return res.status(403).json({
                status: 'error',
                message: 'Esta função está disponível apenas para profissionais'
            });
        }

        const professional = await Professional.findOne({ userAccountId: req.user._id });
        if (!professional) {
            return res.status(404).json({
                status: 'error',
                message: 'Perfil profissional não encontrado'
            });
        }

        const ownerId = professional.userId;
        const professionalId = professional._id;

        // Obter período (última semana por padrão)
        const { filterType = 'esta_semana', startDate, endDate } = req.query;
        let start, end;
        
        if (filterType) {
            const dateRange = getDateRange(filterType, startDate, endDate);
            start = dateRange.start;
            end = dateRange.end;
        } else if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
        } else {
            // Default para última semana se não houver filtro
            const now = new Date();
            start = new Date(now);
            start.setDate(start.getDate() - 7);
            end = new Date(now);
        }

        // Obter informações de serviços realizados por este profissional
        const services = await Transaction.find({
            userId: ownerId,
            professional: professionalId,
            type: 'income',
            category: 'service',
            date: { $gte: start, $lte: end }
        })
        .sort({ date: -1 })
        .populate('client', 'name')
        .populate({
            path: 'reference.id',
            select: 'name price'
        })
        .lean();

        // Obter informações de comissões
        const commissionData = await Transaction.aggregate([
            {
                $match: {
                    userId: ownerId,
                    professional: professionalId,
                    date: { $gte: start, $lte: end },
                    'commission.amount': { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: '$commission.status',
                    total: { $sum: '$commission.amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Processar dados de comissão
        const commissions = {
            pending: 0,
            paid: 0,
            total: 0,
            count: 0
        };

        commissionData.forEach(item => {
            if (item._id === 'pending') {
                commissions.pending = item.total;
            } else if (item._id === 'paid') {
                commissions.paid = item.total;
            }
            commissions.total += item.total;
            commissions.count += item.count;
        });

        // Agrupar serviços por dia para visualização em gráfico
        const dailyServices = services.reduce((acc, service) => {
            const dateStr = service.date.toISOString().split('T')[0];
            if (!acc[dateStr]) {
                acc[dateStr] = {
                    date: dateStr,
                    count: 0,
                    total: 0
                };
            }
            acc[dateStr].count += 1;
            acc[dateStr].total += service.amount;
            return acc;
        }, {});

        res.json({
            status: 'success',
            data: {
                professional: {
                    id: professional._id,
                    name: professional.name,
                    commissionType: professional.commissionType,
                    commissionValue: professional.commissionValue
                },
                services,
                commissions,
                dailyServices: Object.values(dailyServices),
                dateFilter: {
                    type: filterType || 'custom',
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

// Obter dados para o painel do profissional
const getProfessionalDashboard = async (req, res) => {
    try {
        // Verificar se é um profissional
        if (req.user.role !== 'professional') {
            return res.status(403).json({
                status: 'error',
                message: 'Esta função está disponível apenas para profissionais'
            });
        }

        const professional = await Professional.findOne({ userAccountId: req.user._id });
        if (!professional) {
            return res.status(404).json({
                status: 'error',
                message: 'Perfil profissional não encontrado'
            });
        }

        const ownerId = professional.userId;
        const professionalId = professional._id;

        // Dados dos últimos 30 dias
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const today = new Date();

        // Agendamentos pendentes
        const pendingAppointments = await Appointment.countDocuments({
            userId: ownerId,
            professionalId: professionalId,
            status: { $in: ['scheduled', 'confirmed'] },
            date: { $gte: new Date() }
        });

        // Serviços realizados no mês atual
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);

        const servicesThisMonth = await Transaction.countDocuments({
            userId: ownerId,
            professional: professionalId,
            type: 'income',
            category: 'service',
            date: { $gte: currentMonthStart, $lte: today }
        });

        // Comissões pendentes e totais
        const commissionData = await Transaction.aggregate([
            {
                $match: {
                    userId: ownerId,
                    professional: professionalId,
                    'commission.amount': { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: '$commission.status',
                    total: { $sum: '$commission.amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Processar dados de comissão
        const commissions = {
            pending: 0,
            paid: 0,
            total: 0,
            count: 0
        };

        commissionData.forEach(item => {
            if (item._id === 'pending') {
                commissions.pending = item.total;
            } else if (item._id === 'paid') {
                commissions.paid = item.total;
            }
            commissions.total += item.total;
            commissions.count += item.count;
        });

        // Top 5 clientes atendidos por este profissional
        const topClients = await Transaction.aggregate([
            {
                $match: {
                    userId: ownerId,
                    professional: professionalId,
                    type: 'income',
                    client: { $ne: null },
                    date: { $gte: thirtyDaysAgo }
                }
            },
            {
                $lookup: {
                    from: 'clients',
                    localField: 'client',
                    foreignField: '_id',
                    as: 'clientInfo'
                }
            },
            {
                $unwind: {
                    path: '$clientInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $group: {
                    _id: '$client',
                    name: { $first: '$clientInfo.name' },
                    totalServices: { $sum: 1 },
                    lastService: { $max: '$date' }
                }
            },
            { $sort: { totalServices: -1 } },
            { $limit: 5 }
        ]);

        res.json({
            status: 'success',
            data: {
                professional: {
                    id: professional._id,
                    name: professional.name
                },
                pendingAppointments,
                servicesThisMonth,
                commissions,
                topClients
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
    getFinancialSummary,
    getProfessionalPerformance,
    getTopClients,
    getPopularServices,
    getPaymentMethodReport,
    getPaymentStatusReport,
    getDetailedTransactions,
    getClientHistory,
    getProfessionalOwnData,      // Nova função para profissionais visualizarem seus próprios dados
    getProfessionalDashboard,    // Nova função para o painel do profissional
    getDateRange                 // Exportar para testes
};