const Professional = require('../models/professional');

const checkPermissions = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            // Skip permission check for admin users
            if (req.user.role === 'admin') {
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

            // If viewOwnDataOnly is true, add professional ID to request for filtering
            if (professional.permissions.viewOwnDataOnly) {
                req.professionalId = professional._id;
            }

            // Check specific permission
            if (requiredPermission && !professional.permissions[requiredPermission]) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Insufficient permissions'
                });
            }

            // Add professional permissions to request object for use in controllers
            req.professionalPermissions = professional.permissions;
            
            next();
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'Error checking permissions'
            });
        }
    };
};

module.exports = checkPermissions;