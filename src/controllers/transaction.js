const Transaction = require('../models/transaction');
const Product = require('../models/product');
const Service = require('../models/service');
const Professional = require('../models/professional');
const Client = require('../models/client');
const notificationService = require('../services/notification');
const mongoose = require('mongoose');

// Create a new transaction
exports.createTransaction = async (req, res) => {
    try {
        const transaction = new Transaction({
            ...req.body,
            userId: req.user.role === 'professional' ? req.user.parentId : req.user._id
        });

        await transaction.save();

        // Create notification for pending payment if applicable
        if (transaction.status === 'pending') {
            await notificationService.createNotification({
                userId: req.user.role === 'professional' ? req.user.parentId : req.user._id,
                title: "Pagamento Pendente",
                message: `Você tem um pagamento pendente de R$ ${transaction.amount.toFixed(2)}`,
                type: "payment_pending",
                relatedTo: {
                    model: "Transaction",
                    id: transaction._id
                }
            });
        }

        res.status(201).json({
            status: 'success',
            data: { transaction }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Register a service transaction
exports.registerService = async (req, res) => {
    try {
        const { serviceId, clientId, professionalId, amount, paymentMethod, date } = req.body;

        // Validate service and get commission details
        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({
                status: 'error',
                message: 'Service not found'
            });
        }

        // Get professional's commission settings
        const professional = await Professional.findById(professionalId);
        if (!professional) {
            return res.status(404).json({
                status: 'error',
                message: 'Professional not found'
            });
        }

        // Create main transaction
        const transaction = new Transaction({
            userId: req.user.role === 'professional' ? req.user.parentId : req.user._id,
            type: 'income',
            category: 'service',
            amount,
            paymentMethod,
            date: date || Date.now(),
            status: 'paid',
            client: clientId,
            professional: professionalId,
            reference: {
                model: 'Service',
                id: serviceId
            }
        });

        // Calculate commission
        let commissionAmount = 0;
        let commissionType = null;
        let commissionValue = null;

        // Only calculate commission if the professional is not the owner
        if (professional.userId !== req.user._id) {
            commissionType = service.commissionType === 'default' 
                ? professional.commissionType 
                : service.commissionType;
            commissionValue = service.commissionType === 'default'
                ? professional.commissionValue
                : service.commissionValue;

            commissionAmount = transaction.calculateCommission(commissionType, commissionValue);

            // Add commission details
            transaction.commission = {
                type: commissionType,
                value: commissionValue,
                amount: commissionAmount,
                status: 'paid'
            };
        }

        await transaction.save();

        // Create commission notification for both professional and parent account
        await notificationService.createNotification({
            userId: professional.userAccountId,
            title: "Comissão Disponível",
            message: `Você tem uma nova comissão disponível de R$ ${commissionAmount.toFixed(2)} pelo serviço realizado`,
            type: "commission_available",
            relatedTo: {
                model: "Transaction",
                id: transaction._id
            }
        });

        // Update client's last visit and total spent
        if (clientId) {
            await Client.findByIdAndUpdate(clientId, {
                $set: { lastVisit: date || Date.now() },
                $inc: { totalSpent: amount }
            });
        }

        res.status(201).json({
            status: 'success',
            data: { transaction }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Register a product sale
exports.registerProductSale = async (req, res) => {
    try {
        const { productId, quantity, clientId, paymentMethod, date } = req.body;

        // Validate product and check stock
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                status: 'error',
                message: 'Product not found'
            });
        }

        if (product.stock < quantity) {
            return res.status(400).json({
                status: 'error',
                message: 'Insufficient stock'
            });
        }

        // Calculate total amount
        const amount = product.salePrice * quantity;

        // Create transaction
        const transaction = new Transaction({
            userId: req.user.role === 'professional' ? req.user.parentId : req.user._id,
            type: 'income',
            category: 'product',
            amount,
            paymentMethod,
            date: date || Date.now(),
            status: 'paid',
            client: clientId,
            reference: {
                model: 'Product',
                id: productId
            }
        });

        // Add commission if applicable
        if (product.commissionType && product.commissionValue) {
            const commissionAmount = transaction.calculateCommission(
                product.commissionType,
                product.commissionValue
            );

            transaction.commission = {
                type: product.commissionType,
                value: product.commissionValue,
                amount: commissionAmount,
                status: 'pending'
            };
        }

        await transaction.save();

        // Update product stock
        await Product.findByIdAndUpdate(productId, {
            $inc: { stock: -quantity }
        });

        // Update client's total spent
        if (clientId) {
            await Client.findByIdAndUpdate(clientId, {
                $inc: { totalSpent: amount }
            });
        }

        res.status(201).json({
            status: 'success',
            data: { transaction }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Get transactions with filters
exports.getTransactions = async (req, res) => {
    try {
        const {
            type,
            category,
            status,
            startDate,
            endDate,
            page = 1,
            limit = 10,
            sortBy = 'date',
            order = 'desc'
        } = req.query;

        let userId = req.user._id;

        // If user is a professional, get their parent account's userId and check permissions
        if (req.user.role === 'professional') {
            const professional = await Professional.findOne({ userAccountId: userId });
            if (!professional) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Professional not found'
                });
            }

            // If professional doesn't have full access, only show their commission data
            if (!professional.permissions.viewFullFinancial) {
                const query = {
                    userId: professional.userId,
                    'professional': professional._id
                };

                if (startDate || endDate) {
                    query.date = {};
                    if (startDate) query.date.$gte = new Date(startDate);
                    if (endDate) query.date.$lte = new Date(endDate);
                }

                const transactions = await Transaction.find(query)
                    .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .populate('client', 'name')
                    .populate('professional', 'name');

                const total = await Transaction.countDocuments(query);

                return res.json({
                    status: 'success',
                    data: {
                        transactions,
                        pagination: {
                            total,
                            page: parseInt(page),
                            pages: Math.ceil(total / limit)
                        }
                    }
                });
            }

            userId = professional.userId; // Use parent account's userId if full access is granted
        }

        const query = { userId };

        if (type) query.type = type;
        if (category) query.category = category;
        if (status) query.status = status;
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        const sort = {};
        sort[sortBy] = order === 'desc' ? -1 : 1;

        const transactions = await Transaction.find(query)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('client', 'name')
            .populate('professional', 'name');

        const total = await Transaction.countDocuments(query);

        res.json({
            status: 'success',
            data: {
                transactions,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Get financial summary
exports.getFinancialSummary = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let userId = req.user._id;

        if (!startDate || !endDate) {
            return res.status(400).json({
                status: 'error',
                message: 'Start date and end date are required'
            });
        }

        // If user is a professional, get their parent account's userId and check permissions
        if (req.user.role === 'professional') {
            const professional = await Professional.findOne({ userAccountId: userId });
            if (!professional) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Professional not found'
                });
            }

            // If professional doesn't have full access, only show their commission data
            if (!professional.permissions.viewFullFinancial) {
                const commissionData = await Transaction.aggregate([
                    {
                        $match: {
                            userId: new mongoose.Types.ObjectId(professional.userId),
                            'professional': professional._id,
                            date: { $gte: new Date(startDate), $lte: new Date(endDate) }
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
                        paidCommission: commissionData.length > 0 ? commissionData[0].paidCommission : 0
                    }
                });
            }

            userId = professional.userId; // Use parent account's userId if full access is granted
        }

        const summaryData = await Transaction.getFinancialSummary(
            new Date(startDate),
            new Date(endDate),
            userId
        );

        // Extract data from the faceted results
        const transactions = summaryData[0]?.transactions || [];
        const commissions = summaryData[0]?.commissions || [];

        // Calculate totals from transactions
        const income = transactions.find(item => item._id === 'income')?.total || 0;
        const expense = transactions.find(item => item._id === 'expense')?.total || 0;
        const profit = income - expense;

        // Calculate commission totals
        const totalPaidCommissions = commissions.find(item => item._id === 'paid')?.total || 0;
        const commissionsCount = commissions.find(item => item._id === 'paid')?.count || 0;

        res.json({
            status: 'success',
            data: {
                summary: transactions,
                totals: {
                    income,
                    expense,
                    profit,
                    totalPaidCommissions,
                    commissionsCount
                }
            }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Update transaction status
exports.updateTransactionStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const transaction = await Transaction.findOne({
            _id: req.params.id,
            userId: req.user.role === 'professional' ? req.user.parentId : req.user._id
        });

        if (!transaction) {
            return res.status(404).json({
                status: 'error',
                message: 'Transaction not found'
            });
        }

        transaction.status = status;
        await transaction.save();

        res.json({
            status: 'success',
            data: { transaction }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Pay commission
exports.payCommission = async (req, res) => {
    try {
        const transaction = await Transaction.findOne({
            _id: req.params.id,
            userId: req.user._id,
            'commission.status': 'pending'
        });

        if (!transaction) {
            return res.status(404).json({
                status: 'error',
                message: 'Transaction not found or commission already paid'
            });
        }

        // Create expense transaction for commission payment
        const commissionTransaction = new Transaction({
            userId: req.user._id,
            type: 'expense',
            category: 'salary',
            amount: transaction.commission.amount,
            description: `Commission payment for transaction ${transaction._id}`,
            paymentMethod: req.body.paymentMethod,
            status: 'paid',
            professional: transaction.professional,
            reference: {
                model: 'Transaction',
                id: transaction._id
            }
        });

        await commissionTransaction.save();

        // Update original transaction's commission status
        transaction.commission.status = 'paid';
        await transaction.save();

        res.json({
            status: 'success',
            data: {
                transaction,
                commissionTransaction
            }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Get transactions with filters
exports.getTransactions = async (req, res) => {
    try {
        const {
            type,
            category,
            status,
            startDate,
            endDate,
            page = 1,
            limit = 10,
            sortBy = 'date',
            order = 'desc'
        } = req.query;

        let userId = req.user._id;

        // If user is a professional, get their parent account's userId and check permissions
        if (req.user.role === 'professional') {
            const professional = await Professional.findOne({ userAccountId: userId });
            if (!professional) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Professional not found'
                });
            }

            // If professional doesn't have full access, only show their commission data
            if (!professional.permissions.viewFullFinancial) {
                const query = {
                    userId: professional.userId,
                    'professional': professional._id
                };

                if (startDate || endDate) {
                    query.date = {};
                    if (startDate) query.date.$gte = new Date(startDate);
                    if (endDate) query.date.$lte = new Date(endDate);
                }

                const transactions = await Transaction.find(query)
                    .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
                    .skip((page - 1) * limit)
                    .limit(limit)
                    .populate('client', 'name')
                    .populate('professional', 'name');

                const total = await Transaction.countDocuments(query);

                return res.json({
                    status: 'success',
                    data: {
                        transactions,
                        pagination: {
                            total,
                            page: parseInt(page),
                            pages: Math.ceil(total / limit)
                        }
                    }
                });
            }

            userId = professional.userId; // Use parent account's userId if full access is granted
        }

        const query = { userId };

        if (type) query.type = type;
        if (category) query.category = category;
        if (status) query.status = status;
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        const sort = {};
        sort[sortBy] = order === 'desc' ? -1 : 1;

        const transactions = await Transaction.find(query)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('client', 'name')
            .populate('professional', 'name');

        const total = await Transaction.countDocuments(query);

        res.json({
            status: 'success',
            data: {
                transactions,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Get financial summary
exports.getFinancialSummary = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let userId = req.user._id;

        if (!startDate || !endDate) {
            return res.status(400).json({
                status: 'error',
                message: 'Start date and end date are required'
            });
        }

        // If user is a professional, get their parent account's userId and check permissions
        if (req.user.role === 'professional') {
            const professional = await Professional.findOne({ userAccountId: userId });
            if (!professional) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Professional not found'
                });
            }

            // If professional doesn't have full access, only show their commission data
            if (!professional.permissions.viewFullFinancial) {
                const commissionData = await Transaction.aggregate([
                    {
                        $match: {
                            userId: professional.userId,
                            'professional': professional._id,
                            date: { $gte: new Date(startDate), $lte: new Date(endDate) }
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
                        paidCommission: commissionData.length > 0 ? commissionData[0].paidCommission : 0
                    }
                });
            }

            userId = professional.userId; // Use parent account's userId if full access is granted
        }

        const summaryData = await Transaction.getFinancialSummary(
            new Date(startDate),
            new Date(endDate),
            userId
        );

        // Extract data from the faceted results
        const transactions = summaryData[0]?.transactions || [];
        const commissions = summaryData[0]?.commissions || [];

        // Calculate totals from transactions
        const income = transactions.find(item => item._id === 'income')?.total || 0;
        const expense = transactions.find(item => item._id === 'expense')?.total || 0;
        const profit = income - expense;

        // Calculate commission totals
        const totalPaidCommissions = commissions.find(item => item._id === 'paid')?.total || 0;
        const commissionsCount = commissions.find(item => item._id === 'paid')?.count || 0;

        res.json({
            status: 'success',
            data: {
                summary: transactions,
                totals: {
                    income,
                    expense,
                    profit,
                    totalPaidCommissions,
                    commissionsCount
                }
            }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Update transaction status
exports.updateTransactionStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const transaction = await Transaction.findOne({
            _id: req.params.id,
            userId: req.user.role === 'professional' ? req.user.parentId : req.user._id
        });

        if (!transaction) {
            return res.status(404).json({
                status: 'error',
                message: 'Transaction not found'
            });
        }

        transaction.status = status;
        await transaction.save();

        res.json({
            status: 'success',
            data: { transaction }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Pay commission
exports.payCommission = async (req, res) => {
    try {
        const transaction = await Transaction.findOne({
            _id: req.params.id,
            userId: req.user._id,
            'commission.status': 'pending'
        });

        if (!transaction) {
            return res.status(404).json({
                status: 'error',
                message: 'Transaction not found or commission already paid'
            });
        }

        // Create expense transaction for commission payment
        const commissionTransaction = new Transaction({
            userId: req.user._id,
            type: 'expense',
            category: 'salary',
            amount: transaction.commission.amount,
            description: `Commission payment for transaction ${transaction._id}`,
            paymentMethod: req.body.paymentMethod,
            status: 'paid',
            professional: transaction.professional,
            reference: {
                model: 'Transaction',
                id: transaction._id
            }
        });

        await commissionTransaction.save();

        // Update original transaction's commission status
        transaction.commission.status = 'paid';
        await transaction.save();

        res.json({
            status: 'success',
            data: {
                transaction,
                commissionTransaction
            }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};