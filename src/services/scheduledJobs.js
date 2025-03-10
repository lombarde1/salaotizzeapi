const Appointment = require('../models/appointment');
const Product = require('../models/product');
const Client = require('../models/client');
const notificationService = require('./notification');

/**
 * Creates reminder notifications for tomorrow's appointments
 */
const createAppointmentReminders = async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find appointments for tomorrow
    const appointments = await Appointment.find({
        date: {
            $gte: tomorrow.setHours(0,0,0,0),
            $lt: tomorrow.setHours(23,59,59,999)
        },
        status: 'confirmed'
    }).populate('clientId').populate('professionalId');

    // Create notifications for each appointment
    for (let appointment of appointments) {
        await notificationService.createNotification({
            userId: appointment.professionalId.userAccountId || appointment.professionalId._id,
            title: "Lembrete de agendamento",
            message: `Lembrete: Amanhã você tem agendamento com ${appointment.clientId.name}`,
            type: "reminder",
            relatedTo: {
                model: "Appointment",
                id: appointment._id
            }
        });
    }
};

/**
 * Creates notifications for products with low stock
 */
const checkLowStockProducts = async () => {
    const products = await Product.find({
        $expr: {
            $lte: ["$stock", "$minStock"]
        },
        status: 'active'
    });

    for (let product of products) {
        await notificationService.createNotification({
            userId: product.userId,
            title: "Estoque Baixo",
            message: `O produto ${product.name} está com estoque baixo (${product.stock} unidades)`,
            type: "low_stock",
            relatedTo: {
                model: "Product",
                id: product._id
            }
        });
    }
};

/**
 * Creates birthday notifications for clients
 */
const checkClientBirthdays = async () => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const clients = await Client.find({
        $expr: {
            $and: [
                { $eq: [{ $month: "$birthDate" }, month] },
                { $eq: [{ $dayOfMonth: "$birthDate" }, day] }
            ]
        }
    });

    for (let client of clients) {
        await notificationService.createNotification({
            userId: client.userId,
            title: "Aniversário de Cliente",
            message: `Hoje é aniversário de ${client.name}!`,
            type: "client_birthday",
            relatedTo: {
                model: "Client",
                id: client._id
            }
        });
    }
};

/**
 * Checks for inactive clients (no visits in last 30 days)
 */
const checkInactiveClients = async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const inactiveClients = await Client.find({
        lastVisit: { $lt: thirtyDaysAgo },
        status: 'active'
    });

    for (let client of inactiveClients) {
        await notificationService.createNotification({
            userId: client.userId,
            title: "Cliente Inativo",
            message: `${client.name} não visita o salão há mais de 30 dias`,
            type: "inactive_client",
            relatedTo: {
                model: "Client",
                id: client._id
            }
        });
    }
};

module.exports = {
    createAppointmentReminders,
    checkLowStockProducts,
    checkClientBirthdays,
    checkInactiveClients
};