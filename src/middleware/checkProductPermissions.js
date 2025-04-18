// src/middleware/checkProductPermissions.js

const Professional = require('../models/professional');

const checkProductPermissions = async (req, res, next) => {
    try {
        // Skip permission check for admin and owner users
        if (req.user.role === 'admin' || req.user.role === 'owner') {
            return next();
        }

        // Se for um profissional, simplesmente permite o acesso (sem verificar permissões)
        if (req.user.role === 'professional') {
            const professional = await Professional.findOne({ userAccountId: req.user._id });
            
            if (!professional) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Perfil profissional não encontrado'
                });
            }

            // Verificar apenas se o profissional está ativo
            if (professional.status !== 'active') {
                return res.status(403).json({
                    status: 'error',
                    message: 'Conta profissional inativa'
                });
            }

            // Permitir acesso sem verificar a permissão manageProducts
            return next();
        }

        // Se o código chegar aqui, significa que o usuário não é proprietário, admin ou profissional
        res.status(403).json({
            status: 'error',
            message: 'Acesso não autorizado'
        });
    } catch (error) {
        console.error('Erro ao verificar permissões de produto:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erro ao verificar permissões de produto'
        });
    }
};

module.exports = checkProductPermissions;