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
    const tomorrowStart = new Date(tomorrow);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // Find appointments for tomorrow
    const appointments = await Appointment.find({
        date: {
            $gte: tomorrowStart,
            $lte: tomorrowEnd
        },
        status: 'confirmed',
        sendReminder: true,
        reminderSent: false
    }).populate('clientId').populate('professionalId').populate('serviceId');

    // Create notifications for each appointment
    let remindersSent = 0;
    for (let appointment of appointments) {
        try {
            // Notificação para o profissional
            await notificationService.createNotification({
                userId: appointment.professionalId.userAccountId || appointment.professionalId._id,
                title: "Lembrete de agendamento",
                message: `Amanhã você tem agendamento com ${appointment.clientId.name} às ${new Date(appointment.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})} para ${appointment.serviceId.name}`,
                type: "reminder",
                relatedTo: {
                    model: "Appointment",
                    id: appointment._id
                }
            });
            
            // Marcar que o lembrete foi enviado
            appointment.reminderSent = true;
            await appointment.save();
            remindersSent++;
        } catch (error) {
            console.error(`Error sending reminder for appointment ${appointment._id}:`, error);
        }
    }
    
    console.log(`Sent ${remindersSent} appointment reminders`);
    return remindersSent;
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

    let notificationsSent = 0;
    for (let product of products) {
        try {
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
            notificationsSent++;
        } catch (error) {
            console.error(`Error sending low stock notification for product ${product._id}:`, error);
        }
    }
    
    console.log(`Sent ${notificationsSent} low stock notifications`);
    return notificationsSent;
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

    let notificationsSent = 0;
    for (let client of clients) {
        try {
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
            notificationsSent++;
        } catch (error) {
            console.error(`Error sending birthday notification for client ${client._id}:`, error);
        }
    }
    
    console.log(`Sent ${notificationsSent} birthday notifications`);
    return notificationsSent;
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

    let notificationsSent = 0;
    for (let client of inactiveClients) {
        try {
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
            notificationsSent++;
        } catch (error) {
            console.error(`Error sending inactive client notification for client ${client._id}:`, error);
        }
    }
    
    console.log(`Sent ${notificationsSent} inactive client notifications`);
    return notificationsSent;
};

/**
 * Removes expired appointments (more than X days old and status completed/cancelled/no_show)
 */
const cleanOldAppointments = async (daysToKeep = 90) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await Appointment.deleteMany({
        date: { $lt: cutoffDate },
        status: { $in: ['completed', 'cancelled', 'no_show'] }
    });
    
    console.log(`Cleaned up ${result.deletedCount} old appointments`);
    return result.deletedCount;
};

/**
 * Creates appointment notifications for upcoming appointments today
 */
const sendAppointmentRemindersForToday = async () => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    
    // Encontrar agendamentos de hoje que não tiveram lembrete enviado
    const appointments = await Appointment.find({
        date: { $gte: todayStart, $lte: todayEnd },
        status: 'confirmed',
        sendReminder: true,
        reminderSent: false
    }).populate('clientId').populate('professionalId').populate('serviceId');
    
    let notificationsSent = 0;
    for (let appointment of appointments) {
        try {
            // Só envia se faltarem mais de 2 horas para o agendamento
            const now = new Date();
            const appointmentTime = new Date(appointment.date);
            const timeUntilAppointment = appointmentTime.getTime() - now.getTime();
            const hoursUntilAppointment = timeUntilAppointment / (1000 * 60 * 60);
            
            if (hoursUntilAppointment > 2) {
                await notificationService.createNotification({
                    userId: appointment.professionalId.userAccountId || appointment.professionalId._id,
                    title: "Agendamento Hoje",
                    message: `Hoje você tem agendamento com ${appointment.clientId.name} às ${appointmentTime.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})} para ${appointment.serviceId.name}`,
                    type: "reminder",
                    relatedTo: {
                        model: "Appointment",
                        id: appointment._id
                    }
                });
                
                appointment.reminderSent = true;
                await appointment.save();
                notificationsSent++;
            }
        } catch (error) {
            console.error(`Error sending today's reminder for appointment ${appointment._id}:`, error);
        }
    }
    
    console.log(`Sent ${notificationsSent} today's appointment reminders`);
    return notificationsSent;
};

module.exports = {
    createAppointmentReminders,
    checkLowStockProducts,
    checkClientBirthdays,
    checkInactiveClients,
    cleanOldAppointments,
    sendAppointmentRemindersForToday
};