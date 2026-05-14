# Surge Platform Backend (Auth-Only)

This backend has been reduced to user authentication and user profile endpoints.

## Active Modules

- `AuthModule`
- `UsersModule`
- `ContextModule`
- `MailerModule`

## Active Routes

- `GET /`
- `POST /auth/register`
- `POST /auth/verify-email`
- `POST /auth/resend-otp`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/request-password-reset`
- `POST /auth/reset-password`
- `GET /users/me`

## Register Payload

`POST /auth/register` now requires:

- `email` (string, email)
- `password` (string, min 6)
- `age` (integer, 1-120)
- `gender` (`male` | `female` | `other`)

Optional fields:

- `fullName`
- `phoneNumber`
- `avatarKey`
- `role` (`customer` | `vendor` | `staff`)

## Removed Feature Domains

- LMS
- Enrollment
- Shop
- Order
- Storage
