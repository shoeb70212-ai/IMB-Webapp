# Active Session: IMB Fruit Agency — PWA Enhancements

This document outlines the goals, active tasks, and completion logs for the current development session.

---

## Progress Indicator

- **Status**: 100% Completed
- **Last Updated**: 2026-05-21T16:31:00.000Z
- **Completed Tasks**: 13 of 13
- **In Progress Tasks**: 0

## Session Goals

1. **Centralized Business Branding**:
   - Update business name to `IMB Fruit Agency`, owner to `Syed. Najeeb`, phone `94221 83481`, address `Shop No. 39, Market Yard, Camp Road, Malegaon, District Nashik, Maharashtra, India`.
   - Save logo to `/public/logo.png`.
   - Add `DEFAULT_BUSINESS_SETTINGS` constant in `src/db.ts` for single-point edits.
   - Propagate fallbacks across all components.

2. **IndexedDB Initialization Race Fix**:
   - Fix `ConstraintError` caused by React StrictMode double-mounting `Main` and calling `initializeDatabase()` twice simultaneously.
   - Introduce module-level `initPromise` cache so the second call reuses the first call's in-flight promise.

3. **Print Document Border**:
   - Add professional letterhead-style double-rule border to all print documents.
   - Implement `.print-border-frame` CSS class (protected from browser print stripping with `!important`).
   - Apply to: Lot Seller Memo, Lot Buyer Invoice, Thermal Receipt (80mm), Khata Ledger, Cashbook, Labour Pay Statement.

4. **Page Size Selector**:
   - Add `PrintPageSize` type (`a4` | `a5` | `letter` | `receipt`) to `printing.ts`.
   - Add `getPageCss()` utility for correct `@page` CSS per size.
   - Add page size dropdown in Lots detail view (A4, A5, Letter).
   - Thermal 80mm always forces `receipt` mode regardless of dropdown.

---

## Checklist

- [x] Save `/public/logo.png`
- [x] Add `DEFAULT_BUSINESS_SETTINGS` to `src/db.ts`
- [x] Update `SystemSettings` interface in `src/types.ts` with `business_logo` field
- [x] Propagate branding fallbacks to `App.tsx`, `Lots.tsx`, `KhataLedger.tsx`, `Cashbook.tsx`, `LabourWages.tsx`, `Settings.tsx`, `NewLotWizard.tsx`
- [x] Fix IndexedDB StrictMode double-init race with module-level `initPromise` in `src/db.ts`
- [x] Export `PrintPageSize` type and `getPageCss()` from `src/printing.ts`
- [x] Add page size dropdown UI in `Lots.tsx` detail view
- [x] Add `.print-border-frame` CSS class in `src/index.css`
- [x] Remove `border: none !important` overrides that were stripping print borders
- [x] Apply `print-border-frame` to Lots A4 Seller Memo HTML
- [x] Apply `print-border-frame` to Lots A4 Buyer Invoice HTML
- [x] Apply `print-border-frame` to Lots 80mm Thermal Receipt HTML
- [x] Apply `print-border-frame` to KhataLedger, Cashbook, LabourWages print HTML
