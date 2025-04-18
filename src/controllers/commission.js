// Novo arquivo: src/controllers/commission.js

const Transaction = require('../models/transaction');
const Professional = require('../models/professional');
const mongoose = require('mongoose');
const notificationService = require('../services/notification');

// Listar comissões pendentes por profissional
// Listar comissões pendentes por profissional
exports.getPendingCommissions = async (req, res) => {
    try {
        const { professionalId } = req.query;
        let query = { 
            userId: req.user._id,
            'commission.status': 'pending', // Apenas comissões pendentes
            'commission.amount': { $exists: true, $gt: 0 } // Comissão deve existir e ser maior que zero
        };

        if (professionalId) {
            query.professional = professionalId;
        }

        const commissions = await Transaction.find(query)
            .populate('professional', 'name')
            .populate('client', 'name')
            .sort({ date: -1 });

        // Agrupar por profissional
        const groupedByProfessional = {};
        let totalCommission = 0;

        commissions.forEach(transaction => {
            const profId = transaction.professional?._id?.toString();
            const profName = transaction.professional?.name || 'Sem profissional';
            
            if (!profId) return;
            
            if (!groupedByProfessional[profId]) {
                groupedByProfessional[profId] = {
                    professionalId: profId,
                    professionalName: profName,
                    transactions: [],
                    totalAmount: 0
                };
            }
            
            // Garantir que commissionAmount seja um número válido
            const commissionAmount = transaction.commission.amount || 0;
            
            groupedByProfessional[profId].transactions.push({
                transactionId: transaction._id,
                date: transaction.date,
                category: transaction.category,
                clientName: transaction.client?.name || 'Sem cliente',
                saleAmount: transaction.amount,
                commissionAmount: commissionAmount
            });
            
            groupedByProfessional[profId].totalAmount += commissionAmount;
            totalCommission += commissionAmount;
        });

        res.json({
            status: 'success',
            data: {
                professionals: Object.values(groupedByProfessional),
                totalCommission
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

// Obter detalhes de comissões de um profissional específico
exports.getProfessionalCommissions = async (req, res) => {
    try {
        const { professionalId } = req.params;
        const { status, startDate, endDate } = req.query;
        
        // Verificar se o profissional existe e pertence a este usuário
        const professional = await Professional.findOne({
            _id: professionalId,
            userId: req.user._id
        });
        
        if (!professional) {
            return res.status(404).json({
                status: 'error',
                message: 'Professional not found'
            });
        }
        
        // Construir query de busca
        const query = {
            userId: req.user._id,
            professional: professionalId,
            'commission.amount': { $gt: 0 }
        };
        
        if (status) {
            query['commission.status'] = status;
        }
        
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }
        
        // Buscar transações
        const transactions = await Transaction.find(query)
            .populate('client', 'name')
            .sort({ date: -1 });
            
        // Calcular totais
        const summary = {
            totalSales: 0,
            totalCommission: 0,
            pendingCommission: 0,
            paidCommission: 0
        };
        
        transactions.forEach(transaction => {
            summary.totalSales += transaction.amount;
            summary.totalCommission += transaction.commission.amount;
            
            if (transaction.commission.status === 'pending') {
                summary.pendingCommission += transaction.commission.amount;
            } else if (transaction.commission.status === 'paid') {
                summary.paidCommission += transaction.commission.amount;
            }
        });
        
        res.json({
            status: 'success',
            data: {
                professional: {
                    _id: professional._id,
                    name: professional.name,
                    commissionType: professional.commissionType,
                    commissionValue: professional.commissionValue
                },
                transactions,
                summary
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

// Pagar comissões de um profissional
exports.payCommissions = async (req, res) => {
    try {
        const { professionalId } = req.params;
        const { transactionIds, amount, paymentMethod, payAll, notes } = req.body;
        
        // Verificar se o profissional existe e pertence a este usuário
        const professional = await Professional.findOne({
            _id: professionalId,
            userId: req.user._id
        });
        
        if (!professional) {
            return res.status(404).json({
                status: 'error',
                message: 'Professional not found'
            });
        }
        
        // Se payAll for true, pagar todas as comissões pendentes
        let query = { 
            userId: req.user._id,
            professional: professionalId,
            'commission.status': 'pending'
        };
        
        // Se transactionIds estiver definido, pagar apenas essas transações
        if (!payAll && transactionIds && transactionIds.length > 0) {
            const validIds = transactionIds.filter(id => mongoose.Types.ObjectId.isValid(id));
            query._id = { $in: validIds };
        }
        
        // Buscar transações a serem pagas
        const transactions = await Transaction.find(query);
        
        if (transactions.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'No pending commissions found'
            });
        }
        
        // Calcular valor total de comissões
        let totalCommissionAmount = 0;
        const commissionIds = [];
        
        transactions.forEach(transaction => {
            totalCommissionAmount += transaction.commission.amount;
            commissionIds.push(transaction._id);
        });
        
        // Se o valor específico for fornecido, verificar se é válido
        if (amount && amount > totalCommissionAmount) {
            return res.status(400).json({
                status: 'error',
                message: `Amount exceeds total pending commissions: ${totalCommissionAmount}`
            });
        }
        
        // Valor final a ser pago
        const finalAmount = amount || totalCommissionAmount;
        
        // Criar transação de despesa para pagamento de comissão
        const commissionTransaction = new Transaction({
            userId: req.user._id,
            type: 'expense',
            category: 'salary',
            amount: finalAmount,
            description: notes || `Pagamento de comissão para ${professional.name}`,
            paymentMethod,
            date: Date.now(),
            status: 'paid',
            professional: professionalId,
            reference: {
                model: 'Commission',
                id: null // Sem ID específico, pois pode ser múltiplas comissões
            }
        });
        
        await commissionTransaction.save();
        
        // Atualizar status das comissões para 'paid'
        await Transaction.updateMany(
            { _id: { $in: commissionIds } },
            { $set: { 'commission.status': 'paid' } }
        );
        
        // Criar notificação para o profissional
        if (professional.userAccountId) {
            await notificationService.createNotification({
                userId: professional.userAccountId,
                title: "Comissão Paga",
                message: `Suas comissões no valor de R$ ${finalAmount.toFixed(2)} foram pagas`,
                type: "commission_paid",
                relatedTo: {
                    model: "Transaction",
                    id: commissionTransaction._id
                }
            });
        }
        
        res.json({
            status: 'success',
            data: {
                paymentTransaction: commissionTransaction,
                paidCommissions: commissionIds,
                amount: finalAmount
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

// Obter resumo de comissões para dashboard
exports.getCommissionsSummary = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        // Verificar datas
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
        
        // Obter dados agrupados por status e profissional
        const commissionData = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(req.user._id),
                    'commission.amount': { $gt: 0 },
                    date: { $gte: start, $lte: end }
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
                $unwind: '$professionalInfo'
            },
            {
                $group: {
                    _id: {
                        professionalId: '$professional',
                        status: '$commission.status'
                    },
                    professionalName: { $first: '$professionalInfo.name' },
                    totalCommission: { $sum: '$commission.amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: '$_id.professionalId',
                    name: { $first: '$professionalName' },
                    commissions: { 
                        $push: { 
                            status: '$_id.status', 
                            total: '$totalCommission',
                            count: '$count'
                        }
                    },
                    totalAmount: { $sum: '$totalCommission' }
                }
            },
            {
                $sort: { totalAmount: -1 }
            }
        ]);
        
        // Calcular totais gerais
        let totalPending = 0;
        let totalPaid = 0;
        let totalCommissions = 0;
        
        commissionData.forEach(professional => {
            professional.commissions.forEach(commission => {
                if (commission.status === 'pending') {
                    totalPending += commission.total;
                } else if (commission.status === 'paid') {
                    totalPaid += commission.total;
                }
                totalCommissions += commission.total;
            });
        });
        
        res.json({
            status: 'success',
            data: {
                professionals: commissionData,
                summary: {
                    totalPending,
                    totalPaid,
                    totalCommissions
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

