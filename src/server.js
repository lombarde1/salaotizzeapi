const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cron = require('node-cron');
const scheduledJobs = require('./services/scheduledJobs');

// Import routes
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/client');
const professionalRoutes = require('./routes/professional');
const serviceRoutes = require('./routes/service');
const productRoutes = require('./routes/product');
const appointmentRoutes = require('./routes/appointment');
const transactionRoutes = require('./routes/transaction');
const reportsRoutes = require('./routes/reports');
const dashboardRoutes = require('./routes/dashboard');
const notificationRoutes = require('./routes/notification');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://darkvips:lombarde1@147.79.111.143:27017/salaopro';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    authSource: 'admin'
}).then(() => {
    console.log('Connected to MongoDB successfully');
    
    // Initialize scheduled jobs
    // Run appointment reminders every day at 8:00 AM
    cron.schedule('0 8 * * *', async () => {
        try {
            await scheduledJobs.createAppointmentReminders();
            console.log('Appointment reminders job completed successfully');
        } catch (error) {
            console.error('Error in appointment reminders job:', error);
        }
    });

    // Check low stock products every day at 9:00 AM
    cron.schedule('0 9 * * *', async () => {
        try {
            await scheduledJobs.checkLowStockProducts();
            console.log('Low stock check job completed successfully');
        } catch (error) {
            console.error('Error in low stock check job:', error);
        }
    });

    // Check client birthdays every day at 7:00 AM
    cron.schedule('0 7 * * *', async () => {
        try {
            await scheduledJobs.checkClientBirthdays();
            console.log('Client birthdays check job completed successfully');
        } catch (error) {
            console.error('Error in client birthdays check job:', error);
        }
    });

    // Check inactive clients every Monday at 10:00 AM
    cron.schedule('0 10 * * 1', async () => {
        try {
            await scheduledJobs.checkInactiveClients();
            console.log('Inactive clients check job completed successfully');
        } catch (error) {
            console.error('Error in inactive clients check job:', error);
        }
    });

}).catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/professionals', professionalRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/products', productRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        status: 'error',
        message: 'Something went wrong!'
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;