const Service = require('../models/service');
const { validationResult } = require('express-validator');

// Create new service
exports.createService = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ status: 'error', errors: errors.array() });
        }

        let userId = req.user._id;

        // If user is a professional, get their parent account's userId
        if (req.user.role === 'professional') {
            const Professional = require('../models/professional');
            const professional = await Professional.findOne({ userAccountId: req.user._id });
            if (professional) {
                userId = professional.userId; // This is the owner's/company's userId
            }
        }

        const service = new Service({
            ...req.body,
            userId
        });

        await service.save();

        res.status(201).json({
            status: 'success',
            data: { service }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                status: 'error',
                message: 'Já existe um serviço com este nome'
            });
        }
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// List services with filters and pagination
exports.getServices = async (req, res) => {
    try {
        const { category, status, sortBy, order, page = 1, limit = 10 } = req.query;
        let userId = req.user._id;

        // If user is a professional, get their parent account's userId
        if (req.user.role === 'professional') {
            const Professional = require('../models/professional');
            const professional = await Professional.findOne({ userAccountId: req.user._id });
            if (professional) {
                userId = professional.userId; // This is the owner's/company's userId
            }
        }

        const query = { userId };
        const sort = {};

        if (category) query.category = category;
        if (status) query.status = status;
        if (sortBy) sort[sortBy] = order === 'desc' ? -1 : 1;

        const services = await Service.find(query)
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Service.countDocuments(query);

        res.json({
            status: 'success',
            data: {
                services,
                total,
                pages: Math.ceil(total / limit),
                currentPage: page
            }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Get service by ID
exports.getService = async (req, res) => {
    try {
        let userId = req.user._id;

        // If user is a professional, get their parent account's userId
        if (req.user.role === 'professional') {
            const Professional = require('../models/professional');
            const professional = await Professional.findOne({ userAccountId: req.user._id });
            if (professional) {
                userId = professional.userId; // This is the owner's/company's userId
            }
        }

        const service = await Service.findOne({
            _id: req.params.id,
            userId
        });

        if (!service) {
            return res.status(404).json({
                status: 'error',
                message: 'Serviço não encontrado'
            });
        }

        res.json({
            status: 'success',
            data: { service }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Update service
exports.updateService = async (req, res) => {
    try {
        const updates = Object.keys(req.body);
        const allowedUpdates = ['name', 'description', 'price', 'duration', 'category', 
                               'commissionType', 'commissionValue', 'status', 'priceRange'];
        const isValidOperation = updates.every(update => allowedUpdates.includes(update));

        if (!isValidOperation) {
            return res.status(400).json({
                status: 'error',
                message: 'Atualizações inválidas'
            });
        }

        let userId = req.user._id;

        // If user is a professional, get their parent account's userId
        if (req.user.role === 'professional') {
            const Professional = require('../models/professional');
            const professional = await Professional.findOne({ userAccountId: req.user._id });
            if (professional) {
                userId = professional.userId; // This is the owner's/company's userId
            }
        }

        const service = await Service.findOne({
            _id: req.params.id,
            userId
        });

        if (!service) {
            return res.status(404).json({
                status: 'error',
                message: 'Serviço não encontrado'
            });
        }

        updates.forEach(update => service[update] = req.body[update]);
        await service.save();

        res.json({
            status: 'success',
            data: { service }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                status: 'error',
                message: 'Já existe um serviço com este nome'
            });
        }
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Delete (deactivate) service
exports.deleteService = async (req, res) => {
    try {
        let userId = req.user._id;

        // If user is a professional, get their parent account's userId
        if (req.user.role === 'professional') {
            const Professional = require('../models/professional');
            const professional = await Professional.findOne({ userAccountId: req.user._id });
            if (professional) {
                userId = professional.userId; // This is the owner's/company's userId
            }
        }

        const service = await Service.findOne({
            _id: req.params.id,
            userId
        });

        if (!service) {
            return res.status(404).json({
                status: 'error',
                message: 'Serviço não encontrado'
            });
        }

        service.status = 'inactive';
        await service.save();

        res.json({
            status: 'success',
            message: 'Serviço desativado com sucesso'
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Get service categories
exports.getCategories = async (req, res) => {
    try {
        let userId = req.user._id;

        // If user is a professional, get their parent account's userId
        if (req.user.role === 'professional') {
            const Professional = require('../models/professional');
            const professional = await Professional.findOne({ userAccountId: req.user._id });
            if (professional) {
                userId = professional.userId; // This is the owner's/company's userId
            }
        }

        const categories = await Service.distinct('category', { 
            userId,
            category: { $ne: null }
        });

        res.json({
            status: 'success',
            data: { categories }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};