# Agent Guidelines & Instructions: Kisan Mitra

This document outlines the rules, constraints, and coding practices that agents must follow when editing the Kisan Mitra codebase.

---

## 1. Safety & Architecture Rules

1. **True Offline-First Operations**:
   - Do **NOT** introduce any dependencies loaded via external CDNs (`<script src="...">` or `<link href="...">`). Everything must be bundled locally via npm and compiled by Vite.
   - Use IndexedDB (via Dexie.js) for persistent state. Avoid using standard browser `localStorage` for financial transactions, as mobile operating systems might prune it when storage runs low.

2. **Ledger Integrity & Cascading Rules**:
   - Double-entry safety is vital. When a labour payout is deleted in the Wages panel, the corresponding entry in the `cashbook` table (linked by `labour_tx_id`) **MUST** be deleted programmatically in the same transaction.
   - All financial balance math must use floating-point parse checks and default to safe arithmetic rules (like rounding to nearest rupee where appropriate or using `.toFixed(2)` for weight calculations).

3. **Theme & Styling Sync**:
   - Ensure the components read their styling boundaries from the CSS variable configuration defined in `src/index.css`.
   - Never hardcode background or color palettes outside the slate-based variable configuration, so that Light, Dark, and Bazaar theme switches propagate correctly.

---

## 2. Coding Conventions

- **TypeScript**:
  - Keep strict typing enabled. Avoid using the `any` keyword unless absolutely necessary for external library mappings. Use interfaces declared in [types.ts](file:///e:/Fruit%20market%2021-05/src/types.ts).
- **React Components**:
  - Keep UI components functional and modular. Put sub-panels and modal forms inside standard JSX elements inside the specific files.
  - Utilize `useLiveQuery` from `dexie-react-hooks` for reactive reads from IndexedDB tables so that UI refreshes automatically on writes.
- **Paths & Referencing**:
  - Keep all file links clickable in transcripts using the `file://` scheme with forward slashes for Windows compatibility (e.g., `[filename](file:///path/to/file)`).

---

## 3. Technology Stack Choices (Stability First)

- **Do NOT use experimental or cutting-edge libraries** that could lead to compilation/runtime errors or packages that are not locked down.
- Maintain existing locked versions in `package.json` (React 19, Tailwind CSS v4, Dexie 4).
- Use Tailwind CSS v4 directives via standard classes. When adjusting layouts, use grid and flex systems compatible with both desktop viewports and mobile wraps (Capacitor target).
