const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Nome do serviço é obrigatório'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    price: {
        type: Number,
        required: [true, 'Preço é obrigatório'],
        min: [0, 'Preço não pode ser negativo']
    },
    duration: {
        type: Number,
        min: [0, 'Duração não pode ser negativa']
    },
    category: {
        type: String,
        trim: true
    },
    commissionType: {
        type: String,
        enum: ['fixed', 'percentage'],
        default: 'percentage'
    },
    commissionValue: {
        type: Number,
        min: [0, 'Valor da comissão não pode ser negativo']
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    priceRange: {
        min: {
            type: Number,
            min: [0, 'Preço mínimo não pode ser negativo']
        },
        max: {
            type: Number,
            validate: {
                validator: function(value) {
                    return !this.priceRange.min || value >= this.priceRange.min;
                },
                message: 'Preço máximo deve ser maior que o preço mínimo'
            }
        }
    }
}, {
    timestamps: true
});

// Ensure name uniqueness per user
serviceSchema.index({ userId: 1, name: 1 }, { unique: true });

// Pre-save middleware to validate price range
serviceSchema.pre('save', function(next) {
    if (this.priceRange.min && this.priceRange.max) {
        if (this.price < this.priceRange.min || this.price > this.priceRange.max) {
            next(new Error('Preço deve estar dentro da faixa definida'));
        }
    }
    next();
});

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;