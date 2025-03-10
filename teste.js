const axios = require('axios');
const colors = require('colors');

// Configuration
const API_URL = 'http://localhost:3000/api';
let authToken = '';
let testReport = [];

// Test user data
const testUser = {
    name: 'Test Owner',
    email: 'test2@example.com',
    password: 'test123',
    role: 'owner',
    phone: '11999999999',
    companyName: 'Test Salon'
};

// Test client data
const testClient = {
    name: 'Test Client',
    phone: '11988888888',
    email: 'client2@example.com',
    cpf: '12345678900',
    city: 'São Paulo',
    description: 'Test client description'
};

// Test service data
const testService = {
    name: 'Test Haircut',
    description: 'Test service description',
    price: 50.00,
    duration: 30,
    category: 'Haircut',
    commissionType: 'default',
    commissionValue: 20
};

// Helper function to log test results
const logTest = (description, success, details = '') => {
    const status = success ? 'PASS'.green : 'FAIL'.red;
    const log = `[${status}] ${description} ${details}`;
    testReport.push({ description, success, details });
    console.log(log);
};

// Helper function to make API requests
const apiRequest = async (method, endpoint, data = null, auth = false) => {
    try {
        const headers = auth ? { Authorization: `Bearer ${authToken}` } : {};
        console.log(`\n[REQUEST] ${method.toUpperCase()} ${endpoint}`.yellow);
        if (data) console.log('Request Body:', JSON.stringify(data, null, 2));

        const response = await axios({
            method,
            url: `${API_URL}${endpoint}`,
            data,
            headers
        });

        console.log(`\n[RESPONSE] Status: ${response.status}`.green);
        console.log('Response Data:', JSON.stringify(response.data, null, 2));

        return { success: true, data: response.data };
    } catch (error) {
        console.log(`\n[ERROR] ${error.message}`.red);
        if (error.response) {
            console.log('Error Status:', error.response.status);
            console.log('Error Data:', JSON.stringify(error.response.data, null, 2));
        }

        return { 
            success: false, 
            error: error.response?.data?.message || error.message 
        };
    }
};

// Main test function
const runTests = async () => {
    console.log('\nStarting API Tests...\n'.cyan);

    // 1. Register new user
    const registerResult = await apiRequest('post', '/auth/register', testUser);
    if (registerResult.success) {
        authToken = registerResult.data.data.token;
        logTest('User Registration', true);
    } else {
        logTest('User Registration', false, registerResult.error);
        return;
    }

    // 2. Login
    const loginResult = await apiRequest('post', '/auth/login', {
        email: testUser.email,
        password: testUser.password
    });
    logTest('User Login', loginResult.success, loginResult.success ? '' : loginResult.error);

    // 3. Get user profile
    const profileResult = await apiRequest('get', '/auth/me', null, true);
    logTest('Get User Profile', profileResult.success);

    // 4. Create client
    const clientResult = await apiRequest('post', '/clients', testClient, true);
    let clientId = null;
    if (clientResult.success) {
        clientId = clientResult.data.data.client.id;
        logTest('Create Client', true);
    } else {
        logTest('Create Client', false, clientResult.error);
    }

    // 5. Create service
    const serviceResult = await apiRequest('post', '/services', testService, true);
    let serviceId = null;
    if (serviceResult.success) {
        serviceId = serviceResult.data.data.service.id;
        logTest('Create Service', true);
    } else {
        logTest('Create Service', false, serviceResult.error);
    }

    // 6. Create appointment (if client and service were created successfully)
    if (clientId && serviceId) {
        const appointment = {
            clientId,
            serviceId,
            date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
            status: 'scheduled'
        };
        const appointmentResult = await apiRequest('post', '/appointments', appointment, true);
        logTest('Create Appointment', appointmentResult.success);
    }

    // 7. Get dashboard summary
    const dashboardResult = await apiRequest('get', '/dashboard/summary', null, true);
    logTest('Get Dashboard Summary', dashboardResult.success);

    // Generate final report
    console.log('\nTest Summary:'.cyan);
    const totalTests = testReport.length;
    const passedTests = testReport.filter(t => t.success).length;
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`.green);
    console.log(`Failed: ${totalTests - passedTests}`.red);

    console.log('\nDetailed Report:'.cyan);
    testReport.forEach((test, index) => {
        const status = test.success ? 'PASS'.green : 'FAIL'.red;
        console.log(`${index + 1}. [${status}] ${test.description}`);
        if (!test.success && test.details) {
            console.log(`   Error: ${test.details}`.red);
        }
    });
};

// Run tests
runTests().catch(error => {
    console.error('Test execution failed:', error);
});