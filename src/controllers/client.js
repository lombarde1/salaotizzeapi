const Client = require('../models/client');

// Create new client
exports.createClient = async (req, res) => {
    try {
        const client = new Client({
            ...req.body,
            userId: req.user.role === 'professional' ? req.user.parentId : req.user._id
        });

        await client.save();
        res.status(201).json({
            status: 'success',
            data: { client }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// List clients with pagination and filters
exports.listClients = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // If user is a professional, use the parent's ID to fetch clients
        const query = { userId: req.user.role === 'professional' ? req.user.parentId : req.user._id };

        // Apply filters
        if (req.query.status) query.status = req.query.status;
        if (req.query.search) {
            query.$text = { $search: req.query.search };
        }

        // Apply sorting
        let sort = {};
        if (req.query.sortBy) {
            const parts = req.query.sortBy.split(':');
            sort[parts[0]] = parts[1] === 'desc' ? -1 : 1;
        } else {
            sort = { name: 1 };
        }

        const clients = await Client.find(query)
            .sort(sort)
            .limit(limit)
            .skip(skip);

        const total = await Client.countDocuments(query);

        res.json({
            status: 'success',
            data: {
                clients,
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Quick search for autocomplete
exports.quickSearch = async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({
                status: 'error',
                message: 'Search query is required'
            });
        }

        const clients = await Client.find(
            {
                userId: req.user.role === 'professional' ? req.user.parentId : req.user._id,
                $text: { $search: query }
            },
            { name: 1, phone: 1, score: { $meta: 'textScore' } }
        )
            .sort({ score: { $meta: 'textScore' } })
            .limit(10);

        res.json({
            status: 'success',
            data: { clients }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Get client by ID
exports.getClient = async (req, res) => {
    try {
        const client = await Client.findOne({
            _id: req.params.id,
            userId: req.user.role === 'professional' ? req.user.parentId : req.user._id
        });

        if (!client) {
            return res.status(404).json({
                status: 'error',
                message: 'Client not found'
            });
        }

        res.json({
            status: 'success',
            data: { client }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Update client
exports.updateClient = async (req, res) => {
    try {
        const updates = Object.keys(req.body);
        const allowedUpdates = ['name', 'phone', 'email', 'cpf', 'city', 'description', 'status'];
        const isValidOperation = updates.every(update => allowedUpdates.includes(update));

        if (!isValidOperation) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid updates'
            });
        }

        const client = await Client.findOne({
            _id: req.params.id,
            userId: req.user.role === 'professional' ? req.user.parentId : req.user._id
        });

        if (!client) {
            return res.status(404).json({
                status: 'error',
                message: 'Client not found'
            });
        }

        updates.forEach(update => client[update] = req.body[update]);
        await client.save();

        res.json({
            status: 'success',
            data: { client }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Delete/Deactivate client
exports.deleteClient = async (req, res) => {
    try {
        const client = await Client.findOne({
            _id: req.params.id,
            userId: req.user.role === 'professional' ? req.user.parentId : req.user._id
        });

        if (!client) {
            return res.status(404).json({
                status: 'error',
                message: 'Client not found'
            });
        }

        client.status = 'inactive';
        await client.save();

        res.json({
            status: 'success',
            message: 'Client deactivated successfully'
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Get client history (placeholder for future module)
exports.getClientHistory = async (req, res) => {
    try {
        const client = await Client.findOne({
            _id: req.params.id,
            userId: req.user.role === 'professional' ? req.user.parentId : req.user._id
        });

        if (!client) {
            return res.status(404).json({
                status: 'error',
                message: 'Client not found'
            });
        }

        // Placeholder for future service history implementation
        res.json({
            status: 'success',
            data: {
                client,
                history: []
            }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};