# Kisan Mitra - Mandi Services, Commission Agent & Labour Wages Management System

**Kisan Mitra** (Farmer's Friend) is an offline-first, exceptionally polished, high-performance web enterprise application engineered specifically for Commission Agents (*Adhatiyas*) operating in wholesale vegetable, grain, and fruit markets (*Mandis*).

This application digitizes the core financial, transactional, inventory, and labor-payout operations, completely replacing physical, error-prone bahi-khatas with a highly responsive, fluid, and robust local ledger.

---

## 📖 Mandi Operations & Domain Context

In traditional agricultural markets, transactions are rapid, intensive, and deeply interconnected. The system models the real-world agricultural commerce loop:

1. **Lot Inward (Arrival):** A farmer (*Seller*) arrives at the agent's shop with a truck, tractor, or utility vehicle loaded with produce packed in uniform crates or bags (referred to as a **Lot**).
2. **Cataloging & Weighing:** The produce lot contains multiple items, often categorized by fruit/vegetable type, quality grade (e.g., Fancy, Semi, Super), crate count, gross weight, and container weight (tare weight).
3. **Auctioning & Buyer Allocation:** The agent holds an open auction. Local buyers bid on crate-lots. Once a bid is settled at a rate per kilogram (or unit rate), the crates are distributed. A single incoming lot is typically split among 5 to 15 different buyers at varying prices.
4. **Agent Commissions & Operating Deductions:** 
   * Operating under state agricultural marketing board regulations, the Commission Agent charges a **Commission Fee** (e.g., 5% to 8%) calculated on the total gross sale value of the seller's lot.
   * Standard overhead costs incurred are subtracted: **Labour charges** (*unloading/sorting*), **Weighing fees** (*Tol*), and **Association fees**.
5. **Wages & Labour Force:** Mandis employ manual labor teams (either individual loaders or organized crews called **Labor Gangs/Tolis**) to handle unloading, sorting, and hauling. 
   * These laborers work on piece-rate wages (e.g., ₹15 per crate handled).
   * Accurate credit matching is crucial to ensure that work done during lot arrival automatically calculates, accrues, and credits to their respective labor wages account.
6. **Buyer Settlements (Khata Credit Ledger):** Buyers purchase on short-term trust or credit (*Udhari*). The system updates individual outstanding balances immediately.
7. **Cash Movements (Cashbook):** Daily collections from buyers and cash payments disbursed to farmers and labor teams are cataloged chronologically in a double-entry style register.

---

## 🛠️ Core Application Modules & Advanced Workflows

Kisan Mitra operates as a single-page reactive shell comprising six fully synchronized business modules:

### 1. Interactive Dashboard & Analytics
* **Mandi Stat Boards:** Visualizes critical metrics: Today's Gross Auctions, Total outstanding seller dues, Buyer accounts receivables, and Net cash in hand.
* **Trailing 7-Day Performance Curve:** Uses high-contrast, beautiful charting models (via Chart.js) to map daily auction volumes and cash trends, drawing metrics from localized historical arrays.
* **Quick-Insight Alerts:** Flags active lots that require settlement, negative cash book balances, and labor accounts with heavy outstanding wages.

### 2. Double-Sided Party Directory (Farmers & Buyers)
* **Separation of Concerns:** Displays separate ledgers for Buyers (accounts receivables) and Sellers (accounts payables).
* **Outstanding Balances:** Updates instantly when bills are raised, or ledger cash-entry adjustments are settled.
* **Archival System:** Avoids clutter by allowing the user to hide inactive buyers or seasonal farmers without deleting their historical transactional records.

### 3. Step-by-Step New Lot Entry & Auction Wizard
* **Arrival Data:** Captures arrival date, Vehicle registration number, and default overhead configurations (Association fee, default weighing toll, default crate-loading wage parameters).
* **Crate Intake Ledger:** Calculates the net weight of items mathematically:
  $$\text{Net Weight}_{\text{Item}} = (\text{Gross Weight} - \text{Tare Weight}) \times \text{Crate Quantity}$$
* **Allocation and Auction Split:** Tracks the remaining available crates in real time as the operator records sales. Prevents double-allocation or overselling.
* **Lot Settlement Screen (Step 4):**
  * Displays the combined Gross Revenue sum of all allocations.
  * Calculates Commission values based on customized agent rates.
  * Captures unloading labor teams, automatically projecting labor wages using current lot quantities.
  * Computes the net farmer pay-out check:
    $$\text{Net Farmer Payable} = \text{Gross Sales Amount} - \text{Commission Amount} - \sum \text{Operating Deductions (Weighing, Labour, Fees)}$$

### 4. Advanced Crate Aggregation & Grouping Interface
To keep invoices and lot lists perfectly readable, Kisan Mitra features a smart **Crate Grouping Engine**:
```
[ON] Group Same Type: Tomato | Grade A | ₹45/kg (Group of 12 items)
     ▶ Show Detail Rows
       - Crate #1 (Net: 24kg) 
       - Crate #2 (Net: 23.5kg)
```
* **Grouping Algorithm:** Automatically aggregates crate entities possessing identical `fruit_type`, `quality_grade`, `rate_per_kg`, and `buyer_name`.
* **Sub-Row Expansion:** Users can click to expand any group row to audit or print individual weights, while keeping the parent totals compact.
* **Average Gross Representation:** Displays the calculated average gross weight for clustered crates so bulk pricing can be validated instantly.

### 5. Comprehensive Labour & Crew Wages Ledger
Designed to handle local labor dynamics, this module supports granular tracking for individual loaders and group crews:
* **Crew / Gang Hierarchy:** Supports creating high-volume crews (e.g., *"Ramu Mandi Gang"* with 8 people) or single-loader personnel.
* **Piece-Rate Configurations:** Defines default crate loading and sorting rates per item for each worker/crew.
* **Transactional Accrual Operations:**
  1. **Lot Auto-Accrual:** During Lot Finalization, selecting an unloading crew generates a ledger credit record in the Labour Transaction table and adds the calculated amount to their balance.
  2. **Manual Work Cards:** Operators can log generic labor tasks (sorting, cleanups) or link wages directly to previously finalized historical lots from a dropdown.
  3. **Wages Payouts & Cashbook Integration:** Recording cash, bank, or UPI payouts automatically:
     * Decreases the worker's outstanding unpaid ledger balance.
     * Records an official expense debit in the central Cashbook with worker-specific remarks.

### 6. Khata Ledger & Chronological Cashbook
* **Credit Ledgers:** Buyer cards display full transaction history logs of purchases, cash payments, and chronological balances.
* **Double-Entry Cashbook:** Records cash-inflow receipts and outflow payments. Allows filtering by specific calendar dates to auditing daily drawer cash balances (*Galla Account*).

---

## 🏗️ Technical Architecture & Technology Stack

Kisan Mitra is engineered with a **client-first, local-persistence, non-blocking** runtime environment to ensure maximum reliability inside busy local wholesale markets.

```
       ┌────────────────────────────────────────────────────────┐
       │                Kisan Mitra Client (DOM)                │
       └─────────────────────────┬──────────────────────────────┘
                                 │
                   [Reactive Alpine.js Bindings]
                                 │
                                 ▼
       ┌────────────────────────────────────────────────────────┐
       │             Central Alpine.js State Engine             │
       ├────────────────────────────────────────────────────────┤
       │ • parties[]   • lots[]   • crates[]     • charges[]     │
       │ • cashbook[]  • settings • labourList[] • transactions[]│
       └─────────────────────────┬──────────────────────────────┘
                                 │
                        [Sync Hook on Save]
                                 │
                                 ▼
       ┌────────────────────────────────────────────────────────┐
       │          JSON-Serialized Browser LocalStorage          │
       └────────────────────────────────────────────────────────┘
```

### 1. Alpine.js (State Optimization & Reactivity)
The logic operates using a declarative UI framework. All operations are kept synchronous within browser memory:
* `parties`, `lots`, `crates`, `charges`, `khata`, `cashbook`, `labourList`, `labourTransactions` represent the operational dataset.
* Computeds and filtered views (like `getDisplayRows()`, `getFilteredLabourList()`, and `getLabourTransactions()`) run on-the-fly to guarantee 0ms interface lag.

### 2. Tailwind CSS & Print Invoicing Frame
* **Primary Theme:** Modern, eye-safe slate theme combining dark graphite elements (`bg-slate-950`) with elegant high-contrast blue (`text-blue-400`) and emerald highlights.
* **Dual-Format Printing Engine:** Relies on tailored print media css rules (`@media print`):
  * **Seller Copy (Wide Standard A4):** Hides application sidebars, navigations, action items, toggles, and filters. Renders full-width balance tables, itemized lot breakdowns, and detailed agent commissions.
  * **Buyer Slip (Fluid Thermal Receipt):** Auto-reconfigures columns on thin 80mm thermal rolls, drops background fills to preserve ink, and prints compact sale records for instant customer Handouts.

### 3. Local-First Seed & Recovery Engine
* Seeding logic uses `seedData()` to populate empty databases on first-time load, allowing immediate exploration of the software without manually completing configuration wizards.
* Safety backups use deep-nested local state caching to store active drafts (`ca_draft_nl`), ensuring that physical computer crashes, browser refreshes, or navigation misclicks do NOT lose complex multi-crate data.

---

## 🗄️ Relational Data Models (Schemas)

Data arrays are linked logically using deterministic IDs. All decimal fields are enforced as floating-point floats:

### 1. Parties (`ca_parties`)
```ts
interface Party {
  id: string;                 // Deterministic Unique ID matching 'seller' | 'buyer'
  name: string;               // Display Name of the merchant/farmer
  type: 'seller' | 'buyer';   // Role type
  phone: string;              // 10-Digit Contact Information
  current_outstanding: number;// Outstanding financial value (positive = owe, negative/zero = net settled)
  archived?: boolean;         // Soft delete tag to clean active filters
}
```

### 2. Lots (`ca_lots`)
```ts
interface Lot {
  id: string;                 // Unique identifier sequence (e.g., LOT-1002)
  seller_id: string;          // Foreign key linking to ca_parties (type: 'seller')
  seller_name: string;        // Denormalized name field for performance
  arrival_date: string;       // ISO Date Representation (YYYY-MM-DD)
  vehicle_no: string;         // Transport details
  status: 'arrival' | 'auctioned' | 'paid';
  total_crates: number;       // Accumulated crate volume
  gross_sale_amount: number;  // Gross auctions sum
  commission_amt: number;     // Deducted commission (₹)
  net_payable_to_seller: number; // Net cash due to farmer (₹)
}
```

### 3. Crates / Allocations (`ca_crates`)
```ts
interface Crate {
  id: string;                 // Unique key
  lot_id: string;             // Relational matches to ca_lots
  fruit_type: string;         // e.g. Tomato, Potato, Apple
  quality_grade: string;      // e.g. Super, Medium, Grade-B
  qty: number;                // Pack count
  net_weight_kg: number;      // Net weight value
  gross_weight_kg: number;    // Gross weight value
  rate_per_kg: number;        // Purchase rate per kg
  buyer_name: string;         // Allocated buyer name
  sale_amount: number;        // (net_weight_kg * rate_per_kg * qty)
}
```

### 4. Labour Directory (`ca_labourList`)
```ts
interface LabourWorker {
  id: string;                 // Unique ID (e.g., lab_104)
  name: string;               // Crew Leader name or Individual worker name
  phone: string;              // Worker Contact details
  type: 'group' | 'individual'; // Direct labor style mapping
  member_count: number;       // Size of crew (Group uses customizable, Individual defaults to 1)
  rate_per_crate: number;     // Wage configuration (₹ per crate handled)
  current_balance: number;    // Accumulated outstanding wage due to them (₹)
}
```

### 5. Labour Transactions (`ca_labourTransactions`)
```ts
interface LabourTransaction {
  id: string;                 // Unique sequence key
  labour_id: string;          // Foreign key to ca_labourList
  date: string;               // ISO Timestamp
  type: 'work' | 'payment';   // Accrued earnings vs Wage payout
  description: string;        // Context notes (e.g. "Lot Handled: LOT-12")
  crates?: number;            // Crate metrics if applicable to calculate wage
  rate?: number;              // Material price per crate if piece-rate
  amount: number;             // Financial transaction value (₹)
  mode?: 'cash' | 'upi' | 'bank'; // Payment method used for payout
}
```

### 6. Central Cashbook (`ca_cashbook`)
```ts
interface CashbookEntry {
  id: string;                 // Transaction record key
  date: string;               // ISO Timestamp or simple local date
  entry_type: 'receipt' | 'payment'; // Cash in vs Cash out
  party_id: string;           // Optional associated party key (Buyer/Seller/Labourer)
  party_name: string;         // Denormalized name
  description: string;        // Full context log
  amount: number;             // Currency value (₹)
  mode?: 'cash' | 'upi' | 'bank'; // Channel utilized
}
```

---

## 📐 Business Formulas & Calculations

Operational math is strictly calculated with decimal precision handling in Javascript:

### 1. Lot Weights and Revenue
* For any single crate entry, the Net weight of produce is derived by subtracting the container's physical empty tare from the gross scale reading:
  $$\text{Net Weight } (kg) = \text{Gross Weight } (kg) - \text{Tare Weight } (kg)$$
* Revenue for a single allocated auction unit is computed as:
  $$\text{Sale Value } (₹) = \text{Crate Qty} \times \text{Net Weight } (kg) \times \text{Auction Bid Rate per kg}$$
* Total Gross Lot Value is the sum of all individual allocations:
  $$\text{Gross Lot Sale} = \sum_{i=1}^{n} \text{Sale Value}_i$$

### 2. Overhead Deductions & Farmer Net Pay
* **Commission Deductions:** Computed as a flat percentage on Gross Lot Sales:
  $$\text{Commission} = \text{Gross Lot Sale} \times \left(\frac{\text{Commission Rate \%}}{100}\right)$$
* **Other Agency Deductions:** Flat charges (Association, Toll Fee, and Labour Rates) configured during step 1:
  $$\text{Tol (Weighing Fee)} = \text{Crate Volume} \times \text{Weighing Toll Rate per Crate}$$
  $$\text{Unloading Labour Charge} = \text{Crate Volume} \times \text{Labour Surcharge Rate per Crate}$$
* **Farmer Receivable Final Ledger Settlement:**
  $$\text{Net Farmer Due} = \text{Gross Lot Sale} - \text{Commission} - \text{Weighing Tol} - \text{Unloading Labour} - \text{Association Fee}$$

### 3. Labour Wages Calculations
Piece-rate calculations allow flexible payroll processing:
* **Piece-rate Wage Accrual:**
  $$\text{Wages Earned} = \text{Crates Handled} \times \text{Crew Rate per Crate}$$
* **Wages Ledger Outstanding Balancing:**
  $$\text{Worker Balance Due} = \sum \text{Wages Earned} - \sum \text{Wage Payouts Received}$$

---

## ⚡ Quick Start & Maintenance Guide

### 1. Development Mode
Start the Node.js hot-reloaded development environment:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

### 2. Standalone Portability
Since Kisan Mitra is built as an inline monolithic SPA, you do not need active cloud network servers to run this in production. You can simply file-transfer the compiled `index.html` file into any local computer or tablet:
* Open `index.html` inside Google Chrome or Microsoft Edge.
* Bookmark the tab. All entries, calculations, and tables populate and autosave inside the browser's persistent sandbox disk automatically.

### 3. Performance Printing Tips
* For thermal operations, connect your 80mm/3-inch receipt printers to your local terminal.
* Under Chrome/Edge print options, ALWAYS enable/tick **"Background Graphics"** inside the settings slider and configure margins to **"None"** to ensure the beautiful slate highlights, badge colors, and line spacers display flawlessly on paper.
