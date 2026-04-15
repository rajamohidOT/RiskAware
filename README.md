# RiskAware

RiskAware is a cybersecurity awareness platform where admins create and manage phishing simulation or training campaigns for learners in an organization.

This project focuses on a secure backend implementation using Next.js API routes, MongoDB, authentication, role-based authorization, campaign assignment logic, learner progress tracking, and email delivery.

## Project Goals

- Build a practical security-focused backend for awareness campaigns
- Enforce role-based access (admin vs learner)
- Track campaign outcomes for simulations and training
- Demonstrate secure API design patterns for a university project

## Tech Stack

- Next.js App Router (API routes)
- TypeScript
- MongoDB Node Driver
- JWT authentication
- Cookie-based sessions
- bcryptjs password hashing
- Nodemailer (SMTP email delivery)

## Implemented Features

### 1. Authentication and Sessions

- Learner login endpoint with credential validation
- Password verification using bcrypt compare
- JWT issuance on successful login
- Session cookie and token cookie set after login
- Logout endpoint clears auth cookies

### 2. Authorization and Middleware

- Reusable auth middleware for protected endpoints
- Role-based access checks (admin, learner)
- Hardcoded organization allow-list check support
- Token accepted from cookie or Bearer header

### 3. Password Security

- Password hashing using bcrypt for signup and learner creation
- Plain text password write protection in signup flow
- Minimum password quality checks in request validation

### 4. Learner and Admin User Management

- Admin can create learners with required fields.
- Admin can promote or demote users (role updates)
- Admin can soft-delete and restore learners (status updates)

### 5. Campaign Management

- Create campaigns
- Single-type campaign rule enforced (attack OR training)
- Update campaign endpoint
- Delete campaign endpoint
- Learners can only view campaigns assigned to them (or all)

### 6. Campaign Progress Tracking

- Learners can submit progress for assigned campaign items
- Attack simulation statuses
- Status progression protection prevents moving backwards
- Training progress records completion result payload
- Training completion timestamp recorded with completedAt

### 7. Email APIs

- Welcome email endpoint for newly created learners
- Attack simulation email endpoint with custom HTML payload
- Invite signup email for admin-created learner accounts
- Welcome emails rendered from HTML template file
- SMTP integration with configurable environment variables

### 8. Rate Limiting and Input Security

- IP-based in-memory rate limiting utility
- Rate limiting enabled on sensitive endpoints
- Input sanitization and validation utilities:
	- string sanitization
	- object sanitization
	- email validation
	- object id format validation
	- HTML script tag stripping for email payloads

### 9. Error Handling and User Experience

- Unified API error helper
- Cleaner user-facing error messages
- Internal exception details are not exposed to API clients
- Request ID returned for easier debugging and support tracing

## API Endpoints

### Learner APIs

- POST /api/learners/login
- POST /api/learners/logout
- GET /api/learners/signup (invite token lookup)
- POST /api/learners/signup (complete signup with invite token)
- GET /api/learners
- GET /api/learners/campaigns
- POST /api/learners/campaigns
- PATCH /api/learners/campaigns
- DELETE /api/learners/campaigns
- GET /api/learners/progress
- POST /api/learners/progress

### Admin APIs

- GET /api/admin/learners (list learners in admin organisation)
- POST /api/admin/learners (invite learner without password)
- PATCH /api/admin/learners (resend invite with regenerated signup token)
- PATCH /api/admin/users
- POST /api/admin/users

### Email APIs

- POST /api/email/send-welcome
- POST /api/email/send-attack

## Data Model Overview

### Learner document

- email
- password (hashed)
- firstName
- lastName
- country
- department
- role (learner or admin)
- status (active or deleted)
- createdAt
- organisation

### Campaign document

- name
- description
- startDate
- endDate
- users
- type (attack or training)
- assignments
- createdAt
- updatedAt
- createdBy
- organisation

### Campaign progress document

- campaignId
- learnerEmail
- type
- itemId
- status
- result
- completedAt
- createdAt
- updatedAt

## Environment Variables

Create a .env file in the root of the project and add:

- MONGODB_URI
- JWT_SECRET
- APP_BASE_URL
- SMTP_HOST
- SMTP_PORT
- SMTP_SECURE
- SMTP_USER
- SMTP_PASS
- SMTP_FROM

`APP_BASE_URL` should point to the public app URL (for example, `https://your-domain.com`) so invite emails include correct signup links.

## Run the Project

1. Install dependencies:

npm install

2. Run development server:

npm run dev

3. Open in browser:

http://localhost:3000

## Security Notes

- Rate limiting is currently in-memory, which is suitable for a self project and local development
- Organization values are currently hardcoded in middleware for the university scope

## University Showcase Summary

This project demonstrates end-to-end backend engineering practices: secure authentication, role-based authorization, password hashing, session handling, middleware-driven protection, robust input validation, campaign domain logic, progress analytics support, SMTP email workflows, and user-friendly error handling.