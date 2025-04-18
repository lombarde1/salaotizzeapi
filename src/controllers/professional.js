const Professional = require('../models/professional');
const User = require('../models/user');

/**
 * Create new professional
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.createProfessional = async (req, res) => {
    try {
        // Prepare permissions object from array if provided
        let permissions = {
            viewFullDashboard: false,
            viewOwnDataOnly: true,
            accessFinancialData: false,
            viewFullFinancial: false,
            manageProducts: false,
            manageServices: false,
            manageSchedule: true,
            manageClients: false
        };

        // Override defaults if permissions array is provided
        if (Array.isArray(req.body.permissions)) {
            Object.keys(permissions).forEach(perm => {
                permissions[perm] = req.body.permissions.includes(perm);
            });
        }

        const professional = new Professional({
            ...req.body,
            userId: req.user._id,
            permissions
        });

        await professional.save();

        // Create user account if email and password provided
        if (req.body.email && req.body.password) {
            const user = new User({
                name: professional.name,
                email: req.body.email,
                password: req.body.password,
                role: 'professional',
                parentId: req.user._id
            });

            await user.save();
            professional.userAccountId = user._id;
            await professional.save();
        }

        res.status(201).json({
            status: 'success',
            data: { professional }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

/**
 * List professionals with filtering and sorting
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.listProfessionals = async (req, res) => {
    try {
        const query = { userId: req.user._id };
        
        // Apply filters
        if (req.query.status) query.status = req.query.status;
        if (req.query.role) query.role = req.query.role;
        if (req.query.search) query.$text = { $search: req.query.search };
        
        // Apply sorting
        let sort = { name: 1 }; // Default sort
        
        if (req.query.sortBy) {
            const parts = req.query.sortBy.split(':');
            sort = { [parts[0]]: parts[1] === 'desc' ? -1 : 1 };
        }

        // Execute query
        const professionals = await Professional.find(query)
            .select('name phone email cpf role services permissions status workingHours specialties address userAccountId createdAt updatedAt')
            .sort(sort);

        res.json({
            status: 'success',
            data: { professionals }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

/**
 * Get professional by ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getProfessional = async (req, res) => {
    try {
        const professional = await Professional.findOne({
            _id: req.params.id,
            userId: req.user._id
        }).lean();

        if (!professional) {
            return res.status(404).json({
                status: 'error',
                message: 'Professional not found'
            });
        }

        // Check if professional has user account
        const hasAccount = !!professional.userAccountId;
        let accountEmail = null;
        
        if (hasAccount) {
            const user = await User.findById(professional.userAccountId).select('email');
            accountEmail = user ? user.email : null;
        }

        res.json({
            status: 'success',
            data: { 
                professional,
                hasAccount,
                accountEmail
            }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

/**
 * Update professional
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.updateProfessional = async (req, res) => {
    try {
        // Handle permissions array conversion
        if (Array.isArray(req.body.permissions)) {
            const permissionsObject = {};
            const availablePermissions = [
                'viewFullDashboard', 'viewOwnDataOnly', 'accessFinancialData',
                'viewFullFinancial', 'manageProducts', 'manageServices',
                'manageSchedule', 'manageClients'
            ];
            
            availablePermissions.forEach(perm => {
                permissionsObject[perm] = req.body.permissions.includes(perm);
            });
            
            req.body.permissions = permissionsObject;
        }

        const updates = Object.keys(req.body);
        const allowedUpdates = [
            'name', 'phone', 'email', 'cpf', 'role', 'status',
            'permissions', 'workingHours', 'specialties', 'address'
        ];
        
        const isValidOperation = updates.every(update => allowedUpdates.includes(update));

        if (!isValidOperation) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid updates'
            });
        }

        const professional = await Professional.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!professional) {
            return res.status(404).json({
                status: 'error',
                message: 'Professional not found'
            });
        }

        // Update each field
        updates.forEach(update => {
            professional[update] = req.body[update];
        });
        
        await professional.save();

        // Update user account if exists
        if (professional.userAccountId && req.body.email) {
            await User.findByIdAndUpdate(professional.userAccountId, {
                name: req.body.name,
                email: req.body.email,
                phone: req.body.phone
            });
        }

        res.json({
            status: 'success',
            data: { professional }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

/**
 * Update commission settings
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.updateCommission = async (req, res) => {
    try {
        const { commissionType, commissionValue } = req.body;

        // Validate commission data
        if (!commissionType || !commissionValue) {
            return res.status(400).json({
                status: 'error',
                message: 'Commission type and value are required'
            });
        }

        const professional = await Professional.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!professional) {
            return res.status(404).json({
                status: 'error',
                message: 'Professional not found'
            });
        }

        // Update schema to include commission fields if not already there
        const updatedProfessional = await Professional.findByIdAndUpdate(
            professional._id,
            { 
                $set: { 
                    commissionType,
                    commissionValue: parseFloat(commissionValue)
                }
            },
            { new: true }
        );

        res.json({
            status: 'success',
            data: { professional: updatedProfessional }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

/**
 * Deactivate professional
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.deleteProfessional = async (req, res) => {
    try {
        const professional = await Professional.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!professional) {
            return res.status(404).json({
                status: 'error',
                message: 'Professional not found'
            });
        }

        // Soft delete by marking as inactive
        professional.status = 'inactive';
        await professional.save();

        // Deactivate user account if exists
        if (professional.userAccountId) {
            await User.findByIdAndUpdate(professional.userAccountId, { status: 'inactive' });
        }

        res.json({
            status: 'success',
            message: 'Professional deactivated successfully'
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

/**
 * Create user account for professional
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.createProfessionalAccount = async (req, res) => {
    try {
        const professional = await Professional.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!professional) {
            return res.status(404).json({
                status: 'error',
                message: 'Professional not found'
            });
        }

        if (professional.userAccountId) {
            return res.status(400).json({
                status: 'error',
                message: 'Professional already has an account'
            });
        }

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Email and password are required'
            });
        }

        // Create new user account
        const parentUser = await User.findById(req.user._id);
        const user = new User({
            name: professional.name,
            email: professional.email || email,
            phone: professional.phone,
            cpf: professional.cpf,
            password,
            role: 'professional',
            status: 'active',
            parentId: req.user._id,
            companyName: parentUser?.companyName,
            plan: parentUser?.plan,
            planValidUntil: parentUser?.planValidUntil
        });

        await user.save();

        // Link account to professional
        professional.userAccountId = user._id;
        await professional.save();

        res.status(201).json({
            status: 'success',
            message: 'Professional account created successfully',
            data: {
                professionalId: professional._id,
                email
            }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};