export type PartyType = 'seller' | 'buyer';
export type LotStatus = 'auctioned' | 'settled' | 'paid';
export type PaymentMode = 'cash' | 'credit' | 'upi' | 'bank';
export type CashbookEntryType = 'receipt' | 'payment';
export type LabourTxType = 'work' | 'payment';

export interface Party {
  id: string; // locally generated UUID
  name: string;
  phone: string;
  address: string;
  type: PartyType;
  credit_limit?: number; // for buyers
  current_outstanding: number; // outstanding dues for buyers (positive means they owe money)
  archived?: boolean;
}

export interface Lot {
  id: string; // LOT-XXXX format (e.g. LOT-1)
  seller_id: string;
  seller_name: string;
  arrival_date: string; // ISO string
  status: LotStatus;
  total_crates: number;
  total_weight_kg: number;
  gross_sale_amount: number;
  net_payable_to_seller: number;
  labour_id?: string; // ID of the crew/worker allocated to unload
}

export interface CrateAllocation {
  id: string;
  lot_id: string;
  fruit_type: string;
  quality_grade: string;
  qty: number;
  gross_weight_kg: number;
  tare_weight_kg: number;
  net_weight_kg: number;
  rate_per_kg: number;
  sale_amount: number;
  buyer_id: string;
  buyer_name: string;
  payment_mode: PaymentMode;
  is_sold: boolean;
}

export interface LotCharge {
  id: string;
  lot_id: string;
  charge_type: 'commission' | 'labour' | 'weighing' | string;
  amount: number;
  notes: string;
  buyer_id?: string; // set if charge is charged to a buyer (like buyer labour)
  buyer_name?: string;
  qty?: number;
  rate?: number;
}

export interface KhataEntry {
  id: string;
  buyer_id: string;
  buyer_name: string;
  transaction_type: 'sale_credit' | 'payment_received' | 'adjustment';
  amount: number; // positive for debit/sale, positive for credit/payment as well
  lot_id?: string;
  reference_note: string;
  date: string; // ISO string
  balance_after: number; // buyer balance after this transaction
}

export interface CashbookEntry {
  id: string;
  date: string; // ISO string
  entry_type: CashbookEntryType; // receipt (cash in) or payment (cash out)
  party_id?: string;
  party_name: string;
  description: string;
  amount: number;
  mode: PaymentMode;
  labour_tx_id?: string; // foreign key link to prevent desync bugs
  khata_tx_id?: string; // foreign key link to khata entry
  lot_id?: string; // foreign key link to lot
}

export interface LabourWorker {
  id: string;
  name: string;
  phone: string;
  type: string; // e.g. Loader, Driver, Supervisor
  rate_per_crate: number; // default piece-rate
  current_balance: number; // balance owed to the worker (positive means they earned and we owe them)
}

export interface LabourTx {
  id: string;
  labour_id: string;
  date: string; // ISO string
  type: LabourTxType; // work (credits balance) or payment (debits balance)
  description: string;
  crates?: number; // for work
  rate?: number; // for work
  amount: number; // total amount
  mode?: PaymentMode; // for payment (cash, bank, etc)
}

export interface SystemSettings {
  business_name: string;
  owner_name: string;
  phone: string;
  address: string;
  default_commission_percent: number;
  default_labour_per_crate: number;
  default_weighing_per_crate: number;
  fruit_types: string[];
  quality_grades: string[];
  grade_prices: Record<string, number>;
}
