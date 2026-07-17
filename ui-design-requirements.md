# Car Sales Record System — UI & Design Requirements

## 1. Overview

This is an internal, single-user business tool for a car dealer to record completed car sales, customers, payments, and related documents. The priority is **clarity, speed of data entry, and easy retrieval** — not marketing polish. Design it like a clean, professional back-office admin tool.

## 2. Design Direction

- **Tone:** Practical, trustworthy, uncluttered. This is a daily-use business tool, not a landing page — avoid heavy decoration, large hero sections, or marketing-style copy.
- **Layout:** Dashboard/admin layout with a persistent left sidebar for navigation and a main content area for data tables and forms.
- **Color palette:** A neutral, professional base (e.g. white/light gray background, dark slate/navy text) with a single accent color used consistently for primary actions and status highlights (e.g. a blue or deep green — avoid the generic "warm cream + terracotta" AI-default look). Define 4–6 named colors, including distinct colors for payment status badges (e.g. green = Paid, amber = Partially Paid, red/gray = Unpaid).
- **Typography:** One clean, highly legible sans-serif for both headings and body (e.g. Inter, IBM Plex Sans, or similar) — this is a data-dense tool, legibility matters more than character. Establish a clear type scale (page titles, section headers, table text, labels/captions).
- **Density:** Favor a moderately dense, information-rich layout (tables, forms) over large whitespace-heavy sections — the user will be scanning lists of sales frequently.
- **Responsiveness:** Must work on desktop (primary use case) and be usable on tablet/mobile for quick lookups on the go.
- **Accessibility:** Visible keyboard focus states, sufficient color contrast (especially on status badges), proper form labels.

## 3. Screens / Pages Required

### 3.1 Login
- Simple centered form: username/email + password, single "Log in" button.
- Error message on failed login.
- No sign-up flow (single hardcoded/admin user).

### 3.2 Sales List (Dashboard / Home)
The main landing page after login. Should show:
- A table/list of all sale records, most recent first, with key columns visible at a glance:
  - Car (make, model, registration number)
  - Customer name
  - Sale date
  - Selling price
  - Payment status (as a colored badge: Paid / Partially Paid / Unpaid)
- **Search bar** for free-text search (customer name, car make/model/reg/VIN).
- **Filter controls** for:
  - Date range (sale date)
  - Payment status
- Clicking a row opens the full Sale Detail page.
- A prominent "Add New Sale" button/action.
- Empty state: if no sales exist yet, show a clear message inviting the user to add their first sale (not a blank table).

### 3.3 Add / Edit Sale (Form)
A multi-section form (can be a single scrollable page or a stepped/tabbed form — designer's choice, but keep it clear which section is which):

**Section A — Car Details**
- Make, model, year, VIN, registration number, color, mileage, notes

**Section B — Customer Details**
- Full name, NIC/ID number, phone, email, address
- Optional: guarantor name + contact (only show/relevant when payment type is Installment/Financing)

**Section C — Sale & Payment Details**
- Sale date, selling price
- Payment type selector: Full / Installment / Financing
- If Installment or Financing selected, reveal additional fields:
  - Down payment
  - Installment amount
  - Frequency (weekly/monthly/custom)
  - Number of installments
  - Next due date
- Notes (free text)

**Section D — Documents & Images**
- Drag-and-drop / click-to-upload area supporting multiple files (PDF or image) at once
- Each uploaded file must let the user assign a category (Car Image / LC Copy / LCE Copy / Screenshot / Other Document) — via a dropdown per file or per batch
- Show upload progress and thumbnails/icons for uploaded files (image thumbnail preview; PDF shown with a PDF icon + filename)
- Ability to remove a file before or after saving

- Clear "Save Sale" action; validation errors shown inline next to the relevant field, not just as a generic banner.

### 3.4 Sale Detail / View Page
Shown when clicking into a sale record. Should present, in clearly separated sections:
- Car details (read view)
- Customer details (read view)
- Payment summary: selling price, amount paid, outstanding balance, payment status badge
- If installment/financing: the installment plan details + a **payment history table** (date, amount, notes) with an "Add Payment" action to log a new payment
- Documents section: gallery/grid of uploaded images with thumbnails (click to view full size), and a list of PDFs/other documents (click to open/download), grouped or filterable by category
- "Edit" action to go back into the edit form
- "Delete Sale" action (with a confirmation step — this is a destructive action, must not be a single accidental click)

### 3.5 Add Payment (Modal or Sub-page)
- Simple form: amount, payment date, optional notes
- Shows updated outstanding balance immediately after submission
- Validation: cannot exceed remaining balance

## 4. Key UI Components Needed

- Sidebar navigation (Dashboard/Sales List, Add New Sale, Logout)
- Data table with sortable columns and pagination (for the sales list)
- Status badge component (color-coded: Paid / Partially Paid / Unpaid)
- Multi-file upload component with category tagging, preview thumbnails, and progress indicator
- Image lightbox/viewer for viewing uploaded car images and document images at full size
- PDF preview or download link component
- Form components: text input, number input, date picker, select/dropdown, textarea — all with clear labels and inline validation error states
- Confirmation dialog (for destructive actions like delete)
- Empty state components (no sales yet, no documents yet, no search results)
- Toast/notification component for save success, upload success, errors

## 5. Content & Voice Guidelines

- Write labels and actions from the user's point of view, in plain terms: "Add New Sale," "Add Payment," "Upload Documents" — not technical/system language.
- Buttons should describe the exact action: "Save Sale," "Delete Sale," "Add Payment" (not vague labels like "Submit" or "OK").
- Error messages should state clearly what went wrong and how to fix it (e.g. "Payment amount cannot exceed the outstanding balance of $X" rather than a generic "Invalid input").
- Empty states should invite action (e.g. "No sales recorded yet — add your first sale to get started" with a button right there).
- Keep all microcopy short, direct, and free of filler/marketing language — this is a functional business tool.

## 6. Explicitly Out of Scope for UI

- No public-facing marketing pages, landing page, or sign-up flow.
- No multi-user role switching or team management UI.
- No analytics/reporting dashboards beyond the basic filterable sales list (can be a future phase).
- No notification center / overdue alert UI.
