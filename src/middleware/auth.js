const jwt = require('jsonwebtoken');
const User = require('../models/user');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                status: 'error',
                message: 'No authentication token provided'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await User.findOne({ _id: decoded._id, status: 'active' });

        if (!user) {
            throw new Error('User not found or inactive');
        }

        // Check if user's plan has expired
        if (user.planExpireAt && new Date() > user.planExpireAt) {
            return res.status(403).json({
                status: 'error',
                message: 'Your plan has expired. Please renew your subscription.'
            });
        }

        req.token = token;
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({
            status: 'error',
            message: 'Please authenticate',
            error: error.message
        });
    }
};

module.exports = auth;