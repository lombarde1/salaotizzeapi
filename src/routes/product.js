const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const checkProductPermissions = require('../middleware/checkProductPermissions');
const productController = require('../controllers/product');

const router = express.Router();

// Validation middleware
const validateProduct = [
    body('name').trim().notEmpty().withMessage('Nome é obrigatório'),
    body('salePrice').isFloat({ min: 0 }).withMessage('Preço de venda deve ser um número positivo'),
    body('purchasePrice').optional().isFloat({ min: 0 }).withMessage('Preço de compra deve ser um número positivo'),
    body('minStock').optional().isInt({ min: 0 }).withMessage('Estoque mínimo deve ser um número positivo'),
    body('commissionType').optional().isIn(['none', 'percentage', 'fixed']).withMessage('Tipo de comissão inválido'),
    body('commissionValue').optional().isFloat({ min: 0 }).withMessage('Valor da comissão deve ser positivo')
];

const validateStockUpdate = [
    body('quantity').isInt({ min: 1 }).withMessage('Quantidade deve ser um número positivo'),
    body('type').isIn(['in', 'out']).withMessage('Tipo de operação inválido'),
    body('reason').trim().notEmpty().withMessage('Motivo é obrigatório')
];

// Get all categories
// Get product categories
router.get('/categories', auth, checkProductPermissions, productController.getCategories);

// Get product brands
router.get('/brands', auth, checkProductPermissions, productController.getBrands);

// Create new product
router.post('/', auth, checkProductPermissions, validateProduct, productController.createProduct);

// List products
router.get('/', auth, checkProductPermissions, productController.getProducts);

// Get low stock products
router.get('/low-stock', auth, checkProductPermissions, productController.getLowStockProducts);

// Get product by ID
router.get('/:id', auth, checkProductPermissions, productController.getProduct);

// Update product
router.put('/:id', auth, checkProductPermissions, validateProduct, productController.updateProduct);

// Update product stock
router.put('/:id/stock', auth, checkProductPermissions, validateStockUpdate, productController.updateStock);

// Delete product
router.delete('/:id', auth, checkProductPermissions, productController.deleteProduct);

module.exports = router;