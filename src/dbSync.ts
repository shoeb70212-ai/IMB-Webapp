import { db, generateId } from './db';

// Global execution lock to prevent infinite recursion loop
const activeSyncKeys = new Set<string>();

async function runWithSyncLock(key: string, fn: () => Promise<void>) {
  if (activeSyncKeys.has(key)) return;
  activeSyncKeys.add(key);
  try {
    await fn();
  } finally {
    activeSyncKeys.delete(key);
  }
}

// Helper to recalculate buyer outstanding balance from Ledger Ground Truth
export function triggerBuyerOutstandingRecalc(buyerId: string) {
  const lockKey = `recalc-buyer-${buyerId}`;
  setTimeout(() => {
    runWithSyncLock(lockKey, async () => {
      try {
        await db.transaction('rw', [db.parties, db.khata], async () => {
          const khataEntries = await db.khata.where({ buyer_id: buyerId }).toArray();
          let outstanding = 0;
          for (const entry of khataEntries) {
            if (entry.transaction_type === 'sale_credit') {
              outstanding += entry.amount;
            } else if (entry.transaction_type === 'payment_received') {
              outstanding -= entry.amount;
            } else if (entry.transaction_type === 'adjustment') {
              outstanding += entry.amount;
            }
          }
          await db.parties.update(buyerId, { current_outstanding: outstanding });
        });
      } catch (e) {
        console.error(`[SyncEngine] Error recalculating outstanding for buyer ${buyerId}:`, e);
      }
    });
  }, 50);
}

// Helper to recalculate labour crew balance from Transaction Logs
export function triggerWorkerBalanceRecalc(workerId: string) {
  const lockKey = `recalc-worker-${workerId}`;
  setTimeout(() => {
    runWithSyncLock(lockKey, async () => {
      try {
        await db.transaction('rw', [db.labourList, db.labourTransactions], async () => {
          const transactions = await db.labourTransactions.where({ labour_id: workerId }).toArray();
          let balance = 0;
          for (const tx of transactions) {
            if (tx.type === 'work') {
              balance += tx.amount;
            } else if (tx.type === 'payment') {
              balance -= tx.amount;
            }
          }
          await db.labourList.update(workerId, { current_balance: balance });
        });
      } catch (e) {
        console.error(`[SyncEngine] Error recalculating balance for worker ${workerId}:`, e);
      }
    });
  }, 50);
}

// Helper to group crates and sync cash sales to the cashbook
export function syncCashSalesForLot(lotId: string) {
  const lockKey = `sync-cash-sales-${lotId}`;
  setTimeout(() => {
    runWithSyncLock(lockKey, async () => {
      try {
        await db.transaction('rw', [db.crates, db.cashbook], async () => {
          const allocations = await db.crates.where({ lot_id: lotId }).toArray();
          const cashbookEntries = await db.cashbook.where({ lot_id: lotId }).toArray();
          
          // Group active cash allocations by buyer and mode
          const groups: Record<string, { buyerId: string; buyerName: string; mode: string; amount: number }> = {};
          for (const a of allocations) {
            if (a.payment_mode !== 'credit') {
              const key = `${a.buyer_id}-${a.payment_mode}`;
              if (!groups[key]) {
                groups[key] = {
                  buyerId: a.buyer_id,
                  buyerName: a.buyer_name,
                  mode: a.payment_mode,
                  amount: 0
                };
              }
              groups[key].amount += a.sale_amount;
            }
          }
          
          // Process active groups
          const processedEntryIds = new Set<string>();
          for (const key of Object.keys(groups)) {
            const group = groups[key];
            const existing = cashbookEntries.find(
              cb => cb.party_id === group.buyerId && cb.mode === group.mode && cb.entry_type === 'receipt'
            );
            
            if (existing) {
              processedEntryIds.add(existing.id);
              if (existing.amount !== group.amount || existing.party_name !== group.buyerName) {
                await db.cashbook.update(existing.id, {
                  amount: group.amount,
                  party_name: group.buyerName,
                  description: `Cash sale receipt for Lot: ${lotId} (${group.mode.toUpperCase()})`
                });
              }
            } else {
              const newId = 'cb_' + generateId();
              await db.cashbook.add({
                id: newId,
                date: new Date().toISOString(),
                entry_type: 'receipt',
                party_id: group.buyerId,
                party_name: group.buyerName,
                description: `Cash sale receipt for Lot: ${lotId} (${group.mode.toUpperCase()})`,
                amount: group.amount,
                mode: group.mode as any,
                lot_id: lotId
              });
              processedEntryIds.add(newId);
            }
          }
          
          // Delete cashbook entries no longer active
          for (const cb of cashbookEntries) {
            // Delete only if it's a receipt from cash sales (has party_id, no khata_tx_id, and not processed)
            if (cb.entry_type === 'receipt' && cb.party_id && !cb.khata_tx_id && !processedEntryIds.has(cb.id)) {
              await db.cashbook.delete(cb.id);
            }
          }
        });
      } catch (e) {
        console.error(`[SyncEngine] Error syncing cash sales for lot ${lotId}:`, e);
      }
    });
  }, 100);
}

// ----------------------------------------------------
// dexie hooks setup
// ----------------------------------------------------

// 1. Parties hooks
db.parties.hook('creating', function (primKey, obj, transaction) {
  if (obj.type === 'buyer' && obj.current_outstanding !== 0) {
    const buyerId = primKey;
    const amount = obj.current_outstanding;
    const buyerName = obj.name;
    const lockKey = `create-opening-khata-${buyerId}`;
    
    setTimeout(() => {
      runWithSyncLock(lockKey, async () => {
        try {
          await db.transaction('rw', [db.khata], async () => {
            const count = await db.khata.where({ buyer_id: buyerId, reference_note: 'Opening Balance Setup' }).count();
            if (count === 0) {
              await db.khata.add({
                id: 'k_' + generateId(),
                buyer_id: buyerId,
                buyer_name: buyerName,
                transaction_type: 'adjustment',
                amount: amount,
                reference_note: 'Opening Balance Setup',
                date: new Date().toISOString(),
                balance_after: amount
              });
            }
          });
        } catch (e) {
          console.error(`[SyncEngine] Error creating opening balance khata for ${buyerId}:`, e);
        }
      });
    }, 50);
  }
});

db.parties.hook('updating', function (mods: any, primKey: any, obj: any, transaction: any) {
  if (mods.name && mods.name !== obj.name) {
    const oldName = obj.name;
    const newName = mods.name;
    const partyId = primKey;
    const partyType = obj.type;
    const lockKey = `rename-party-${partyId}`;

    setTimeout(() => {
      runWithSyncLock(lockKey, async () => {
        try {
          await db.transaction('rw', [db.lots, db.crates, db.khata, db.cashbook], async () => {
            if (partyType === 'seller') {
              await db.lots.where({ seller_id: partyId }).modify({ seller_name: newName });
            } else if (partyType === 'buyer') {
              await db.crates.where({ buyer_id: partyId }).modify({ buyer_name: newName });
              await db.khata.where({ buyer_id: partyId }).modify({ buyer_name: newName });
              await db.cashbook.where({ party_id: partyId }).modify({ party_name: newName });
            }
          });
        } catch (e) {
          console.error(`[SyncEngine] Error propagating party name rename for ${partyId}:`, e);
        }
      });
    }, 50);
  }
});

// 2. Labour Worker hooks
db.labourList.hook('updating', function (mods: any, primKey: any, obj: any, transaction: any) {
  if (mods.name && mods.name !== obj.name) {
    const newName = mods.name;
    const workerId = primKey;
    const lockKey = `rename-worker-${workerId}`;

    setTimeout(() => {
      runWithSyncLock(lockKey, async () => {
        try {
          await db.transaction('rw', [db.cashbook], async () => {
            await db.cashbook.where({ party_id: workerId }).modify({ party_name: newName });
          });
        } catch (e) {
          console.error(`[SyncEngine] Error propagating worker name rename for ${workerId}:`, e);
        }
      });
    }, 50);
  }
});

// 3. Khata hooks
db.khata.hook('creating', function (primKey, obj, transaction) {
  triggerBuyerOutstandingRecalc(obj.buyer_id);
});

db.khata.hook('updating', function (mods: any, primKey: any, obj: any, transaction: any) {
  const oldBuyerId = obj.buyer_id;
  const newBuyerId = mods.buyer_id || oldBuyerId;
  triggerBuyerOutstandingRecalc(oldBuyerId);
  if (newBuyerId !== oldBuyerId) {
    triggerBuyerOutstandingRecalc(newBuyerId);
  }
});

db.khata.hook('deleting', function (primKey, obj, transaction) {
  const khataId = primKey;
  const buyerId = obj.buyer_id;
  
  // Recalculate
  triggerBuyerOutstandingRecalc(buyerId);

  // Cascade delete to Cashbook
  const lockKey = `delete-khata-cascade-${khataId}`;
  setTimeout(() => {
    runWithSyncLock(lockKey, async () => {
      try {
        await db.transaction('rw', [db.cashbook], async () => {
          const cashbookEntries = await db.cashbook.where({ khata_tx_id: khataId }).toArray();
          for (const cb of cashbookEntries) {
            // Lock cashbook to prevent back-and-forth loops
            activeSyncKeys.add(`delete-cashbook-cascade-${cb.id}`);
            await db.cashbook.delete(cb.id);
            activeSyncKeys.delete(`delete-cashbook-cascade-${cb.id}`);
          }
        });
      } catch (e) {
        console.error(`[SyncEngine] Error cascade-deleting cashbook for khata ${khataId}:`, e);
      }
    });
  }, 0);
});

// 4. Labour Transactions hooks
db.labourTransactions.hook('creating', function (primKey, obj, transaction) {
  triggerWorkerBalanceRecalc(obj.labour_id);
});

db.labourTransactions.hook('updating', function (mods: any, primKey: any, obj: any, transaction: any) {
  const oldLabourId = obj.labour_id;
  const newLabourId = mods.labour_id || oldLabourId;
  triggerWorkerBalanceRecalc(oldLabourId);
  if (newLabourId !== oldLabourId) {
    triggerWorkerBalanceRecalc(newLabourId);
  }
});

db.labourTransactions.hook('deleting', function (primKey, obj, transaction) {
  const labourTxId = primKey;
  const labourId = obj.labour_id;

  // Recalculate Worker balance
  triggerWorkerBalanceRecalc(labourId);

  // Cascade delete to Cashbook
  const lockKey = `delete-labour-cascade-${labourTxId}`;
  setTimeout(() => {
    runWithSyncLock(lockKey, async () => {
      try {
        await db.transaction('rw', [db.cashbook], async () => {
          const cashbookEntries = await db.cashbook.where({ labour_tx_id: labourTxId }).toArray();
          for (const cb of cashbookEntries) {
            activeSyncKeys.add(`delete-cashbook-cascade-${cb.id}`);
            await db.cashbook.delete(cb.id);
            activeSyncKeys.delete(`delete-cashbook-cascade-${cb.id}`);
          }
        });
      } catch (e) {
        console.error(`[SyncEngine] Error cascade-deleting cashbook for labour tx ${labourTxId}:`, e);
      }
    });
  }, 0);
});

// 5. Cashbook hooks
db.cashbook.hook('deleting', function (primKey, obj, transaction) {
  const cashbookId = primKey;
  const { khata_tx_id, labour_tx_id, lot_id } = obj;
  const lockKey = `delete-cashbook-cascade-${cashbookId}`;

  setTimeout(() => {
    runWithSyncLock(lockKey, async () => {
      try {
        await db.transaction('rw', [db.khata, db.labourTransactions, db.lots], async () => {
          if (khata_tx_id) {
            // Lock khata to prevent circular deleting
            activeSyncKeys.add(`delete-khata-cascade-${khata_tx_id}`);
            await db.khata.delete(khata_tx_id);
            activeSyncKeys.delete(`delete-khata-cascade-${khata_tx_id}`);
          }
          if (labour_tx_id) {
            // Lock labour to prevent circular deleting
            activeSyncKeys.add(`delete-labour-cascade-${labour_tx_id}`);
            await db.labourTransactions.delete(labour_tx_id);
            activeSyncKeys.delete(`delete-labour-cascade-${labour_tx_id}`);
          }
          if (lot_id) {
            // If it's a seller payment/payout, reset Lot status to 'auctioned'
            const lot = await db.lots.get(lot_id);
            if (lot && lot.status === 'paid') {
              await db.lots.update(lot_id, { status: 'auctioned' });
            }
          }
        });
      } catch (e) {
        console.error(`[SyncEngine] Error cascade-deleting for CashbookEntry ${cashbookId}:`, e);
      }
    });
  }, 0);
});

// 6. Crates (Crate Allocations) hooks
db.crates.hook('creating', function (primKey, obj, transaction) {
  syncCashSalesForLot(obj.lot_id);
});

db.crates.hook('updating', function (mods: any, primKey: any, obj: any, transaction: any) {
  syncCashSalesForLot(obj.lot_id);
  if (mods.lot_id && mods.lot_id !== obj.lot_id) {
    syncCashSalesForLot(mods.lot_id);
  }
});

db.crates.hook('deleting', function (primKey, obj, transaction) {
  syncCashSalesForLot(obj.lot_id);
});

// Initialize logs to verify execution registration
console.log('[SyncEngine] Relational Database Sync Engine registered and active.');
