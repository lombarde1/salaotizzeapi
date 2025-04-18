const Transaction = require('../models/transaction');
const Product = require('../models/product');
const Service = require('../models/service');
const Professional = require('../models/professional');
const Client = require('../models/client');
const notificationService = require('../services/notification');
const mongoose = require('mongoose');


// Adicione esta nova função ao arquivo controllers/transaction.js

// Register multiple product sales in a single transaction
exports.registerMultipleProducts = async (req, res) => {
    try {
        const { clientId, items, paymentMethod, date, notes } = req.body;

        // Validate request body
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Items array is required with at least one product'
            });
        }

        // Process each product
        const processedItems = [];
        let totalAmount = 0;

        for (const item of items) {
            const { productId, quantity } = item;
            
            // Validate product and check stock
            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({
                    status: 'error',
                    message: `Product ${productId} not found`
                });
            }

            if (product.stock < quantity) {
                return res.status(400).json({
                    status: 'error',
                    message: `Insufficient stock for product ${product.name}. Available: ${product.stock}`
                });
            }

            // Calculate item total
            const itemTotal = product.salePrice * quantity;
            totalAmount += itemTotal;

            // Add to processed items with all needed info
            processedItems.push({
                productId: product._id,
                name: product.name,
                quantity: quantity,
                price: product.salePrice,
                totalPrice: itemTotal,
                commission: product.commissionType && product.commissionValue ? {
                    type: product.commissionType,
                    value: product.commissionValue,
                    amount: product.commissionType === 'percentage' 
                        ? (itemTotal * product.commissionValue) / 100 
                        : product.commissionValue,
                    status: 'pending'
                } : undefined
            });

            // Update product stock
            await Product.findByIdAndUpdate(productId, {
                $inc: { stock: -quantity }
            });
        }

        // Create transaction with all items
        const transaction = new Transaction({
            userId: req.user.role === 'professional' ? req.user.parentId : req.user._id,
            type: 'income',
            category: 'product',
            amount: totalAmount,
            description: notes,
            paymentMethod,
            date: date || Date.now(),
            status: 'paid',
            client: clientId,
            items: processedItems
        });

        await transaction.save();

        // Update client's total spent
        if (clientId) {
            await Client.findByIdAndUpdate(clientId, {
                $inc: { totalSpent: totalAmount }
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
// Register a service transaction
exports.registerService = async (req, res) => {
    try {
        console.log("Iniciando registerService com dados:", {
            serviceId: req.body.serviceId,
            professionalId: req.body.professionalId,
            amount: req.body.amount
        });

        const { serviceId, clientId, professionalId, amount, paymentMethod, date, notes } = req.body;

        // Validar serviço
        const service = await Service.findById(serviceId);
        if (!service) {
            console.log("Serviço não encontrado:", serviceId);
            return res.status(404).json({
                status: 'error',
                message: 'Service not found'
            });
        }
        console.log("Serviço encontrado:", service.name);

        // Obter configurações de comissão do profissional
        const professional = await Professional.findById(professionalId);
        if (!professional) {
            console.log("Profissional não encontrado:", professionalId);
            return res.status(404).json({
                status: 'error',
                message: 'Professional not found'
            });
        }
        
        console.log("Profissional encontrado:", {
            id: professional._id,
            name: professional.name,
            commissionType: professional.commissionType,
            commissionValue: professional.commissionValue,
            userId: professional.userId,
            userAccountId: professional.userAccountId
        });

        // ID do usuário atual (dono)
        const currentUserId = req.user.role === 'professional' ? req.user.parentId : req.user._id;
        console.log("ID do usuário atual (dono):", currentUserId);
        
        // Verificar se o profissional é o dono
        // Um profissional é considerado como dono se:
        // 1. O ID do usuário logado é igual ao userAccountId do profissional
        // OU
        // 2. Não existe conta de usuário para o profissional (userAccountId é nulo)
        //    e a requisição está sendo feita pelo dono que cadastrou o profissional
        const isProfessionalOwner = 
            (professional.userAccountId && professional.userAccountId.toString() === req.user._id.toString()) ||
            (!professional.userAccountId && professional.userId.toString() === currentUserId.toString() && req.user._id.toString() === currentUserId.toString());
        
        console.log("O profissional é o dono?", isProfessionalOwner);

        // Criar transação principal
        const transaction = new Transaction({
            userId: currentUserId,
            type: 'income',
            category: 'service',
            amount,
            description: notes,
            paymentMethod,
            date: date || Date.now(),
            status: 'paid',
            client: clientId,
            professional: professionalId,
            reference: {
                model: 'Service',
                id: serviceId
            },
            commission: {
                status: 'pending' // Inicializar com status pendente
            }
        });

        // Calcular comissão baseada apenas no profissional
        let commissionAmount = 0;
        
        // Calcular comissão apenas se o profissional não for o proprietário
        if (!isProfessionalOwner) {
            console.log('Profissional não é o proprietário, calculando comissão...');
            
            if (professional.commissionType && professional.commissionValue !== undefined) {
                console.log(`Usando config: type=${professional.commissionType}, value=${professional.commissionValue}`);
                
                if (professional.commissionType === 'percentage') {
                    commissionAmount = (professional.commissionValue / 100) * amount;
                    console.log(`Cálculo percentual: (${professional.commissionValue}/100) * ${amount} = ${commissionAmount}`);
                } else if (professional.commissionType === 'fixed') {
                    commissionAmount = professional.commissionValue;
                    console.log(`Valor fixo: ${commissionAmount}`);
                }
                
                // Adicionar valor da comissão à transação
                transaction.commission.amount = commissionAmount;
                console.log("Comissão adicionada à transação:", commissionAmount);
            } else {
                console.log("Profissional não tem configuração de comissão válida");
            }
        } else {
            console.log("Comissão não calculada: profissional é o proprietário");
        }

        console.log("Transação antes de salvar:", {
            id: transaction._id,
            amount: transaction.amount,
            commission: transaction.commission
        });
        
        await transaction.save();
        
        console.log("Transação após salvar:", {
            id: transaction._id,
            amount: transaction.amount,
            commission: transaction.commission
        });

        // Criar notificação de comissão para o profissional
        if (commissionAmount > 0 && professional.userAccountId) {
            console.log("Criando notificação para o profissional", professional.userAccountId);
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
        } else {
            console.log("Não criando notificação:", {
                commissionAmount,
                hasUserAccount: !!professional.userAccountId
            });
        }

        // Atualizar última visita e total gasto do cliente
        if (clientId) {
            await Client.findByIdAndUpdate(clientId, {
                $set: { lastVisit: date || Date.now() },
                $inc: { totalSpent: amount }
            });
            console.log("Cliente atualizado:", clientId);
        }

        console.log("Completando registerService com sucesso");
        res.status(201).json({
            status: 'success',
            data: { transaction }
        });
    } catch (error) {
        console.error("Erro em registerService:", error);
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Register a product sale
// Register a product sale
exports.registerProductSale = async (req, res) => {
    try {
        const { productId, quantity, clientId, professionalId, paymentMethod, date } = req.body;

        // Validar produto e verificar estoque
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

        // Calcular valor total
        const amount = product.salePrice * quantity;

        // Obter profissional se foi especificado
        let professional = null;
        if (professionalId) {
            professional = await Professional.findById(professionalId);
            if (!professional) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Professional not found'
                });
            }
        }

        // Criar transação
        const transaction = new Transaction({
            userId: req.user.role === 'professional' ? req.user.parentId : req.user._id,
            type: 'income',
            category: 'product',
            amount,
            paymentMethod,
            date: date || Date.now(),
            status: 'paid',
            client: clientId,
            professional: professionalId, // Agora também guardamos o vendedor para produtos
            reference: {
                model: 'Product',
                id: productId
            }
        });

        // Adicionar comissão se tiver um profissional associado
        if (professional && professional.userId.toString() !== req.user._id.toString()) {
            const commissionAmount = transaction.calculateCommission(professional);

            transaction.commission = {
                type: professional.commissionType,
                value: professional.commissionValue,
                amount: commissionAmount,
                status: 'pending' // Sempre pendente até pagamento explícito
            };
            
            // Criar notificação para o profissional
            if (commissionAmount > 0 && professional.userAccountId) {
                await notificationService.createNotification({
                    userId: professional.userAccountId,
                    title: "Comissão Disponível",
                    message: `Você tem uma nova comissão disponível de R$ ${commissionAmount.toFixed(2)} pela venda de produto`,
                    type: "commission_available",
                    relatedTo: {
                        model: "Transaction",
                        id: transaction._id
                    }
                });
            }
        }

        await transaction.save();

        // Atualizar estoque do produto
        await Product.findByIdAndUpdate(productId, {
            $inc: { stock: -quantity }
        });

        // Atualizar total gasto do cliente
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