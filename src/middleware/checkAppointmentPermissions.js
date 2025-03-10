const Professional = require('../models/professional');
const User = require('../models/user');

const checkAppointmentPermissions = async (req, res, next) => {
    try {
        // Get the authenticated user
        const user = await User.findById(req.user._id);
        
        // If user is an owner or admin, allow full access
        if (user.role === 'owner' || user.role === 'admin') {
            return next();
        }

        // If user is a professional, check their permissions
        if (user.role === 'professional') {
            const professional = await Professional.findOne({ userAccountId: user._id });
            
            if (!professional) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Professional profile not found'
                });
            }

            // Check if professional has schedule management permission
            if (!professional.permissions.manageSchedule) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You do not have permission to manage appointments'
                });
            }

            // For GET requests, filter by professional ID if viewing own data only
            if (req.method === 'GET' && professional.permissions.viewOwnDataOnly) {
                req.query.professionalId = professional._id;
            }

            // For POST/PUT requests, ensure professional can only create/update their own appointments
            if (['POST', 'PUT'].includes(req.method)) {
                if (professional.permissions.viewOwnDataOnly && 
                    req.body.professionalId && 
                    req.body.professionalId.toString() !== professional._id.toString()) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'You can only manage your own appointments'
                    });
                }
            }
        }

        next();
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Error checking appointment permissions',
            error: error.message
        });
    }
};

module.exports = checkAppointmentPermissions;