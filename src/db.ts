import Dexie, { type Table } from 'dexie';
import { Party, Lot, CrateAllocation, LotCharge, KhataEntry, CashbookEntry, LabourWorker, LabourTx } from './types';

export class KisanMitraDB extends Dexie {
  parties!: Table<Party>;
  lots!: Table<Lot>;
  crates!: Table<CrateAllocation>;
  charges!: Table<LotCharge>;
  khata!: Table<KhataEntry>;
  cashbook!: Table<CashbookEntry>;
  labourList!: Table<LabourWorker>;
  labourTransactions!: Table<LabourTx>;

  constructor() {
    super('KisanMitraDB');
    this.version(1).stores({
      parties: 'id, name, type, archived',
      lots: 'id, seller_id, status, arrival_date',
      crates: 'id, lot_id, buyer_id, is_sold',
      charges: 'id, lot_id, buyer_id',
      khata: 'id, buyer_id, date, lot_id',
      cashbook: 'id, date, entry_type, labour_tx_id',
      labourList: 'id, name',
      labourTransactions: 'id, labour_id, date, type'
    });
    this.version(2).stores({
      parties: 'id, name, type, archived',
      lots: 'id, seller_id, status, arrival_date',
      crates: 'id, lot_id, buyer_id, is_sold',
      charges: 'id, lot_id, buyer_id',
      khata: 'id, buyer_id, date, lot_id',
      cashbook: 'id, date, entry_type, labour_tx_id, khata_tx_id, lot_id',
      labourList: 'id, name',
      labourTransactions: 'id, labour_id, date, type'
    });
  }
}

export const db = new KisanMitraDB();

// Helper to generate IDs similar to the original app's genId()
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Function to migrate from localStorage and seed default demo data if empty
export async function initializeDatabase() {
  const partiesCount = await db.parties.count();
  if (partiesCount > 0) {
    // Database already initialized
    return;
  }

  // Check if we have legacy localStorage data
  const hasLegacyData = localStorage.getItem('ca_parties') !== null;

  if (hasLegacyData) {
    console.log('Legacy data found in localStorage. Migrating to IndexedDB...');
    try {
      const parties: Party[] = JSON.parse(localStorage.getItem('ca_parties') || '[]');
      const lots: Lot[] = JSON.parse(localStorage.getItem('ca_lots') || '[]');
      const crates: CrateAllocation[] = JSON.parse(localStorage.getItem('ca_crates') || '[]');
      const charges: LotCharge[] = JSON.parse(localStorage.getItem('ca_charges') || '[]');
      const khata: KhataEntry[] = JSON.parse(localStorage.getItem('ca_khata') || '[]');
      const cashbook: CashbookEntry[] = JSON.parse(localStorage.getItem('ca_cashbook') || '[]');
      const labourList: LabourWorker[] = JSON.parse(localStorage.getItem('ca_labourList') || '[]');
      const labourTransactions: LabourTx[] = JSON.parse(localStorage.getItem('ca_labourTransactions') || '[]');

      await db.transaction('rw', [
        db.parties, db.lots, db.crates, db.charges, db.khata, db.cashbook, db.labourList, db.labourTransactions
      ], async () => {
        if (parties.length) await db.parties.bulkAdd(parties);
        if (lots.length) await db.lots.bulkAdd(lots);
        if (crates.length) await db.crates.bulkAdd(crates);
        if (charges.length) await db.charges.bulkAdd(charges);
        if (khata.length) await db.khata.bulkAdd(khata);
        if (cashbook.length) await db.cashbook.bulkAdd(cashbook);
        if (labourList.length) await db.labourList.bulkAdd(labourList);
        if (labourTransactions.length) await db.labourTransactions.bulkAdd(labourTransactions);
      });

      console.log('Legacy data migration completed successfully!');
      // Back up old localStorage values under a backup prefix and remove original keys to prevent re-migration
      localStorage.setItem('backup_ca_parties', localStorage.getItem('ca_parties') || '');
      localStorage.removeItem('ca_parties');
      return;
    } catch (e) {
      console.error('Failed to migrate legacy localStorage data', e);
    }
  }

  // If no legacy data and DB is empty, seed demo data
  console.log('No data found in database or localStorage. Seeding default demo data...');
  
  const defaultSettings = {
    business_name: "Kisan Trading Co.",
    owner_name: "Ramesh Aggarwal",
    phone: "9876543210",
    address: "Mandi Market",
    default_commission_percent: 6,
    default_labour_per_crate: 15,
    default_weighing_per_crate: 5,
    fruit_types: ["Mango", "Banana", "Apple", "Grapes", "Pomegranate", "Orange", "Guava", "Other"],
    quality_grades: ["A1", "A2", "B", "C"],
    grade_prices: {"A1": 800, "A2": 600, "B": 400, "C": 200}
  };
  
  if (!localStorage.getItem('ca_settings')) {
    localStorage.setItem('ca_settings', JSON.stringify(defaultSettings));
  }

  const s = [
    { n: 'Ramesh Patil', p: '9876543210', a: 'Nagpur' },
    { n: 'Suresh Deshmukh', p: '9765432109', a: 'Amravati' },
    { n: 'Vijay Wankhede', p: '9654321098', a: 'Wardha' },
    { n: 'Prakash Shinde', p: '9543210987', a: 'Yavatmal' }
  ];
  
  const b = [
    { n: 'Mohan Traders', p: '9432109876', cl: 100000, co: 34500 },
    { n: 'Sanjay Fruits', p: '9321098765', cl: 75000, co: 12000 },
    { n: 'Ravi Wholesale', p: '9210987654', cl: 200000, co: 0 },
    { n: 'Nilesh Retail', p: '9109876543', cl: 50000, co: 48200 },
    { n: 'Om Enterprises', p: '9098765432', cl: 150000, co: 67800 },
    { n: 'Ganesh Cold Store', p: '8987654321', cl: 300000, co: 0 }
  ];

  const labourWorkers = [
    { id: 'l1', name: 'Raju Loader Gang', phone: '9988776655', type: 'Loader', rate_per_crate: 15, current_balance: 1125 },
    { id: 'l2', name: 'Karan Crew', phone: '8877665544', type: 'Loader', rate_per_crate: 15, current_balance: 0 }
  ];

  const partiesList: Party[] = [];
  s.forEach((x, i) => {
    partiesList.push({
      id: 's' + (i + 1),
      name: x.n,
      phone: x.p,
      address: x.a,
      type: 'seller',
      current_outstanding: 0
    });
  });
  b.forEach((x, i) => {
    partiesList.push({
      id: 'b' + (i + 1),
      name: x.n,
      phone: x.p,
      address: 'Mandi Area, Stall ' + (i + 1),
      type: 'buyer',
      credit_limit: x.cl,
      current_outstanding: x.co
    });
  });

  let y = new Date();
  y.setDate(y.getDate() - 1);
  const yIso = y.toISOString();
  
  let y3 = new Date();
  y3.setDate(y3.getDate() - 3);
  const y3Iso = y3.toISOString();

  const lotsList: Lot[] = [
    {
      id: 'LOT-1',
      seller_id: 's1',
      seller_name: 'Ramesh Patil',
      arrival_date: y3Iso,
      status: 'settled',
      total_crates: 35,
      total_weight_kg: 525,
      gross_sale_amount: 21300,
      net_payable_to_seller: 19318,
      labour_id: 'l1'
    },
    {
      id: 'LOT-2',
      seller_id: 's2',
      seller_name: 'Suresh Deshmukh',
      arrival_date: yIso,
      status: 'auctioned',
      total_crates: 40,
      total_weight_kg: 720,
      gross_sale_amount: 22200,
      net_payable_to_seller: 20068,
      labour_id: 'l1'
    }
  ];

  const cratesList: CrateAllocation[] = [];
  // Lot 1 Crates
  for (let i = 0; i < 20; i++) {
    cratesList.push({
      id: 'c1_' + i,
      lot_id: 'LOT-1',
      fruit_type: 'Mango',
      quality_grade: 'A1',
      qty: 1,
      gross_weight_kg: 15.5,
      tare_weight_kg: 0.5,
      net_weight_kg: 15,
      rate_per_kg: 52,
      sale_amount: 780,
      buyer_id: 'b1',
      buyer_name: 'Mohan Traders',
      payment_mode: 'credit',
      is_sold: true
    });
  }
  for (let i = 0; i < 15; i++) {
    cratesList.push({
      id: 'c2_' + i,
      lot_id: 'LOT-1',
      fruit_type: 'Mango',
      quality_grade: 'A2',
      qty: 1,
      gross_weight_kg: 15.5,
      tare_weight_kg: 0.5,
      net_weight_kg: 15,
      rate_per_kg: 38,
      sale_amount: 570,
      buyer_id: 'b2',
      buyer_name: 'Sanjay Fruits',
      payment_mode: 'cash',
      is_sold: true
    });
  }
  // Lot 2 Crates
  for (let i = 0; i < 20; i++) {
    cratesList.push({
      id: 'c3_' + i,
      lot_id: 'LOT-2',
      fruit_type: 'Banana',
      quality_grade: 'B',
      qty: 1,
      gross_weight_kg: 20.5,
      tare_weight_kg: 0.5,
      net_weight_kg: 20,
      rate_per_kg: 18,
      sale_amount: 360,
      buyer_id: 'b3',
      buyer_name: 'Ravi Wholesale',
      payment_mode: 'cash',
      is_sold: true
    });
  }
  for (let i = 0; i < 10; i++) {
    cratesList.push({
      id: 'c4_' + i,
      lot_id: 'LOT-2',
      fruit_type: 'Banana',
      quality_grade: 'B',
      qty: 1,
      gross_weight_kg: 20.5,
      tare_weight_kg: 0.5,
      net_weight_kg: 20,
      rate_per_kg: 18,
      sale_amount: 360,
      buyer_id: 'b5',
      buyer_name: 'Om Enterprises',
      payment_mode: 'credit',
      is_sold: true
    });
  }
  for (let i = 0; i < 10; i++) {
    cratesList.push({
      id: 'c5_' + i,
      lot_id: 'LOT-2',
      fruit_type: 'Grapes',
      quality_grade: 'A1',
      qty: 1,
      gross_weight_kg: 12.5,
      tare_weight_kg: 0.5,
      net_weight_kg: 12,
      rate_per_kg: 95,
      sale_amount: 1140,
      buyer_id: 'b1',
      buyer_name: 'Mohan Traders',
      payment_mode: 'credit',
      is_sold: true
    });
  }

  const chargesList: LotCharge[] = [
    { id: 'ch1', lot_id: 'LOT-1', charge_type: 'commission', amount: 1278, notes: 'Commission (6%)' },
    { id: 'ch2', lot_id: 'LOT-1', charge_type: 'labour', amount: 525, notes: 'Labour' },
    { id: 'ch3', lot_id: 'LOT-1', charge_type: 'weighing', amount: 175, notes: 'Weighing' },
    { id: 'ch4', lot_id: 'LOT-2', charge_type: 'commission', amount: 1332, notes: 'Commission (6%)' },
    { id: 'ch5', lot_id: 'LOT-2', charge_type: 'labour', amount: 600, notes: 'Labour' },
    { id: 'ch6', lot_id: 'LOT-2', charge_type: 'weighing', amount: 200, notes: 'Weighing' }
  ];

  const khataList: KhataEntry[] = [
    { id: 'k1', buyer_id: 'b1', buyer_name: 'Mohan Traders', transaction_type: 'sale_credit', amount: 15600, lot_id: 'LOT-1', reference_note: 'Lot sale: LOT-1', date: y3Iso, balance_after: 15600 },
    { id: 'k2', buyer_id: 'b5', buyer_name: 'Om Enterprises', transaction_type: 'sale_credit', amount: 3600, lot_id: 'LOT-2', reference_note: 'Lot sale: LOT-2', date: yIso, balance_after: 3600 },
    { id: 'k3', buyer_id: 'b1', buyer_name: 'Mohan Traders', transaction_type: 'sale_credit', amount: 11400, lot_id: 'LOT-2', reference_note: 'Lot sale: LOT-2', date: yIso, balance_after: 27000 }
  ];

  const cashbookList: CashbookEntry[] = [
    { id: 'cb1', date: y3Iso, entry_type: 'receipt', party_id: 'b2', party_name: 'Sanjay Fruits', description: 'Sale payment (cash) for LOT-1', amount: 8550, mode: 'cash' },
    { id: 'cb2', date: yIso, entry_type: 'receipt', party_id: 'b3', party_name: 'Ravi Wholesale', description: 'Sale payment (cash) for LOT-2', amount: 7200, mode: 'cash' }
  ];

  const labourTxList: LabourTx[] = [
    { id: 'lt1', labour_id: 'l1', date: y3Iso, type: 'work', description: 'Lot Unloading handling: LOT-1 (35 Crates)', crates: 35, rate: 15, amount: 525 },
    { id: 'lt2', labour_id: 'l1', date: yIso, type: 'work', description: 'Lot Unloading handling: LOT-2 (40 Crates)', crates: 40, rate: 15, amount: 600 }
  ];

  await db.transaction('rw', [
    db.parties, db.lots, db.crates, db.charges, db.khata, db.cashbook, db.labourList, db.labourTransactions
  ], async () => {
    await db.parties.bulkAdd(partiesList);
    await db.lots.bulkAdd(lotsList);
    await db.crates.bulkAdd(cratesList);
    await db.charges.bulkAdd(chargesList);
    await db.khata.bulkAdd(khataList);
    await db.cashbook.bulkAdd(cashbookList);
    await db.labourList.bulkAdd(labourWorkers);
    await db.labourTransactions.bulkAdd(labourTxList);
  });

  console.log('Demo data seeded successfully!');
}
