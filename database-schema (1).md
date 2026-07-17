# Car Sales Record System — Database Schema

## 1. Overview

This document defines the complete relational data model for the Car Sales Record System. Use this as the source of truth for the Prisma schema (`schema.prisma`) and PostgreSQL database structure. Do not add tables, fields, or relations beyond what is specified here unless required to satisfy a relation.

## 2. Database & ORM

- **Database:** Azure Database for PostgreSQL (Flexible Server)
- **ORM:** Prisma
- Use UUIDs (`@id @default(uuid())`) as the primary key on every table.
- Every table includes `createdAt` (default now) and `updatedAt` (auto-updated) timestamps.
- Use Prisma enums where noted below rather than plain strings, to enforce valid values at the database level.

## 3. Entities

### 3.1 `Car`
One car record per sale (one-to-one with `Sale`).

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| make | String | required |
| model | String | required |
| year | Int | required |
| vin | String | required, chassis number |
| registrationNumber | String | required, plate number |
| color | String | optional |
| mileage | Int | required, mileage at time of sale |
| notes | Text | optional, free text (condition, engine no., etc.) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### 3.2 `Customer`
| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| fullName | String | required |
| nicNumber | String | required, national ID |
| phone | String | required |
| email | String | optional |
| address | Text | optional |
| guarantorName | String | optional, used for financed/installment sales |
| guarantorContact | String | optional |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### 3.3 `Sale`
Central entity linking a `Car`, a `Customer`, payment info, payment history, and documents.

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| carId | UUID | FK → Car.id, one-to-one, required |
| customerId | UUID | FK → Customer.id, required (many sales could technically share a customer, so this is many-to-one) |
| saleDate | Date | required |
| sellingPrice | Decimal | required, must be positive |
| paymentType | Enum(`FULL`, `INSTALLMENT`, `FINANCING`) | required |
| notes | Text | optional, free text |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Relations:
- `Sale.car` — one-to-one with `Car` (a `Car` row only ever belongs to one `Sale`)
- `Sale.customer` — many-to-one with `Customer`
- `Sale.installmentPlan` — one-to-one with `InstallmentPlan` (nullable — only exists if paymentType is INSTALLMENT or FINANCING)
- `Sale.payments` — one-to-many with `Payment`
- `Sale.documents` — one-to-many with `Document`

Note: `amountPaid`, `outstandingBalance`, and `paymentStatus` are **not stored fields** — they are computed at query time from the related `Payment` records (see the backend logic document for the calculation rules). Do not persist these as columns.

### 3.4 `InstallmentPlan`
Only created when `Sale.paymentType` is `INSTALLMENT` or `FINANCING`.

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| saleId | UUID | FK → Sale.id, one-to-one, required, unique |
| downPayment | Decimal | required |
| installmentAmount | Decimal | required |
| frequency | Enum(`WEEKLY`, `MONTHLY`, `CUSTOM`) | required |
| customFrequencyDays | Int | optional, only used when frequency = CUSTOM |
| numberOfInstallments | Int | required |
| nextDueDate | Date | required |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### 3.5 `Payment`
Payment history log — one row per payment received. Used to compute amount paid / outstanding balance / payment status for a sale.

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| saleId | UUID | FK → Sale.id, required |
| amount | Decimal | required, must be positive |
| paymentDate | Date | required |
| notes | String | optional, e.g. "3rd installment", "bank transfer ref #123" |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### 3.6 `Document`
Stores metadata and a reference URL for each uploaded file. Actual file bytes live in Azure Blob Storage, never in the database.

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| saleId | UUID | FK → Sale.id, required |
| fileUrl | String | required, Azure Blob Storage URL |
| fileType | Enum(`PDF`, `IMAGE`) | required |
| category | Enum(`CAR_IMAGE`, `LC_COPY`, `LCE_COPY`, `SCREENSHOT`, `OTHER_DOCUMENT`) | required |
| originalFileName | String | required |
| uploadedAt | DateTime | default now |
| createdAt | DateTime | |
| updatedAt | DateTime | |

## 4. Relationships Summary

```
Customer 1 ──── * Sale
Car      1 ──── 1 Sale
Sale     1 ──── 1 InstallmentPlan   (nullable)
Sale     1 ──── * Payment
Sale     1 ──── * Document
```

## 5. Schema-Level Constraints

- `Sale.carId` must be unique (enforces one-to-one Car ↔ Sale).
- `InstallmentPlan.saleId` must be unique (enforces one-to-one Sale ↔ InstallmentPlan).
- `sellingPrice`, `downPayment`, `installmentAmount`, and `Payment.amount` must be constrained to positive values (enforce in application/validation layer; Postgres `CHECK` constraints optional but recommended).
- Deleting a `Sale` should cascade-delete its related `Car`, `InstallmentPlan`, `Payment` rows, and `Document` rows (use `onDelete: Cascade` in Prisma relations).
- Index `Customer.fullName`, `Car.registrationNumber`, `Car.vin`, and `Sale.saleDate` to support fast search/filter queries.
