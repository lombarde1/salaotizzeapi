const Product = require('../models/product');
const { validationResult } = require('express-validator');
const { getOwnerUserId } = require('../utils/userHelper');

// Create new product
exports.createProduct = async (req, res) => {
    try {
        console.log('=== INÍCIO DA CRIAÇÃO DO PRODUTO ===');
        console.log('Usuário autenticado:', req.user._id);
        console.log('Payload recebido:', JSON.stringify(req.body));

        // Obter o ID do usuário proprietário
        const ownerUserId = await getOwnerUserId(req);
        console.log('ID do proprietário:', ownerUserId);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Erros de validação:', JSON.stringify(errors.array()));
            return res.status(400).json({ status: 'error', errors: errors.array() });
        }

        // Tratar código de barras vazio
        if (!req.body.barcode || req.body.barcode === '') {
            req.body.barcode = undefined;
        }

        // Verificar se já existe um produto com esse nome para esse usuário
        const existingProduct = await Product.findOne({
            userId: ownerUserId,
            name: req.body.name
        });
        
        if (existingProduct) {
            console.log('Produto existente encontrado:', existingProduct._id, existingProduct.name);
            return res.status(400).json({
                status: 'error',
                message: 'Já existe um produto com este nome',
                existing: {
                    id: existingProduct._id,
                    name: existingProduct.name,
                    status: existingProduct.status
                }
            });
        }
        
        console.log('Nenhum produto duplicado encontrado, prosseguindo com a criação');

        const product = new Product({
            ...req.body,
            userId: ownerUserId // Salva sempre na conta do proprietário
        });

        console.log('Produto a ser salvo:', JSON.stringify({
            name: product.name,
            userId: product.userId,
            salePrice: product.salePrice
        }));

        await product.save();
        console.log('Produto salvo com sucesso, ID:', product._id);

        res.status(201).json({
            status: 'success',
            data: { product }
        });
    } catch (error) {
        console.error('ERRO AO CRIAR PRODUTO:', error.message);
        console.error('Código do erro:', error.code);
        console.error('Stack trace:', error.stack);
        
        if (error.code === 11000) {
            console.error('Detalhes do erro de duplicidade:', JSON.stringify({
                keyPattern: error.keyPattern,
                keyValue: error.keyValue
            }));
            
            return res.status(400).json({
                status: 'error',
                message: 'Já existe um produto com este nome',
                details: {
                    code: error.code,
                    keyPattern: error.keyPattern,
                    keyValue: error.keyValue
                }
            });
        }
        
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// List products with filters and pagination
exports.getProducts = async (req, res) => {
    try {
        // Obter o ID do usuário proprietário
        const ownerUserId = await getOwnerUserId(req);
        
        const { category, brand, status, sortBy, order, page = 1, limit = 10 } = req.query;
        const query = { userId: ownerUserId };
        const sort = {};

        if (category) query.category = category;
        if (brand) query.brand = brand;
        if (status) query.status = status;
        if (sortBy) sort[sortBy] = order === 'desc' ? -1 : 1;

        const products = await Product.find(query)
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Product.countDocuments(query);

        res.json({
            status: 'success',
            data: {
                products,
                total,
                pages: Math.ceil(total / limit),
                currentPage: page
            }
        });
    } catch (error) {
        console.error('Erro ao listar produtos:', error);
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Get all unique product categories
exports.getCategories = async (req, res) => {
    try {
        // Obter o ID do usuário proprietário
        const ownerUserId = await getOwnerUserId(req);
        
        const categories = await Product.distinct('category', { userId: ownerUserId });
        res.status(200).json({
            status: 'success',
            data: { categories: categories.filter(category => category) }
        });
    } catch (error) {
        console.error('Erro ao buscar categorias:', error);
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Get all unique product brands
exports.getBrands = async (req, res) => {
    try {
        // Obter o ID do usuário proprietário
        const ownerUserId = await getOwnerUserId(req);
        
        const brands = await Product.distinct('brand', { userId: ownerUserId });
        res.status(200).json({
            status: 'success',
            data: { brands: brands.filter(brand => brand) }
        });
    } catch (error) {
        console.error('Erro ao buscar marcas:', error);
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Get product by ID
exports.getProduct = async (req, res) => {
    try {
        // Obter o ID do usuário proprietário
        const ownerUserId = await getOwnerUserId(req);
        
        const product = await Product.findOne({
            _id: req.params.id,
            userId: ownerUserId
        });

        if (!product) {
            return res.status(404).json({
                status: 'error',
                message: 'Produto não encontrado'
            });
        }

        res.json({
            status: 'success',
            data: { product }
        });
    } catch (error) {
        console.error('Erro ao buscar produto:', error);
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Update product
exports.updateProduct = async (req, res) => {
    try {
        // Obter o ID do usuário proprietário
        const ownerUserId = await getOwnerUserId(req);
        
        const updates = Object.keys(req.body);
        const allowedUpdates = ['name', 'description', 'purchasePrice', 'salePrice', 
                               'minStock', 'brand', 'category', 'barcode',
                               'commissionType', 'commissionValue', 'status'];
        const isValidOperation = updates.every(update => allowedUpdates.includes(update));

        if (!isValidOperation) {
            return res.status(400).json({
                status: 'error',
                message: 'Atualizações inválidas'
            });
        }

        const product = await Product.findOne({
            _id: req.params.id,
            userId: ownerUserId
        });

        if (!product) {
            return res.status(404).json({
                status: 'error',
                message: 'Produto não encontrado'
            });
        }

        updates.forEach(update => product[update] = req.body[update]);
        await product.save();

        res.json({
            status: 'success',
            data: { product }
        });
    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        if (error.code === 11000) {
            return res.status(400).json({
                status: 'error',
                message: 'Já existe um produto com este nome'
            });
        }
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Update product stock
exports.updateStock = async (req, res) => {
    try {
        // Obter o ID do usuário proprietário
        const ownerUserId = await getOwnerUserId(req);
        
        const { quantity, type, reason } = req.body;

        if (!['in', 'out'].includes(type)) {
            return res.status(400).json({
                status: 'error',
                message: 'Tipo de operação inválido'
            });
        }

        const product = await Product.findOne({
            _id: req.params.id,
            userId: ownerUserId
        });

        if (!product) {
            return res.status(404).json({
                status: 'error',
                message: 'Produto não encontrado'
            });
        }

        await product.updateStock(quantity, type, reason);

        res.json({
            status: 'success',
            data: { product }
        });
    } catch (error) {
        console.error('Erro ao atualizar estoque:', error);
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Delete (deactivate) product
exports.deleteProduct = async (req, res) => {
    try {
        // Obter o ID do usuário proprietário
        const ownerUserId = await getOwnerUserId(req);
        
        const product = await Product.findOne({
            _id: req.params.id,
            userId: ownerUserId
        });

        if (!product) {
            return res.status(404).json({
                status: 'error',
                message: 'Produto não encontrado'
            });
        }

        product.status = 'inactive';
        await product.save();

        res.json({
            status: 'success',
            message: 'Produto desativado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao desativar produto:', error);
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};

// Get low stock products
exports.getLowStockProducts = async (req, res) => {
    try {
        // Obter o ID do usuário proprietário
        const ownerUserId = await getOwnerUserId(req);
        
        const products = await Product.find({
            userId: ownerUserId,
            status: 'active',
            $expr: { $lte: ['$stock', '$minStock'] }
        });

        res.json({
            status: 'success',
            data: { products }
        });
    } catch (error) {
        console.error('Erro ao buscar produtos com estoque baixo:', error);
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};