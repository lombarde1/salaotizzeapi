const Professional = require('../models/professional');
const User = require('../models/user');

const formatError = (err) => {
    if (err.name === 'ValidationError') {
        return Object.values(err.errors).map(e => e.message).join(', ');
    }
    if (err.code === 11000) {
        return 'Registro duplicado: algum campo precisa ser único.';
    }
    return err.message || 'Erro desconhecido.';
};

exports.createProfessional = async (req, res) => {
    try {
        let permissions = {
            visualizarDados: req.body.visualizarDados || false
        };

        const professional = new Professional({
            ...req.body,
            userId: req.user._id,
            permissions
        });

        await professional.save();

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

        res.status(201).json({ status: 'success', data: { professional } });
    } catch (error) {
        res.status(400).json({ status: 'error', message: formatError(error) });
    }
};

exports.listProfessionals = async (req, res) => {
    try {
        const query = { userId: req.user._id };
        if (req.query.status) query.status = req.query.status;
        if (req.query.role) query.role = req.query.role;
        if (req.query.search) query.$text = { $search: req.query.search };

        let sort = { name: 1 };
        if (req.query.sortBy) {
            const parts = req.query.sortBy.split(':');
            sort = { [parts[0]]: parts[1] === 'desc' ? -1 : 1 };
        }

        const professionals = await Professional.find(query)
            .select('name phone email cpf role services permissions status workingHours specialties address userAccountId commissionType commissionValue createdAt updatedAt')
            .sort(sort);

        res.json({ status: 'success', data: { professionals } });
    } catch (error) {
        res.status(400).json({ status: 'error', message: formatError(error) });
    }
};

exports.getProfessional = async (req, res) => {
    try {
        const professional = await Professional.findOne({
            _id: req.params.id,
            userId: req.user._id
        }).select('name phone email cpf role services permissions status workingHours specialties address userAccountId commissionType commissionValue createdAt updatedAt').lean();

        if (!professional) {
            return res.status(404).json({ status: 'error', message: 'Profissional não encontrado.' });
        }

        const hasAccount = !!professional.userAccountId;
        let accountEmail = null;
        if (hasAccount) {
            const user = await User.findById(professional.userAccountId).select('email');
            accountEmail = user ? user.email : null;
        }

        res.json({ status: 'success', data: { professional, hasAccount, accountEmail } });
    } catch (error) {
        res.status(400).json({ status: 'error', message: formatError(error) });
    }
};

exports.updateProfessional = async (req, res) => {
    try {
        if (req.body.visualizarDados !== undefined) {
            req.body.permissions = { visualizarDados: req.body.visualizarDados };
            delete req.body.visualizarDados;
        }

        const updates = Object.keys(req.body);
        const allowedUpdates = [
            'name', 'phone', 'email', 'cpf', 'role', 'status',
            'permissions', 'workingHours', 'specialties', 'address',
            'commissionType', 'commissionValue', 'rg'
        ];

        const invalidFields = updates.filter(update => !allowedUpdates.includes(update));
        if (invalidFields.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: `Os seguintes campos não são permitidos para atualização: ${invalidFields.join(', ')}`
            });
        }

        const professional = await Professional.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!professional) {
            return res.status(404).json({ status: 'error', message: 'Profissional não encontrado.' });
        }

        updates.forEach(update => {
            professional[update] = req.body[update];
        });

        await professional.save();

        if (professional.userAccountId && req.body.email) {
            await User.findByIdAndUpdate(professional.userAccountId, {
                name: req.body.name,
                email: req.body.email,
                phone: req.body.phone
            });
        }

        res.json({ status: 'success', data: { professional } });
    } catch (error) {
        res.status(400).json({ status: 'error', message: formatError(error) });
    }
};

exports.updateCommission = async (req, res) => {
    try {
        const { commissionType, commissionValue } = req.body;
        if (!commissionType || commissionValue == null) {
            return res.status(400).json({
                status: 'error',
                message: 'Tipo e valor da comissão são obrigatórios.'
            });
        }

        const professional = await Professional.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!professional) {
            return res.status(404).json({ status: 'error', message: 'Profissional não encontrado.' });
        }

        const updatedProfessional = await Professional.findByIdAndUpdate(
            professional._id,
            { $set: { commissionType, commissionValue: parseFloat(commissionValue) } },
            { new: true }
        );

        res.json({ status: 'success', data: { professional: updatedProfessional } });
    } catch (error) {
        res.status(400).json({ status: 'error', message: formatError(error) });
    }
};

exports.deleteProfessional = async (req, res) => {
    try {
        const professional = await Professional.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!professional) {
            return res.status(404).json({ status: 'error', message: 'Profissional não encontrado.' });
        }

        professional.status = 'inactive';
        await professional.save();

        if (professional.userAccountId) {
            await User.findByIdAndUpdate(professional.userAccountId, { status: 'inactive' });
        }

        res.json({ status: 'success', message: 'Profissional desativado com sucesso.' });
    } catch (error) {
        res.status(400).json({ status: 'error', message: formatError(error) });
    }
};

exports.createProfessionalAccount = async (req, res) => {
    try {
        const professional = await Professional.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!professional) {
            return res.status(404).json({ status: 'error', message: 'Profissional não encontrado.' });
        }

        if (professional.userAccountId) {
            return res.status(400).json({ status: 'error', message: 'Profissional já possui uma conta.' });
        }

        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ status: 'error', message: 'Email e senha são obrigatórios.' });
        }

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

        professional.userAccountId = user._id;
        await professional.save();

        res.status(201).json({
            status: 'success',
            message: 'Conta criada com sucesso.',
            data: { professionalId: professional._id, email }
        });
    } catch (error) {
        res.status(400).json({ status: 'error', message: formatError(error) });
    }
};