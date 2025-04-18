// Middleware simplificado para verificar permissões de agendamento
const Professional = require('../models/professional');
const User = require('../models/user');

const checkAppointmentPermissions = async (req, res, next) => {
    try {
      // Se o usuário for admin ou owner, permite acesso total
      if (req.user.role === 'owner' || req.user.role === 'admin') {
        return next();
      }
  
      console.log(req.user)
      // Se o usuário for um profissional, verifica se tem permissão para visualizar
      if (req.user.role === 'professional') {
        const professional = await Professional.findOne({ userAccountId: req.user._id });
        
        if (!professional) {
          return res.status(403).json({
            status: 'error',
            message: 'Perfil de profissional não encontrado'
          });
        }
  
        // Verifica se o profissional tem permissão para visualizar dados
        if (!professional.permissions.visualizarDados) {
          // Se o profissional não pode visualizar os dados, só poderá ver/editar seus próprios agendamentos
          if (req.method === 'GET') {
            // Na hora de listar, já será filtrado no controller
            // Não precisa fazer nada aqui
          } else if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
            // Para operações de escrita, verifica se o profissional está tentando modificar seus próprios agendamentos
            if (req.body.professionalId && req.body.professionalId.toString() !== professional._id.toString()) {
              return res.status(403).json({
                status: 'error',
                message: 'Você só pode gerenciar seus próprios agendamentos'
              });
            }
          }
        }
        
        // Se chegou até aqui, o profissional tem permissão
        req.professionalId = professional._id; // Guarda o ID do profissional para o controller
      }
  
      next();
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Erro ao verificar permissões',
        error: error.message
      });
    }
  };
  
  module.exports = checkAppointmentPermissions;