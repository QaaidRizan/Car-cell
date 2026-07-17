# Car Sales Record System — Backend Logic & API Requirements

> This document assumes the data model defined in `database-schema.md`. Refer to that file for entity/field definitions — this document covers application behavior, business rules, and API design on top of that schema.

## 1. Overview

Build a single-user web application to record and manage **completed car sales**. This is not an inventory/pre-sale management system — every record represents a car that has already been sold. The system tracks the car, the buyer, the sale/payment details, and all supporting documents (images and PDFs) tied to that sale.

## 2. Tech Stack

- **Framework:** Next.js (React) — single codebase for frontend + backend (API routes)
- **Hosting:** Azure App Service (deploy the Next.js app as a single service)
- **Database:** Azure Database for PostgreSQL (Flexible Server), accessed via Prisma (see `database-schema.md`)
- **File Storage:** Azure Blob Storage (store files here; store only URL + metadata in Postgres)
- **Auth:** Simple credentials-based login (single user, e.g. NextAuth with a credentials provider or a lightweight custom session/JWT). No roles or multi-user permissions needed.

## 3. Business Logic

### 3.1 Payment status calculation
For every `Sale`, derive payment figures from its related `Payment` records — these are computed at query/response time, never stored as columns:
- `amountPaid` = sum of all `Payment.amount` for that sale
- `outstandingBalance` = `sellingPrice - amountPaid`
- `paymentStatus`:
  - `PAID` — outstandingBalance <= 0
  - `PARTIALLY_PAID` — 0 < amountPaid < sellingPrice
  - `UNPAID` — amountPaid = 0 (relevant mainly for installment/financing sales)
- For `paymentType = FULL`, still create a `Payment` record for the full `sellingPrice` on the sale date, so `amountPaid`/`paymentStatus` logic stays consistent across all payment types (don't special-case full payments as "automatically paid" without a payment row).
- No automated overdue alerts/notifications are required — payment status is simply displayed wherever sales are listed or viewed. Do not build a notification/alert system.

### 3.2 File uploads
- Support uploading multiple files (PDF or image) per sale, in any combination.
- Each file must be tagged with a `category` on upload (see `Document.category` enum in the schema doc).
- Files are uploaded directly to Azure Blob Storage; only the resulting URL and metadata are saved in Postgres — never store raw file bytes in the database.
- Support common image formats (jpg, jpeg, png, webp) and PDF. Reject other file types with a clear error.
- Enforce a max file size limit (e.g. 20MB per file) and return a clear error if exceeded.
- Support deleting an individual document from a sale (remove from both Blob Storage and the database).

### 3.3 Search & filter
Implement a search/filter API for sales that supports:
- Filter by customer name (partial match)
- Filter by date range (sale date)
- Filter by car (make, model, registration number, or VIN — partial match)
- Filter by payment status (`PAID`, `PARTIALLY_PAID`, `UNPAID`) — computed per §3.1, applied as a post-query filter or a derived SQL condition
- Combine multiple filters at once
- Sort by sale date (default: newest first)
- Paginate results (default page size, e.g. 25 per page)

### 3.4 Payment recording rules
- When adding a `Payment` to a sale, validate that `amountPaid + newPaymentAmount` does not exceed `sellingPrice`. Reject with a clear error if it would.
- Recalculate and return the updated `amountPaid`, `outstandingBalance`, and `paymentStatus` in the response after a payment is recorded.

### 3.5 Sale creation/deletion rules
- Creating a `Sale` requires creating (or linking) a `Car` and a `Customer` in the same transaction.
- If `paymentType` is `INSTALLMENT` or `FINANCING`, an `InstallmentPlan` must be created in the same transaction as the `Sale`.
- Deleting a `Sale` cascades to delete its related `Car`, `InstallmentPlan`, `Payment` records, and `Document` records (both DB rows and the underlying Blob Storage files — deleting DB rows alone is not sufficient, orphaned blobs must be cleaned up too).

## 4. API Endpoints

Design REST (or Next.js API route) endpoints covering:

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Log in (single user) |
| POST | `/api/auth/logout` | Log out |
| POST | `/api/sales` | Create a new sale (car + customer + sale details, transactional) |
| GET | `/api/sales` | List/search/filter sales (query params for all filters in §3.3, paginated) |
| GET | `/api/sales/:id` | Get full sale detail (car, customer, computed payment info, documents) |
| PATCH | `/api/sales/:id` | Update sale/car/customer details |
| DELETE | `/api/sales/:id` | Delete a sale (cascades per §3.5) |
| POST | `/api/sales/:id/payments` | Record a new payment against a sale |
| GET | `/api/sales/:id/payments` | List payment history for a sale |
| POST | `/api/sales/:id/documents` | Upload a document/image (multipart → Blob Storage → save metadata) |
| GET | `/api/sales/:id/documents` | List documents for a sale |
| DELETE | `/api/documents/:id` | Delete a specific document (DB row + blob) |

## 5. Validation Rules

- Required fields: `car.vin`, `car.registrationNumber`, `sale.sellingPrice`, `sale.saleDate`, `customer.fullName`, `customer.nicNumber`, `customer.phone`.
- `sellingPrice` and all payment amounts must be positive numbers.
- If `paymentType` is `INSTALLMENT` or `FINANCING`, all `InstallmentPlan` fields (except `customFrequencyDays`, which is conditional) are required.
- Sum of recorded `Payment` amounts must never exceed `sellingPrice` (see §3.4).
- Uploaded files must be validated for type (PDF/image only) and size before accepting (see §3.2).
- Return structured, field-level validation errors (not just a generic "invalid input" message) so the frontend can highlight the specific field.

## 6. Non-Functional Requirements

- Single authenticated user — protect all API routes and pages behind login; no public access.
- Environment variables for DB connection string, Blob Storage connection string/SAS, and auth secret — no secrets hardcoded.
- Consistent, meaningful error responses on all API endpoints (validation failure, not found, upload failure, server error) with appropriate HTTP status codes.
- Deployment target: Azure App Service, single Next.js app, straightforward CI/CD (e.g. GitHub Actions or Azure DevOps pipeline) triggered on git push.

## 7. Out of Scope (explicitly excluded)

- No inventory/pre-sale car management (this system only records completed sales).
- No multi-user roles or permissions.
- No automated overdue payment notifications/alerts.
- No reporting/analytics dashboards beyond basic search/filter/list views (can be added later as a separate phase).
