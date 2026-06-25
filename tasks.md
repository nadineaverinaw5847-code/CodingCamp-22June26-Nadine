# Implementation Plan: Expense and Budget Visualizer

## Overview

Build a single-page, client-side expense tracker as three static files (`index.html`, `css/styles.css`, `js/app.js`). The implementation follows the design's event-driven architecture: all state lives in an in-memory array, mirrored to `localStorage` on every mutation, with Chart.js 4.x loaded via CDN for the pie chart. Tasks are ordered so each step produces runnable, integrated code.

---

## Tasks

- [x] 1. Set up project structure and static HTML shell
  - Create `index.html` with the full semantic structure: `<header>` containing `#balance-display`, `<main>` with `#form-section`, `#list-section`, and `#chart-section`, and a `#toast-container` with `aria-live="polite"`
  - Add the pinned Chart.js 4.x CDN `<script>` tag followed by `<script src="js/app.js" defer>`
  - Create empty placeholder files `css/styles.css` and `js/app.js`
  - Verify the page opens via `file://` with zero console errors
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 2. Implement data model, state, and persistence module
  - [x] 2.1 Define the Transaction data model and in-memory state
    - Write the `transactions` array and the `generateId()` helper (uses `crypto.randomUUID()` with `Date.now() + Math.random()` fallback) in `js/app.js`
    - Implement `isLocalStorageAvailable()` with a try/catch test write
    - _Requirements: 5.6_

  - [x] 2.2 Implement `loadTransactions()` and `saveTransactions()`
    - `loadTransactions()` reads `"expense_transactions"` from `localStorage`, parses the JSON, validates each field of every entry (id, name, amount, category, createdAt), silently drops invalid entries, shows a toast warning when data was present but recovery produced an empty array, and shows a toast warning when `localStorage` is unavailable
    - `saveTransactions(transactions)` serializes and writes the array; shows a toast warning if `setItem` throws
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 3. Implement the form validator
  - [x] 3.1 Implement `validateForm(name, amount, category)`
    - Returns `{ valid: boolean, errors: { name?, amount?, category? } }`
    - Rules: name non-empty after `.trim()`; amount parseable as float, in [0.01, 999999999.99], ≤ 2 decimal places; category is exactly one of `"Food"`, `"Transport"`, `"Fun"`
    - _Requirements: 1.2, 1.3_

- [x] 4. Build the Input Form component
  - [x] 4.1 Add form HTML and wire submit event
    - Add `#item-name` (text, maxlength=100), `#item-amount` (number, min/max/step), `#item-category` (select with Food/Transport/Fun and a blank placeholder `<option>`), `#add-btn`, and `.field-error` spans to `#form-section`
    - In `app.js`, attach a `submit` listener that calls `validateForm()`, displays inline errors on failure (requirement 1.3), or calls `addTransaction()` on success
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 4.2 Implement `addTransaction()` and form reset
    - Build a Transaction object (with `generateId()`, trimmed name, parsed amount, category, `Date.now()` timestamp), push to `transactions`, call `saveTransactions()`, call `renderAll()`, then reset all form fields to defaults
    - _Requirements: 1.4, 1.5_

- [x] 5. Build the Transaction List renderer
  - [x] 5.1 Implement `renderList(transactions)`
    - Render `<li>` items into `#transaction-list` newest-first (reverse the array on render, do not mutate storage order)
    - Each `<li>` includes: category icon (emoji) + colour-coded badge, item name (truncated to 30 chars + `…` via CSS `text-overflow: ellipsis`), amount formatted to 2 d.p. with `$`, and a delete `<button aria-label="Delete [name]">`
    - When `transactions` is empty, replace list content with `<p id="empty-message">No transactions recorded yet.</p>`
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 5.2 Implement `deleteTransaction(id)` and wire delete buttons
    - Filter `transactions` by id, call `saveTransactions()`, call `renderAll()`
    - _Requirements: 2.4_

- [ ] 6. Checkpoint — core list and form working
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement the Balance Display component
  - [x] 7.1 Implement `computeBalance(transactions)` and `renderBalance()`
    - `computeBalance` returns the algebraic sum of all `amount` fields rounded to 2 decimal places; returns `0.00` for an empty array or a zero-sum array
    - `renderBalance()` formats the result as `$X.XX` and writes it to `#balance-display`
    - _Requirements: 3.1, 3.4, 3.5_

- [x] 8. Implement the Chart component
  - [x] 8.1 Implement `getCategoryTotals(transactions)` and `computePercentages(totals)`
    - `getCategoryTotals` returns `{ Food: number, Transport: number, Fun: number }` aggregated from the transactions array
    - `computePercentages` returns integer percentages summing to exactly 100, with rounding remainder absorbed by the largest slice; categories with total 0 are excluded from the output
    - _Requirements: 4.1, 4.3, 4.4_

  - [x] 8.4 Implement `renderChart(transactions)`
    - On first call create `chartInstance = new Chart(ctx, config)` with Pie type, category labels, colours (`#FF6384`, `#36A2EB`, `#FFCE56`), icons (🍔, 🚌, 🎉), and `datalabels` or `afterDraw` percentage labels
    - On subsequent calls mutate `chartInstance.data` and call `chartInstance.update('none')`
    - When all categories are zero: hide `<canvas>`, show `#chart-empty-state`, call `chartInstance.destroy()` and set to `null`
    - Handle missing `window.Chart` (CDN failure): hide chart section, show a non-blocking warning toast
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 9. Wire `renderAll()` and initialize the app
  - [x] 9.1 Implement `renderAll()` and app initialization
    - `renderAll()` calls `renderList()`, `renderBalance()`, and `renderChart()` in sequence
    - On `DOMContentLoaded`, call `loadTransactions()` to populate the `transactions` array, then call `renderAll()`; do not call `saveTransactions()` during initialization
    - _Requirements: 5.3, 5.4, 7.1, 7.2, 7.3, 7.4_

- [x] 10. Implement the Toast Notification system
  - [x] 10.1 Implement `showToast(message, type)`
    - Append a `<div class="toast">` to `#toast-container` with a close `<button>` and `aria-live="polite"` already on the container
    - Auto-remove after 5 seconds; close button removes immediately
    - `type` accepts `"warning"` or `"error"` for CSS styling; toasts are always non-blocking and dismissible
    - _Requirements: 5.5, 5.6, 5.7_

- [x] 11. Apply all CSS styles
  - [x] 11.1 Implement responsive layout and typography
    - CSS Grid/Flexbox layout: on viewports < 640 px all three sections stack vertically; on wider viewports form and list appear side-by-side with chart below at full width
    - Typographic scale with at least 3 distinct font sizes (heading > body > label)
    - No `style=""` attributes or `<style>` blocks anywhere in the HTML
    - _Requirements: 6.1, 8.1, 8.2, 8.4, 8.5_

  - [x] 11.2 Style transaction list items, category badges, and form errors
    - Category colour-coded pill/badge AND emoji icon for each category in both the list and chart legend (colour + iconography, not colour alone)
    - Item name: `overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 30ch` (or equivalent)
    - Inline `.field-error` messages styled visibly beneath their respective fields
    - No horizontal scrollbar at 320 px, 768 px, 1280 px, 1920 px viewport widths
    - _Requirements: 8.3, 8.4, 2.1_

  - [x] 11.3 Style toast notifications and chart empty state
    - Toasts positioned fixed, visually distinct for `warning` vs `error`, with a visible close button
    - `#chart-empty-state` styled to replace the canvas gracefully when no data exists
    - _Requirements: 5.5, 5.6, 5.7, 4.5, 4.6_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at meaningful integration points
- Property tests validate universal correctness properties using `fast-check` loaded via CDN in a test HTML file; each test runs ≥ 100 iterations
- Unit tests validate specific examples and edge cases
- The app opens via `file://` with no build step — keep all code in the three static files

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["2.2", "3.1"] },
    { "id": 2, "tasks": ["2.3", "2.4", "3.2", "4.1", "8.1"] },
    { "id": 3, "tasks": ["4.2", "8.2", "8.3"] },
    { "id": 4, "tasks": ["4.3", "4.4", "5.1", "7.1", "8.4"] },
    { "id": 5, "tasks": ["5.2", "7.2"] },
    { "id": 6, "tasks": ["5.3", "5.4", "5.5", "9.1"] },
    { "id": 7, "tasks": ["10.1", "11.1"] },
    { "id": 8, "tasks": ["11.2", "11.3"] }
  ]
}
```
