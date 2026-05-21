# Project Details: Kisan Mitra (Mandi Services)

Kisan Mitra is an offline-first Mandi Commission Agent Management & Ledger system. It helps commission agents (Adhatiyas) track fruit arrivals (lots), auction allocations to buyers, calculate commissions and fees, manage seller/buyer ledgers (Khata), record cash flow (Cashbook), and manage labor crew wages.

---

## 1. Core Architecture & Tech Stack

The application is built on a modern, compiled, battle-tested, offline-first stack:
- **Framework**: React 19 + TypeScript + Vite 6
- **Database (Offline)**: Dexie.js (IndexedDB wrapper) with schema versioning. It automatically migrates legacy `localStorage` data on first launch to ensure data safety.
- **Styling**: Tailwind CSS v4 with custom styling support for three themes:
  - **Dark Theme (Default)**: Pitch-black Vercel-style theme.
  - **Light Theme**: Warm cream/latte theme.
  - **Bazaar Theme**: Orange/lime mandi-accented theme.
- **Visualization**: Chart.js (daily commission analytics bar chart).
- **Icons**: Lucide React.
- **Printing**: Native A4 browser printing and raw ESC/POS binary buffers for thermal receipts (58mm/80mm Bluetooth or USB printers).

---

## 2. Directory Structure

```
e:/Fruit market 21-05/
├── public/                  # Static assets and PWA icons
├── src/
│   ├── components/          # React panels for each tab
│   │   ├── Dashboard.tsx    # Key metrics & commission bar chart
│   │   ├── Parties.tsx      # Seller and Buyer directories
│   │   ├── NewLotWizard.tsx # Multi-step lot receipt and sale allocation
│   │   ├── KhataLedger.tsx  # Buyer account ledgers & collections
│   │   ├── Cashbook.tsx     # Double-entry cash inflow & outflow register
│   │   ├── LabourWages.tsx  # Worker personnel, jobs, payouts & balance syncing (TODO)
│   │   └── Settings.tsx     # Default rates, business info, JSON backup/restore (TODO)
│   ├── App.tsx              # Sidebar wrap, active tab control, theme sync
│   ├── main.tsx             # Entry point & Dexie initializer loading screen
│   ├── db.ts                # Dexie database definitions & migration logic
│   ├── types.ts             # Domain typescript definitions
│   ├── printing.ts          # Invoice, report & ESC/POS printers
│   └── index.css            # Global CSS, theme vars, and @media print rules
├── package.json             # Core dependency settings
└── vite.config.ts           # Vite + PWA configs
```

---

## 3. Database Schema (IndexedDB)

The tables are configured in [src/db.ts](file:///e:/Fruit%20market%2021-05/src/db.ts):

| Table Name | Key Path | Indices | Description |
| :--- | :--- | :--- | :--- |
| `parties` | `id` | `name, type, archived` | Sellers & Buyers list (includes credit limits) |
| `lots` | `id` | `seller_id, status, arrival_date` | Record of arrivals and net payable summaries |
| `crates` | `id` | `lot_id, buyer_id, is_sold` | Individual crate auction entries |
| `charges` | `id` | `lot_id, buyer_id` | Commissions, unloading fees, and weighing charges |
| `khata` | `id` | `buyer_id, date, lot_id` | Transaction ledger records for buyers |
| `cashbook` | `id` | `date, entry_type, labour_tx_id` | Central cash inflow and outflow transactions |
| `labourList` | `id` | `name` | Worker crews and default wage piece-rates |
| `labourTransactions`| `id` | `labour_id, date, type` | Worker wages logs (work credits, payment debits) |

---

## 4. Key Workflows & Business Rules

### A. Lot Settlement & Allocation (NewLotWizard)
1. **Arrival**: Seller selected, lot date, and total crates set.
2. **Crate Inputs**: Crate configurations added (fruit type, quality grade, gross/tare weights).
3. **Buyer Allocation**: Crates allocated to buyers. If allocated on credit, the app checks if outstanding + draft total exceeds the buyer's credit limit, issuing warnings.
4. **Charges & Settlement**: Automates commission, labour, and weighing charges. Finalizes gross and net payables to the seller. Creates corresponding buyer khata entries and loader wages transactions.

### B. Buyer Account Ledger (KhataLedger)
- Track outstanding balances for credit buyers.
- Record cash/UPI collection entries that automatically post receipts in the central cashbook.

### C. Cashbook Transactions
- Maintain cash book registers.
- All collections and manual expense inputs are recorded here.

### D. Labour Crew Wages (Cascading Deletions)
- Loader crew earn credits on lots (unloading work based on crates handled).
- Crew can receive cash payouts which log cashbook outflows.
- **Double-Entry Safeguard**: Deleting a wage payout transaction in the Labour ledger must search for and delete the matching outflow cashbook entry (using `labour_tx_id` mapping) to ensure cash registers and ledger balances remain perfectly in sync.

### E. Business Settings & Data Sync
- Configure business header data (name, address, owner details).
- Customize fruit lists, quality levels, and standard pricing rules.
- Offline backups: Export database tables to a local JSON file, or restore/import a JSON file back into the tables.
