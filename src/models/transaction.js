// Atualize seu modelo de Transaction em models/transaction.js
// Adicione o campo "items" ao schema existente

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['income', 'expense'],
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['service', 'product', 'salary', 'rent', 'supplies', 'utilities', 'other']
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        trim: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['cash', 'credit_card', 'debit_card', 'pix', 'transfer']
    },
    status: {
        type: String,
        required: true,
        enum: ['paid', 'pending', 'cancelled'],
        default: 'pending'
    },
    reference: {
        model: String,
        id: mongoose.Schema.Types.ObjectId
    },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client'
    },
    professional: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Professional'
    },
    commission: {
        type: {
            type: String,
            enum: ['percentage', 'fixed']
        },
        value: Number,
        amount: Number,
        status: {
            type: String,
            enum: ['pending', 'paid', 'cancelled'],
            default: 'pending'
        }
    },
    // Novo campo para armazenar múltiplos produtos
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },
        name: String,
        quantity: {
            type: Number,
            min: 1,
            required: true
        },
        price: {
            type: Number,
            min: 0,
            required: true
        },
        totalPrice: {
            type: Number,
            min: 0,
            required: true
        },
        commission: {
            type: {
                type: String,
                enum: ['percentage', 'fixed']
            },
            value: Number,
            amount: Number,
            status: {
                type: String,
                enum: ['pending', 'paid', 'cancelled'],
                default: 'pending'
            }
        }
    }]
}, {
    timestamps: true
});

// Middleware to validate amount is non-negative
transactionSchema.pre('save', function(next) {
    if (this.amount < 0) {
        next(new Error('Amount cannot be negative'));
    }
    next();
});

// Method to calculate commission
// Método para calcular comissão baseada no profissional em vez do produto/serviço
transactionSchema.methods.calculateCommission = function(professional) {
    if (!professional || !professional.commissionType || !professional.commissionValue) {
        return 0;
    }
    
    return professional.commissionType === 'percentage' 
        ? (this.amount * professional.commissionValue) / 100
        : professional.commissionValue;
};

// Static method to get financial summary
transactionSchema.statics.getFinancialSummary = async function(startDate, endDate, userId) {
    return this.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                date: { $gte: startDate, $lte: endDate },
                status: { $ne: 'cancelled' }
            }
        },
        {
            $group: {
                _id: '$type',
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);
};

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;