import { Party, Lot, CrateAllocation, KhataEntry, CashbookEntry, LabourWorker, LabourTx } from '../types';

export interface InsightAlert {
  id: string;
  type: 'danger' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
  category: 'liquidity' | 'credit' | 'supplier' | 'product' | 'labour';
}

export interface ProductPerformance {
  fruitType: string;
  totalSales: number;
  totalCrates: number;
  avgPricePerKg: number;
}

export interface InsightsResult {
  alerts: InsightAlert[];
  gallaBalance: number;
  unpaidSellerLiabilities: number;
  totalBuyerOutstanding: number;
  topProducts: ProductPerformance[];
}

export function generateInsights(
  parties: Party[],
  lots: Lot[],
  crates: CrateAllocation[],
  khata: KhataEntry[],
  cashbook: CashbookEntry[],
  workers: LabourWorker[]
): InsightsResult {
  const alerts: InsightAlert[] = [];

  // 1. Calculate Galla Cash Balance
  let gallaBalance = 0;
  for (const entry of cashbook) {
    if (entry.entry_type === 'receipt') {
      gallaBalance += entry.amount;
    } else if (entry.entry_type === 'payment') {
      gallaBalance -= entry.amount;
    }
  }

  // 2. Calculate Unpaid Seller Liabilities (status !== 'paid')
  const unpaidSellerLots = lots.filter(l => l.status !== 'paid');
  const unpaidSellerLiabilities = unpaidSellerLots.reduce((sum, l) => sum + l.net_payable_to_seller, 0);

  // 3. Calculate Total Buyer Outstanding
  const buyers = parties.filter(p => p.type === 'buyer');
  const totalBuyerOutstanding = buyers.reduce((sum, b) => sum + b.current_outstanding, 0);

  // --- LIQUIDITY INSIGHTS ---
  if (gallaBalance < unpaidSellerLiabilities) {
    const deficit = unpaidSellerLiabilities - gallaBalance;
    alerts.push({
      id: 'liq_deficit',
      type: 'danger',
      title: 'Liquidity Risk Detected',
      message: `Galla cash balance (₹${gallaBalance.toLocaleString('en-IN')}) is insufficient to cover unpaid seller payouts (₹${unpaidSellerLiabilities.toLocaleString('en-IN')}). Deficit: ₹${deficit.toLocaleString('en-IN')}. Focus on collecting buyer receivables immediately.`,
      category: 'liquidity'
    });
  } else if (gallaBalance > 0 && unpaidSellerLiabilities > 0) {
    alerts.push({
      id: 'liq_healthy',
      type: 'success',
      title: 'Healthy Cash Reserve',
      message: `Your Galla balance (₹${gallaBalance.toLocaleString('en-IN')}) is sufficient to cover outstanding seller payouts (₹${unpaidSellerLiabilities.toLocaleString('en-IN')}).`,
      category: 'liquidity'
    });
  }

  // --- BUYER CREDIT RISKS ---
  const creditLimitExceeded: string[] = [];
  const dormantDebtors: string[] = [];
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  for (const buyer of buyers) {
    if (buyer.current_outstanding > 0) {
      // Check Credit Limit
      if (buyer.credit_limit && buyer.current_outstanding > buyer.credit_limit) {
        creditLimitExceeded.push(buyer.name);
        alerts.push({
          id: `credit_limit_${buyer.id}`,
          type: 'danger',
          title: 'Credit Limit Exceeded',
          message: `${buyer.name} outstanding dues (₹${buyer.current_outstanding.toLocaleString('en-IN')}) exceed credit limit (₹${buyer.credit_limit.toLocaleString('en-IN')}). Put further sales on hold.`,
          category: 'credit'
        });
      }

      // Check Dormancy (No payments received in last 14 days)
      const buyerPayments = khata.filter(
        x => x.buyer_id === buyer.id && x.transaction_type === 'payment_received'
      );
      
      const hasRecentPayment = buyerPayments.some(
        p => new Date(p.date).getTime() >= fourteenDaysAgo.getTime()
      );

      if (buyerPayments.length > 0 && !hasRecentPayment) {
        dormantDebtors.push(buyer.name);
        // Find date of last payment
        const sortedPayments = [...buyerPayments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const lastPayDate = new Date(sortedPayments[0].date).toLocaleDateString();
        alerts.push({
          id: `dormant_buyer_${buyer.id}`,
          type: 'warning',
          title: 'Dormant Debtor Follow-up',
          message: `${buyer.name} owes ₹${buyer.current_outstanding.toLocaleString('en-IN')} and has not made any payments since ${lastPayDate}. Contact for payment collection.`,
          category: 'credit'
        });
      }
    }
  }

  // --- DORMANT SELLERS ALERT ---
  const sellers = parties.filter(p => p.type === 'seller');
  // Find top sellers by volume/sales
  const sellerTotals: Record<string, number> = {};
  for (const lot of lots) {
    sellerTotals[lot.seller_id] = (sellerTotals[lot.seller_id] || 0) + lot.net_payable_to_seller;
  }
  
  const sortedSellers = Object.keys(sellerTotals)
    .map(id => ({ id, name: sellers.find(s => s.id === id)?.name || 'Unknown Seller', total: sellerTotals[id] }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3); // Top 3 sellers

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  for (const sInfo of sortedSellers) {
    const sellerLots = lots.filter(l => l.seller_id === sInfo.id);
    const hasRecentLot = sellerLots.some(
      l => new Date(l.arrival_date).getTime() >= sevenDaysAgo.getTime()
    );

    if (sellerLots.length > 0 && !hasRecentLot) {
      alerts.push({
        id: `dormant_seller_${sInfo.id}`,
        type: 'warning',
        title: 'Supplier Retention Warning',
        message: `Key seller "${sInfo.name}" (total business: ₹${sInfo.total.toLocaleString('en-IN')}) has not supplied any lots in the last 7 days. Call them to inspect crop arrivals.`,
        category: 'supplier'
      });
    }
  }

  // --- PRODUCT PERFORMANCE AND TRENDS ---
  const productGroups: Record<string, { totalSales: number; totalCrates: number; totalWeight: number }> = {};
  for (const c of crates) {
    if (c.is_sold) {
      if (!productGroups[c.fruit_type]) {
        productGroups[c.fruit_type] = { totalSales: 0, totalCrates: 0, totalWeight: 0 };
      }
      productGroups[c.fruit_type].totalSales += c.sale_amount;
      productGroups[c.fruit_type].totalCrates += c.qty || 1;
      productGroups[c.fruit_type].totalWeight += c.net_weight_kg || 0;
    }
  }

  const topProducts: ProductPerformance[] = Object.keys(productGroups)
    .map(fruitType => {
      const g = productGroups[fruitType];
      return {
        fruitType,
        totalSales: g.totalSales,
        totalCrates: g.totalCrates,
        avgPricePerKg: g.totalWeight > 0 ? parseFloat((g.totalSales / g.totalWeight).toFixed(2)) : 0
      };
    })
    .sort((a, b) => b.totalSales - a.totalSales);

  if (topProducts.length > 0) {
    const primary = topProducts[0];
    alerts.push({
      id: 'top_product',
      type: 'info',
      title: 'Top Product Performance',
      message: `"${primary.fruitType}" is leading sales, bringing in ₹${primary.totalSales.toLocaleString('en-IN')} across ${primary.totalCrates} crates (Avg: ₹${primary.avgPricePerKg}/kg).`,
      category: 'product'
    });

    // Check grade price premiums (for the top product)
    const topCrates = crates.filter(c => c.fruit_type === primary.fruitType && c.is_sold);
    const gradeGroups: Record<string, { sales: number; weight: number }> = {};
    for (const c of topCrates) {
      if (!gradeGroups[c.quality_grade]) {
        gradeGroups[c.quality_grade] = { sales: 0, weight: 0 };
      }
      gradeGroups[c.quality_grade].sales += c.sale_amount;
      gradeGroups[c.quality_grade].weight += c.net_weight_kg;
    }

    const grades = Object.keys(gradeGroups)
      .map(grade => ({ grade, avg: gradeGroups[grade].weight > 0 ? gradeGroups[grade].sales / gradeGroups[grade].weight : 0 }))
      .sort((a, b) => b.avg - a.avg);

    if (grades.length >= 2) {
      const spread = grades[0].avg - grades[1].avg;
      if (spread > 0) {
        alerts.push({
          id: 'grade_premium',
          type: 'info',
          title: 'Quality Price Premium',
          message: `Premium Grade "${grades[0].grade}" commands a ₹${spread.toFixed(2)}/kg premium over Grade "${grades[1].grade}" for ${primary.fruitType}. Advise farmers to sort harvest.`,
          category: 'product'
        });
      }
    }
  }

  // --- UNPAID LABOUR WAGES ALERT ---
  const totalLabourOutstanding = workers.reduce((sum, w) => sum + w.current_balance, 0);
  if (totalLabourOutstanding > 5000) {
    alerts.push({
      id: 'labour_outstanding',
      type: 'warning',
      title: 'Loader Wage Dues Accrued',
      message: `Total wages owed to loader crews stands at ₹${totalLabourOutstanding.toLocaleString('en-IN')}. Clear balances to keep operations smooth.`,
      category: 'labour'
    });
  }

  return {
    alerts,
    gallaBalance,
    unpaidSellerLiabilities,
    totalBuyerOutstanding,
    topProducts
  };
}
