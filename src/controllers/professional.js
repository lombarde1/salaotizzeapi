const Professional = require('../models/professional');
const User = require('../models/user');

// Create new professional
exports.createProfessional = async (req, res) => {
    try {
        const professional = new Professional({
            ...req.body,
            userId: req.user._id,
            role: 'professional', // Set default role
            permissions: {
                viewFullDashboard: req.body.permissions?.includes('viewFullDashboard') || false,
                viewOwnDataOnly: req.body.permissions?.includes('viewOwnDataOnly') || true,
                accessFinancialData: req.body.permissions?.includes('accessFinancialData') || false,
                manageProducts: req.body.permissions?.includes('manageProducts') || false,
                manageServices: req.body.permissions?.includes('manageServices') || false,
                manageSchedule: req.body.permissions?.includes('manageSchedule') || false,
                manageClients: req.body.permissions?.includes('manageClients') || false
            }
        });

        await professional.save();

        // If creating a professional account, set role as 'professional'
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

// Update professional commission settings
exports.updateCommission = async (req, res) => {
    try {
        const { commissionType, commissionValue } = req.body;

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

        professional.commissionType = commissionType;
        professional.commissionValue = commissionValue;
        await professional.save();

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

// List professionals with filters
exports.listProfessionals = async (req, res) => {
    try {
        const query = { userId: req.user._id };

// Update professional commission settings
exports.updateCommission = async (req, res) => {
    try {
        const { commissionType, commissionValue } = req.body;

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

        professional.commissionType = commissionType;
        professional.commissionValue = commissionValue;
        await professional.save();

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

        // Apply filters
        if (req.query.status) query.status = req.query.status;
        if (req.query.role) query.role = req.query.role;
        if (req.query.search) {
            query.$text = { $search: req.query.search };

// Update professional commission settings
exports.updateCommission = async (req, res) => {
    try {
        const { commissionType, commissionValue } = req.body;

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

        professional.commissionType = commissionType;
        professional.commissionValue = commissionValue;
        await professional.save();

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
        }

        // Apply sorting
        let sort = {};

// Update professional commission settings
exports.updateCommission = async (req, res) => {
    try {
        const { commissionType, commissionValue } = req.body;

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

        professional.commissionType = commissionType;
        professional.commissionValue = commissionValue;
        await professional.save();

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
        if (req.query.sortBy) {
            const parts = req.query.sortBy.split(':');
            sort[parts[0]] = parts[1] === 'desc' ? -1 : 1;
        } else {
            sort = { name: 1 };

// Update professional commission settings
exports.updateCommission = async (req, res) => {
    try {
        const { commissionType, commissionValue } = req.body;

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

        professional.commissionType = commissionType;
        professional.commissionValue = commissionValue;
        await professional.save();

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
        }

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

// Update professional commission settings
exports.updateCommission = async (req, res) => {
    try {
        const { commissionType, commissionValue } = req.body;

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

        professional.commissionType = commissionType;
        professional.commissionValue = commissionValue;
        await professional.save();

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

// Get professional by ID
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

        // Check if the professional has account credentials
        const user = await User.findOne({ _id: professional.userId }).select('_id email');
        const hasCredentials = !!user;

        res.json({
            status: 'success',
            data: { 
                professional,
                hasCredentials
            }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Update professional commission settings
exports.updateCommission = async (req, res) => {
    try {
        const { commissionType, commissionValue } = req.body;

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

        professional.commissionType = commissionType;
        professional.commissionValue = commissionValue;
        await professional.save();

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

// Update professional
exports.updateProfessional = async (req, res) => {
    try {
        const updates = Object.keys(req.body);
        const allowedUpdates = ['name', 'phone', 'email', 'cpf', 'role', 'status', 'permissions'];
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

        updates.forEach(update => professional[update] = req.body[update]);
        await professional.save();

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

// Update professional commission settings
exports.updateCommission = async (req, res) => {
    try {
        const { commissionType, commissionValue } = req.body;

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

        professional.commissionType = commissionType;
        professional.commissionValue = commissionValue;
        await professional.save();

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

// Delete/Deactivate professional
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

        professional.status = 'inactive';
        await professional.save();

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

// Update professional commission settings
exports.updateCommission = async (req, res) => {
    try {
        const { commissionType, commissionValue } = req.body;

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

        professional.commissionType = commissionType;
        professional.commissionValue = commissionValue;
        await professional.save();

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

// Create user account for professional
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

        // Generate a temporary password
        const temporaryPassword = password;

        // Create new user account with role 'professional'
        const parentUser = await User.findById(req.user._id);
        const user = new User({
            name: professional.name,
            email: professional.email || email,
            phone: professional.phone,
            cpf: professional.cpf,
            password: temporaryPassword,
            role: 'professional',
            status: 'active',
            parentId: req.user._id,
            companyName: parentUser.companyName,
            plan: parentUser.plan,
            planValidUntil: parentUser.planValidUntil
        });

        await user.save();

        // Link user account to professional
        professional.userAccountId = user._id;
        await professional.save();

        res.status(201).json({
            message: 'Professional account created successfully',
            professionalId: professional._id,
            credentials: {
                email: email,
                temporaryPassword: temporaryPassword
            }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Update professional commission settings
exports.updateCommission = async (req, res) => {
    try {
        const { commissionType, commissionValue } = req.body;

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

        professional.commissionType = commissionType;
        professional.commissionValue = commissionValue;
        await professional.save();

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