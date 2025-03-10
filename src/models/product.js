const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Nome do produto é obrigatório'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    purchasePrice: {
        type: Number,
        min: [0, 'Preço de compra não pode ser negativo']
    },
    salePrice: {
        type: Number,
        required: [true, 'Preço de venda é obrigatório'],
        min: [0, 'Preço de venda não pode ser negativo'],
        validate: {
            validator: function(value) {
                return !this.purchasePrice || value >= this.purchasePrice;
            },
            message: 'Preço de venda deve ser maior ou igual ao preço de compra'
        }
    },
    stock: {
        type: Number,
        default: 0,
        min: [0, 'Estoque não pode ser negativo']
    },
    minStock: {
        type: Number,
        default: 5,
        min: [0, 'Estoque mínimo não pode ser negativo']
    },
    brand: {
        type: String,
        trim: true
    },
    category: {
        type: String,
        trim: true
    },
    barcode: {
        type: String,
        trim: true,
        sparse: true
    },
    commissionType: {
        type: String,
        enum: ['none', 'percentage', 'fixed'],
        default: 'none'
    },
    commissionValue: {
        type: Number,
        min: [0, 'Valor da comissão não pode ser negativo'],
        validate: {
            validator: function(value) {
                return this.commissionType === 'none' || value !== undefined;
            },
            message: 'Valor da comissão é obrigatório quando o tipo não é "none"'
        }
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    stockHistory: [{
        date: { type: Date, default: Date.now },
        quantity: Number,
        type: { type: String, enum: ['in', 'out'] },
        reason: String
    }]
}, {
    timestamps: true
});

// Ensure name uniqueness per user
productSchema.index({ userId: 1, name: 1 }, { unique: true });


// Log do índice
console.log('ÍNDICES DO MODELO PRODUCT:');
Object.keys(productSchema.indexes()).forEach(idx => {
    console.log('- Índice:', JSON.stringify(productSchema.indexes()[idx]));
});

// Optional unique barcode per user
productSchema.index({ userId: 1, barcode: 1 }, { unique: true, sparse: true });

// Method to update stock
productSchema.methods.updateStock = async function(quantity, type, reason) {
    const newStock = type === 'in' ? this.stock + quantity : this.stock - quantity;
    
    if (newStock < 0) {
        throw new Error('Operação resultaria em estoque negativo');
    }
    
    this.stock = newStock;
    this.stockHistory.push({
        quantity,
        type,
        reason
    });
    
    return this.save();
};

const Product = mongoose.model('Product', productSchema);

module.exports = Product;