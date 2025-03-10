const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
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
    city: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    totalSpent: {
        type: Number,
        default: 0,
        min: [0, 'Total spent cannot be negative']
    },
    lastVisit: {
        type: Date
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
clientSchema.index({ userId: 1, name: 1 });
clientSchema.index({ userId: 1, phone: 1 });
clientSchema.index({ userId: 1, email: 1 });

// Create compound index for search functionality
clientSchema.index(
    { 
        userId: 1,
        name: 'text',
        phone: 'text',
        email: 'text'
    },
    {
        weights: {
            name: 3,
            phone: 2,
            email: 1
        }
    }
);

const Client = mongoose.model('Client', clientSchema);

module.exports = Client;