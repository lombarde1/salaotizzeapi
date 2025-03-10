# Transaction API Documentation

## Overview
The Transaction API provides endpoints for managing financial transactions, including service sales, product sales, and commission payments.

## Authentication
All endpoints require authentication via JWT token in the Authorization header.

## Endpoints

### Create Transaction
`POST /api/transactions`

**Permission Required:** Authentication required

**Request Body:**
```json
{
  "type": "income" | "expense",
  "category": "service" | "product" | "salary" | "other",
  "amount": "number",
  "paymentMethod": "string",
  "date": "date",
  "status": "pending" | "paid",
  "client": "string (client ID)",
  "professional": "string (professional ID)",
  "reference": {
    "model": "string",
    "id": "string"
  }
}
```

**Response:** `201 Created`
```json
{
  "status": "success",
  "data": {
    "transaction": "Transaction Object"
  }
}
```

### Register Service Transaction
`POST /api/transactions/service`

**Permission Required:** Authentication required

**Request Body:**
```json
{
  "serviceId": "string",
  "clientId": "string",
  "professionalId": "string",
  "amount": "number",
  "paymentMethod": "string",
  "date": "date (optional)"
}
```

**Response:** `201 Created`
```json
{
  "status": "success",
  "data": {
    "transaction": "Transaction Object with Commission Details"
  }
}
```

### Register Product Sale
`POST /api/transactions/product`

**Permission Required:** Authentication required

**Request Body:**
```json
{
  "productId": "string",
  "quantity": "number",
  "clientId": "string (optional)",
  "paymentMethod": "string",
  "date": "date (optional)"
}
```

**Response:** `201 Created`
```json
{
  "status": "success",
  "data": {
    "transaction": "Transaction Object"
  }
}
```

### Get Transactions
`GET /api/transactions`

**Permission Required:** Authentication required

**Query Parameters:**
- `type`: Filter by transaction type (income/expense)
- `category`: Filter by category (service/product/salary/other)
- `status`: Filter by status (pending/paid)
- `startDate`: Filter by start date
- `endDate`: Filter by end date
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `sortBy`: Sort field (default: date)
- `order`: Sort order (asc/desc)

**Response:** `200 OK`
```json
{
  "status": "success",
  "data": {
    "transactions": ["Array of Transaction Objects"],
    "pagination": {
      "total": "number",
      "page": "number",
      "pages": "number"
    }
  }
}
```

### Get Financial Summary
`GET /api/transactions/summary`

**Permission Required:** Authentication required

**Query Parameters:**
- `startDate`: Required - Start date for summary
- `endDate`: Required - End date for summary

**Response:** `200 OK`
```json
{
  "status": "success",
  "data": {
    "summary": ["Array of Summary Objects"],
    "totals": {
      "income": "number",
      "expense": "number",
      "profit": "number"
    }
  }
}
```

### Update Transaction Status
`PUT /api/transactions/:id/status`

**Permission Required:** Authentication required

**Request Body:**
```json
{
  "status": "pending" | "paid"
}
```

**Response:** `200 OK`
```json
{
  "status": "success",
  "data": {
    "transaction": "Updated Transaction Object"
  }
}
```

### Pay Commission
`POST /api/transactions/:id/pay-commission`

**Permission Required:** Authentication required

**Request Body:**
```json
{
  "paymentMethod": "string"
}
```

**Response:** `200 OK`
```json
{
  "status": "success",
  "data": {
    "transaction": "Original Transaction Object",
    "commissionTransaction": "Commission Payment Transaction Object"
  }
}
```

## Error Responses

All endpoints may return the following error responses:

**400 Bad Request**
```json
{
  "status": "error",
  "message": "Error description"
}
```

**401 Unauthorized**
```json
{
  "status": "error",
  "message": "Authentication required"
}
```

**403 Forbidden**
```json
{
  "status": "error",
  "message": "Insufficient permissions"
}
```

**404 Not Found**
```json
{
  "status": "error",
  "message": "Resource not found"
}
```

## Notes

1. All monetary values are handled in the smallest currency unit (e.g., cents)
2. Dates should be provided in ISO 8601 format
3. Professional users with limited permissions will only see their commission-related transactions
4. Transaction IDs are automatically generated and returned in the response