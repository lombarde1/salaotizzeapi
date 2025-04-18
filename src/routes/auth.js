const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/user');
const auth = require('../middleware/auth');
const Professional = require('../models/professional');

const router = express.Router();

// Validation middleware
const validateRegistration = [
    body('name').trim().notEmpty().withMessage('Nome é obrigatório'),
    body('email').isEmail().withMessage('Por favor, insira um email válido'),
    body('password').isLength({ min: 6 }).withMessage('A senha deve ter pelo menos 6 caracteres'),
    body('role').optional().isIn(['admin', 'owner', 'professional']).withMessage('Função inválida')
];

// Register new user
router.post('/register', validateRegistration, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ status: 'error', errors: errors.array() });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: req.body.email });
        if (existingUser) {
            return res.status(400).json({
                status: 'error',
                message: 'Email já cadastrado'
            });
        }

        const user = new User(req.body);
        await user.save();

        const token = user.generateAuthToken();
        res.status(201).json({
            status: 'success',
            data: { user, token }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
});

// Login user
router.post('/login', [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ status: 'error', errors: errors.array() });
        }

        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({
                status: 'error',
                message: 'Email ou senha inválidos'
            });
        }

        if (user.status !== 'active') {
            return res.status(401).json({
                status: 'error',
                message: 'Conta inativa'
            });
        }

        const token = user.generateAuthToken();
        res.json({
            status: 'success',
            data: { user, token }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
});

// Get current user
router.get('/me', auth, async (req, res) => {
    try {
        let userData = { ...req.user.toObject() };
        
        // Se for um profissional, buscar informações adicionais de permissões
        if (req.user.role === 'professional') {
            const professional = await Professional.findOne({ userAccountId: req.user._id });
            
            if (professional) {
                // Adicionar informações de permissões ao objeto de resposta
                userData.permissions = {
                    visualizarDados: professional.permissions?.visualizarDados || false
                };
                
                // Adicionar informações adicionais do profissional que podem ser úteis
                userData.professionalInfo = {
                    id: professional._id,
                    role: professional.role,
                    commissionType: professional.commissionType,
                    commissionValue: professional.commissionValue
                };
            }
        } else if (req.user.role === 'owner' || req.user.role === 'admin') {
            // Proprietários e administradores têm todas as permissões por padrão
            userData.permissions = {
                visualizarDados: true
            };
        }
        
        res.json({
            status: 'success',
            data: { user: userData }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
});

// Update user
router.put('/update', auth, [
    body('name').optional().trim().notEmpty().withMessage('Nome não pode estar vazio'),
    body('phone').optional().trim(),
    body('companyName').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ status: 'error', errors: errors.array() });
        }

        const updates = Object.keys(req.body);
        const allowedUpdates = ['name', 'phone', 'companyName'];
        const isValidOperation = updates.every(update => allowedUpdates.includes(update));

        if (!isValidOperation) {
            return res.status(400).json({
                status: 'error',
                message: 'Atualizações inválidas'
            });
        }

        updates.forEach(update => req.user[update] = req.body[update]);
        await req.user.save();

        res.json({
            status: 'success',
            data: { user: req.user }
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
});

// Reset password
router.post('/reset-password', auth, [
    body('currentPassword').notEmpty().withMessage('Senha atual é obrigatória'),
    body('newPassword').isLength({ min: 6 }).withMessage('Nova senha deve ter pelo menos 6 caracteres')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ status: 'error', errors: errors.array() });
        }

        const { currentPassword, newPassword } = req.body;
        const user = req.user;

        if (!(await user.comparePassword(currentPassword))) {
            return res.status(401).json({
                status: 'error',
                message: 'Senha atual incorreta'
            });
        }

        user.password = newPassword;
        await user.save();

        res.json({
            status: 'success',
            message: 'Senha atualizada com sucesso'
        });
    } catch (error) {
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
});

module.exports = router;