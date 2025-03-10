# Professional API Documentation

## Overview
This documentation covers all endpoints related to professional management in the salon management system, including detailed permission specifications and their effects.

## Permission System

### Available Permissions

1. **viewFullDashboard**
   - Allows access to complete dashboard statistics
   - Shows data from all professionals and services
   - Enables viewing of global financial metrics

2. **viewOwnDataOnly**
   - Restricts professional to view only their own appointments and client data
   - Limits dashboard view to personal statistics
   - Default permission for standard professionals

3. **accessFinancialData**
   - Enables viewing of financial reports and transactions
   - Allows access to revenue statistics
   - Permits viewing of payment history

4. **manageProducts**
   - Allows creation, editing, and deletion of products
   - Enables inventory management
   - Permits product price adjustments

5. **manageServices**
   - Allows creation and modification of service offerings
   - Enables price setting for services
   - Permits service category management

6. **manageSchedule**
   - Allows modification of working hours
   - Enables blocking time slots
   - Permits vacation scheduling

7. **manageClients**
   - Enables adding and editing client information
   - Allows viewing complete client history
   - Permits client communication management

## Endpoints

### Create Professional
`POST /api/professionals`

**Permission Required:** Admin access

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "specialties": ["string"],
  "workingHours": {
    "monday": {"start": "09:00", "end": "18:00"},
    "tuesday": {"start": "09:00", "end": "18:00"},
    // ... other days
  },
  "permissions": ["viewOwnDataOnly", "manageSchedule"]
}
```

**Response:** `201 Created`
```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "phone": "string",
  "specialties": ["string"],
  "workingHours": {},
  "permissions": ["string"]
}
```

### Create Professional Account
`POST /api/professionals/:id/account`

**Permission Required:** Authentication required

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Validation Rules:**
- Email must be a valid email address
- Password must be at least 6 characters long

**Response:** `201 Created`
```json
{
  "message": "Professional account created successfully",
  "professionalId": "string",
  "credentials": {
    "email": "string",
    "temporaryPassword": "string"
  }
}
```

**Note:** The `temporaryPassword` is provided only during account creation and should be changed by the professional upon first login.


### Get Professional
`GET /api/professionals/:id`

**Permission Required:** viewOwnDataOnly (own profile) or Admin access

**Response:** `200 OK`
```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "phone": "string",
  "specialties": ["string"],
  "workingHours": {},
  "permissions": ["string"],
  "hasAccount": "boolean",
  "accountEmail": "string"
}
```

**Note:** The `hasAccount` field indicates whether the professional has login credentials created. When `hasAccount` is true, `accountEmail` will contain the email address associated with the account. When `hasAccount` is false, `accountEmail` will be null.

### List Professionals
`GET /api/professionals`

**Permission Required:** viewFullDashboard or Admin access

**Query Parameters:**
- `page` (optional): Page number for pagination
- `limit` (optional): Items per page
- `specialty` (optional): Filter by specialty

**Response:** `200 OK`
```json
{
  "professionals": [
    {
      "id": "string",
      "name": "string",
      "specialties": ["string"],
      "availability": "boolean"
    }
  ],
  "total": "number",
  "page": "number",
  "pages": "number"
}
```

### Update Professional
`PUT /api/professionals/:id`

**Permission Required:** Admin access or own profile

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "specialties": ["string"],
  "workingHours": {}
}
```

**Response:** `200 OK`
```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "phone": "string",
  "specialties": ["string"],
  "workingHours": {},
  "permissions": ["string"]
}
```

### Update Professional Permissions
`PATCH /api/professionals/:id/permissions`

**Permission Required:** Admin access

**Request Body:**
```json
{
  "permissions": ["string"]
}
```

**Response:** `200 OK`
```json
{
  "id": "string",
  "permissions": ["string"]
}
```

### Delete Professional
`DELETE /api/professionals/:id`

**Permission Required:** Admin access

**Response:** `204 No Content`

### Get Professional Schedule
`GET /api/professionals/:id/schedule`

**Permission Required:** viewOwnDataOnly (own schedule) or viewFullDashboard

**Query Parameters:**
- `startDate`: Start date for schedule (YYYY-MM-DD)
- `endDate`: End date for schedule (YYYY-MM-DD)

**Response:** `200 OK`
```json
{
  "schedule": [
    {
      "date": "string",
      "slots": [
        {
          "start": "string",
          "end": "string",
          "status": "available|booked|blocked",
          "appointmentId": "string"
        }
      ]
    }
  ]
}
```

### Block Time Slot
`POST /api/professionals/:id/schedule/block`

**Permission Required:** manageSchedule (own schedule) or Admin access

**Request Body:**
```json
{
  "start": "string (ISO datetime)",
  "end": "string (ISO datetime)",
  "reason": "string"
}
```

**Response:** `200 OK`
```json
{
  "id": "string",
  "start": "string",
  "end": "string",
  "status": "blocked",
  "reason": "string"
}
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "ValidationError",
  "message": "Detailed error message",
  "details": {}
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "NotFound",
  "message": "Professional not found"
}
```

## Best Practices

1. Always validate input data before sending requests
2. Use appropriate error handling for all API calls
3. Implement proper permission checks in your client application
4. Keep authentication tokens secure
5. Use HTTPS for all API communications

## Rate Limiting

API requests are limited to:
- 100 requests per minute for normal users
- 300 requests per minute for admin users

Exceeding these limits will result in a 429 Too Many Requests response.