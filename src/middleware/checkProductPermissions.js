const Professional = require('../models/professional');

const checkProductPermissions = async (req, res, next) => {
    try {
        // Skip permission check for admin and owner users
        if (req.user.role === 'admin' || req.user.role === 'owner') {
            return next();
        }

        // Get professional details for the current user
        const professional = await Professional.findOne({ userAccountId: req.user._id });
        
        if (!professional) {
            return res.status(403).json({
                status: 'error',
                message: 'Professional profile not found'
            });
        }

        // Check if the professional is active
        if (professional.status !== 'active') {
            return res.status(403).json({
                status: 'error',
                message: 'Professional account is inactive'
            });
        }

        // Check product management permission
        if (!professional.permissions.manageProducts) {
            return res.status(403).json({
                status: 'error',
                message: 'You do not have permission to manage products'
            });
        }

        next();
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Error checking product permissions'
        });
    }
};

module.exports = checkProductPermissions;