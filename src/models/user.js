const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long']
    },
    phone: {
        type: String,
        trim: true
    },
    role: {
        type: String,
        enum: ['admin', 'owner', 'professional'],
        default: 'owner'
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    plan: {
        type: String,
        enum: ['monthly', 'semiannual', 'annual', 'trial'],
        default: 'trial'
    },
    planExpireAt: {
        type: Date,
        default: () => new Date(+new Date() + 15 * 24 * 60 * 60 * 1000) // 15 days trial by default
    },
    companyName: {
        type: String,
        trim: true
    },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    paymentInfo: {
        type: mongoose.Schema.Types.Mixed,
        select: false // Hide payment info by default
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT token
userSchema.methods.generateAuthToken = function() {
    const token = jwt.sign(
        { 
            _id: this._id,
            role: this.role,
            email: this.email
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
    );
    return token;
};

// Remove sensitive information when converting to JSON
userSchema.methods.toJSON = function() {
    const userObject = this.toObject();
    delete userObject.password;
    delete userObject.paymentInfo;
    return userObject;
};

const User = mongoose.model('User', userSchema);

module.exports = User;