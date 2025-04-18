// src/utils/userHelper.js

const Professional = require('../models/professional');

/**
 * Obtém o ID do usuário proprietário com base no usuário logado
 * @param {Object} req - Request object contendo o usuário autenticado
 * @returns {Promise<string>} ID do usuário proprietário
 * @throws {Error} Lança erro se o profissional não for encontrado
 */
const getOwnerUserId = async (req) => {
  // Se for admin ou owner, retorna o próprio ID
  if (req.user.role === 'owner' || req.user.role === 'admin') {
    return req.user._id;
  }
  
  // Se for profissional, verifica se tem parentId no objeto user
  if (req.user.role === 'professional') {
    // Se tiver parentId diretamente no objeto user, use-o
    if (req.user.parentId) {
      return req.user.parentId;
    }
    
    // Caso contrário, busca o profissional para encontrar a conta proprietária
    const professional = await Professional.findOne({ userAccountId: req.user._id });
    
    if (!professional) {
      throw new Error('Perfil profissional não encontrado. Por favor, contate o administrador.');
    }
    
    // Retorna o userId do professional (que é o ID do proprietário)
    return professional.userId;
  }

  // Caso não se encaixe em nenhuma das condições acima, retorna o próprio ID
  return req.user._id;
};

/**
 * Obtém o ID do profissional com base no usuário logado (apenas para contas de profissional)
 * @param {Object} req - Request object contendo o usuário autenticado 
 * @returns {Promise<string|null>} ID do profissional ou null se não for uma conta de profissional
 */
const getProfessionalId = async (req) => {
  if (req.user.role !== 'professional') {
    return null;
  }
  
  const professional = await Professional.findOne({ userAccountId: req.user._id });
  return professional ? professional._id : null;
};

/**
 * Verifica se o profissional tem permissão para visualizar todos os dados
 * @param {Object} req - Request object contendo o usuário autenticado
 * @returns {Promise<boolean>} true se o profissional tem permissão, false caso contrário
 */
const canViewAllData = async (req) => {
  if (req.user.role === 'owner' || req.user.role === 'admin') {
    return true;
  }
  
  if (req.user.role === 'professional') {
    const professional = await Professional.findOne({ userAccountId: req.user._id });
    return professional && professional.permissions && professional.permissions.visualizarDados;
  }
  
  return false;
};

module.exports = {
  getOwnerUserId,
  getProfessionalId,
  canViewAllData
};