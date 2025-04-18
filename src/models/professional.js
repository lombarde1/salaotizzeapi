const mongoose = require('mongoose');

const professionalSchema = new mongoose.Schema({
    specialties: [{
        type: String,
        trim: true
    }],
    workingHours: {
        monday: {
            start: String,
            end: String
        },
        tuesday: {
            start: String,
            end: String
        },
        wednesday: {
            start: String,
            end: String
        },
        thursday: {
            start: String,
            end: String
        },
        friday: {
            start: String,
            end: String
        },
        saturday: {
            start: String,
            end: String
        },
        sunday: {
            start: String,
            end: String
        }
    },
    address: {
        street: String,
        number: String,
        complement: String,
        neighborhood: String,
        city: String,
        state: String,
        zipCode: String
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    phone: {
        type: String,
        trim: true,
        validate: {
            validator: function(v) {
                // Allow empty string (optional) or validate phone format
                return !v || /^\d+$/.test(v);
            },
            message: 'Phone number should contain only digits'
        }
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        validate: {
            validator: function(v) {
                // Allow empty string (optional) or validate email format
                return !v || /^\S+@\S+\.\S+$/.test(v);
            },
            message: 'Please enter a valid email'
        }
    },
    cpf: {
        type: String,
        trim: true
    },
    role: {
        type: String,
        required: [true, 'Professional role is required'],
        trim: true
    },
    services: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
    }],
    // Campos de comissão
    commissionType: {
        type: String,
        enum: ['percentage', 'fixed', null],
        default: 'percentage'
    },
    commissionValue: {
        type: Number,
        default: 0,
        min: 0,
        validate: {
            validator: function(value) {
                // Se o tipo for percentual, o valor deve estar entre 0 e 100
                if (this.commissionType === 'percentage') {
                    return value >= 0 && value <= 100;
                }
                // Se for valor fixo, só precisa ser não-negativo
                return value >= 0;
            },
            message: props => props.type === 'percentage' 
                ? 'Percentage commission must be between 0 and 100'
                : 'Commission value must be non-negative'
        }
    },
    permissions: {
        viewFullDashboard: {
            type: Boolean,
            default: false
        },
        viewOwnDataOnly: {
            type: Boolean,
            default: true
        },
        accessFinancialData: {
            type: Boolean,
            default: false
        },
        viewFullFinancial: {
            type: Boolean,
            default: false
        },
        manageClients: {
            type: Boolean,
            default: false
        },
        manageSchedule: {
            type: Boolean,
            default: true
        },
        manageProducts: {
            type: Boolean,
            default: false
        },
        manageServices: {
            type: Boolean,
            default: false
        }
    },
    userAccountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, {
    timestamps: true
});

// Create indexes for frequently queried fields
professionalSchema.index({ userId: 1, name: 1 });
professionalSchema.index({ userId: 1, role: 1 });
professionalSchema.index({ userId: 1, status: 1 });

// Create compound index for search functionality
professionalSchema.index(
    { 
        userId: 1,
        name: 'text',
        role: 'text'
    },
    {
        weights: {
            name: 3,
            role: 2
        }
    }
);

const Professional = mongoose.model('Professional', professionalSchema);

module.exports = Professional;