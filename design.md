# Design Document: Expense and Budget Visualizer

## Overview

The Expense and Budget Visualizer is a single-page, client-side web application delivered as three static files: `index.html`, `css/styles.css`, and `js/app.js`. It requires no build step, no package manager, and no server — it opens directly via the `file://` protocol in any modern browser.

Users can record expense transactions (name, amount, category), see a running total balance, browse a scrollable list of past transactions, and instantly view a pie chart that breaks spending down by the three fixed categories: **Food**, **Transport**, and **Fun**. All data is persisted to `localStorage` so transactions survive page refreshes and browser restarts.

Chart.js 4.x is the only external dependency; it is loaded from a pinned CDN URL.

---

## Architecture

The application is fully synchronous and event-driven. There is no build pipeline, no module bundler, and no framework. All state lives in a single in-memory array (`transactions`) and is mirrored to `localStorage` on every mutating operation.

```
┌──────────────────────────────────────────────┐
│                  Browser DOM                 │
│                                              │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ Input Form  │  │  Balance Display     │  │
│  └──────┬──────┘  └──────────────────────┘  │
│         │ submit / delete events             │
│  ┌──────▼──────────────────────────────┐    │
│  │          State Manager (app.js)     │    │
│  │  • transactions[]  (in-memory)      │    │
│  │  • addTransaction()                 │    │
│  │  • deleteTransaction()              │    │
│  │  • renderAll()                      │    │
│  └──┬──────────┬───────────────────┬───┘    │
│     │          │                   │        │
│  ┌──▼────┐ ┌───▼────────────┐ ┌────▼─────┐  │
│  │ List  │ │ Balance Update │ │  Chart   │  │
│  │Renderer│ │   Renderer    │ │ Renderer │  │
│  └───────┘ └───────────────┘ └──────────┘  │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │       localStorage (persistence)    │   │
│  └──────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

### Key architectural decisions

- **Single JS file** — all logic in `js/app.js`; avoids ES module CORS restrictions under `file://`.
- **Single CSS file** — all styles in `css/styles.css`; HTML has zero `style=""` attributes or `<style>` blocks.
- **No inline scripts** — `index.html` loads `app.js` via a `<script src="…" defer>` tag at the bottom of `<head>`.
- **Chart.js loaded before app.js** — CDN `<script>` for Chart.js appears before the app script tag so `Chart` is available on the global scope.
- **Synchronous localStorage** — reads and writes are synchronous; no async complexity needed.
- **Single Chart.js instance** — the chart object is created once on first render and updated with `chart.data = …; chart.update()` on subsequent mutations; this avoids flickering and DOM leaks.

---

## Components and Interfaces

### 1. HTML Structure (`index.html`)

```
<body>
  <header>
    <h1>Expense & Budget Visualizer</h1>
    <div id="balance-display"> … </div>
  </header>

  <main>
    <section id="form-section">
      <form id="transaction-form"> … </form>
    </section>

    <section id="list-section">
      <ul id="transaction-list"> … </ul>
    </section>

    <section id="chart-section">
      <canvas id="spending-chart"></canvas>
      <div id="chart-empty-state"> … </div>
    </section>
  </main>

  <div id="toast-container" aria-live="polite"></div>
</body>
```

Layout uses CSS Grid/Flexbox. On narrow viewports (< 640 px) all three sections stack vertically. On wider viewports the form and list appear side-by-side, with the chart below spanning full width.

### 2. Input Form Component

| Element | ID / attributes | Purpose |
|---|---|---|
| `<input type="text">` | `#item-name`, maxlength="100" | Item name field |
| `<input type="number">` | `#item-amount`, min="0.01", max="999999999.99", step="0.01" | Amount field |
| `<select>` | `#item-category` | Category selector (Food / Transport / Fun) |
| `<button type="submit">` | `#add-btn` | Submit |
| `<span>` per field | `.field-error` | Inline validation messages |

**Validation logic** (pure function `validateForm(name, amount, category) → { valid: boolean, errors: object }`):
- `name`: non-empty after `.trim()`
- `amount`: parseable as float, in range [0.01, 999999999.99], at most 2 decimal places
- `category`: one of `"Food"`, `"Transport"`, `"Fun"`

### 3. Transaction List Component

- Rendered into `<ul id="transaction-list">`.
- Each `<li>` contains:
  - Category icon (emoji or inline SVG) + colour-coded pill/badge
  - Item name (truncated to 30 chars with `…` via CSS `text-overflow: ellipsis` + `max-width`)
  - Amount formatted to 2 decimal places with currency symbol
  - Delete `<button>` with `aria-label="Delete [item name]"`
- When empty: replaces list with `<p id="empty-message">No transactions recorded yet.</p>`
- Items are rendered newest-first (array is reversed on render, not mutated in storage).

### 4. Balance Display Component

- `<div id="balance-display">` inside `<header>`.
- Updated synchronously after every add/delete.
- Always shows 2 decimal places (e.g., `$0.00`).

### 5. Chart Component

- `<canvas id="spending-chart">` inside `#chart-section`.
- Chart.js `Pie` type, created with `new Chart(ctx, config)`.
- **Instance management**: stored in module-level variable `let chartInstance = null`.
  - First render: `chartInstance = new Chart(ctx, config)`.
  - Subsequent updates: mutate `chartInstance.data.datasets[0].data` and labels, then call `chartInstance.update('none')` (no animation on update for < 100 ms response).
- When all categories are zero:
  - Hide `<canvas>` (`display: none`).
  - Show `#chart-empty-state` div with text "No spending data yet."
  - If `chartInstance` exists, call `chartInstance.destroy()` and set to `null`.
- Category colours and icons:

| Category | Colour | Icon |
|---|---|---|
| Food | `#FF6384` | 🍔 |
| Transport | `#36A2EB` | 🚌 |
| Fun | `#FFCE56` | 🎉 |

- Percentage labels: use Chart.js `datalabels` plugin or a custom `afterDraw` callback. Each label shows `"CategoryName\nXX%"`. All percentages round to nearest integer; the largest slice absorbs any rounding remainder to ensure they sum to 100%.

### 6. Persistence Module

All persistence is handled by three functions in `app.js`:

| Function | Behaviour |
|---|---|
| `loadTransactions()` | Reads `"expense_transactions"` key from `localStorage`. Returns parsed array or `[]` on any error (parse fail, unavailable). Shows toast warning if recovery was needed. |
| `saveTransactions(transactions)` | Serializes and writes to `localStorage`. Shows toast warning if write throws. |
| `isLocalStorageAvailable()` | Wraps a test set/get/remove in a `try/catch`. Returns boolean. |

### 7. Toast Notification System

- A `<div id="toast-container" aria-live="polite">` is always in the DOM.
- `showToast(message, type)` appends a `<div class="toast">` child.
- Each toast has a close `<button>` (manual dismiss) and auto-removes after 5 s.
- `type` can be `"warning"` or `"error"` (visual styling only; the toast is always dismissible and non-blocking).

---

## Data Models

### Transaction Object

```js
{
  id: string,        // crypto.randomUUID() or Date.now() fallback
  name: string,      // 1–100 chars, trimmed
  amount: number,    // float, 2 d.p., range [0.01, 999999999.99]
  category: string,  // "Food" | "Transport" | "Fun"
  createdAt: number  // Date.now() timestamp
}
```

### In-Memory State

```js
let transactions = [];  // ordered oldest-first; newest rendered first
```

### localStorage Schema

- **Key**: `"expense_transactions"`
- **Value**: `JSON.stringify(Transaction[])` — a JSON array of Transaction objects.

#### Deserialization validation

After parsing JSON, each element is validated as a valid Transaction before being accepted:
- `id`: string, non-empty
- `name`: string, 1–100 chars
- `amount`: finite number > 0, ≤ 999999999.99
- `category`: exactly one of `"Food"`, `"Transport"`, `"Fun"`
- `createdAt`: finite number

Any element failing validation is silently dropped; if the result is an empty array and the stored data was non-empty, the corruption warning toast is shown.

### Category Totals (computed, not stored)

```js
function getCategoryTotals(transactions) {
  return transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});
  // → { Food: number, Transport: number, Fun: number }
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The application has several pure or near-pure functions whose correctness can be stated universally: the form validator, the balance calculator, the category-totals aggregator, the percentage normalizer, the name-truncation formatter, the list-sort order, and the localStorage serialization round-trip. These are all amenable to property-based testing.

### Property 1: Validator correctly classifies all inputs

*For any* combination of (name, amount, category) values, `validateForm(name, amount, category)` SHALL return `valid: true` if and only if: `name` is non-empty after trimming, `amount` is a finite number in [0.01, 999999999.99] with at most 2 decimal places, and `category` is one of "Food", "Transport", "Fun". All other combinations SHALL return `valid: false` with a non-empty `errors` object identifying the failing fields.

**Validates: Requirements 1.2, 1.3**

---

### Property 2: Adding a valid transaction grows the list by exactly one

*For any* starting transaction list and any valid transaction input (name, amount, category), calling `addTransaction()` SHALL result in a list whose length is exactly one greater than before, and the new entry SHALL contain the submitted name, amount, and category.

**Validates: Requirements 1.4**

---

### Property 3: Form resets after every successful submission

*For any* valid transaction that is successfully submitted, the item-name input value, the amount input value, and the category select value SHALL each be empty/default immediately after submission.

**Validates: Requirements 1.5**

---

### Property 4: Name truncation is correct for all string lengths

*For any* item name string of length N: if N ≤ 30 the displayed text SHALL equal the original string; if N > 30 the displayed text SHALL equal the first 30 characters followed by `"…"` (ellipsis), and SHALL NOT display more than 31 visible characters.

**Validates: Requirements 2.1**

---

### Property 5: Transaction list is always rendered newest-first

*For any* sequence of transactions added in insertion order, the rendered list SHALL display them in reverse-insertion order (most-recently-added transaction at the top), regardless of the content of the transactions.

**Validates: Requirements 2.3**

---

### Property 6: Delete removes exactly the targeted transaction and leaves all others intact

*For any* list of one or more transactions and any valid transaction ID from that list, calling `deleteTransaction(id)` SHALL produce a list of length exactly one less, SHALL NOT contain the deleted transaction, and SHALL contain all other transactions with their original data unchanged.

**Validates: Requirements 2.4**

---

### Property 7: Balance equals sum of amounts rounded to 2 decimal places

*For any* list of transactions (including empty), `computeBalance(transactions)` SHALL equal the algebraic sum of all `amount` fields rounded to exactly 2 decimal places. In particular, an empty list SHALL produce `0.00` and a list whose amounts sum to zero SHALL produce `0.00`.

**Validates: Requirements 3.1, 3.4, 3.5**

---

### Property 8: Chart data integrity — correct category totals and percentages summing to 100

*For any* non-empty list of transactions, the chart data preparation functions SHALL satisfy two sub-properties simultaneously:
- `getCategoryTotals(transactions)` SHALL return an object where each category's value equals the exact sum of `amount` fields for transactions in that category, and categories with no transactions are absent or zero.
- `computePercentages(totals)` SHALL return non-negative integers for each present category such that all returned percentage values sum to exactly 100, with rounding remainder absorbed by the largest slice.

**Validates: Requirements 4.1, 4.3**

---

### Property 9: Zero-total categories are excluded from chart data

*For any* set of category totals where at least one category has a total of zero and at least one other has a positive total, the array of labels and data values passed to Chart.js SHALL contain no entry for the zero-total category, and the remaining entries SHALL sum to 100%.

**Validates: Requirements 4.4**

---

### Property 10: Persistence round-trip — state after mutation is fully recoverable

*For any* sequence of add and/or delete operations applied to the transaction list, the array produced by `JSON.parse(localStorage.getItem("expense_transactions"))` immediately after each mutation SHALL be deeply equal to the current in-memory `transactions` array (same length, same IDs, names, amounts, categories, and timestamps in the same order).

**Validates: Requirements 5.1, 5.2**

---

### Property 11: Load round-trip — any valid stored array is recovered on initialization

*For any* valid JSON array of transaction objects written to `localStorage` under key `"expense_transactions"`, calling `loadTransactions()` SHALL return an array that is deeply equal to the stored array (all fields preserved, order preserved, no items dropped).

**Validates: Requirements 5.3**

---

## Error Handling

| Scenario | Detection | Response |
|---|---|---|
| Invalid form input | `validateForm()` returns `valid: false` | Show inline field-level error message; do not create transaction |
| `localStorage` unavailable on load | `isLocalStorageAvailable()` returns `false` | Initialize with `[]`; show dismissible warning toast |
| Corrupt / unparseable `localStorage` data | `JSON.parse` throws | Initialize with `[]`; show dismissible warning toast |
| Deserialized array contains invalid Transaction objects | Per-field validation during deserialization | Silently drop invalid entries; if result is empty and stored data was non-empty, show dismissible warning toast |
| `localStorage.setItem` throws on save | `try/catch` around `saveTransactions()` | Show dismissible warning toast; in-memory state remains correct |
| `crypto.randomUUID` unavailable | Feature-detect before call | Fall back to `Date.now() + Math.random()` for ID generation |
| Chart.js fails to load (CDN unreachable) | `window.Chart` is `undefined` | Show a non-blocking warning; hide chart section gracefully |

All error toasts are:
- Rendered into `#toast-container` with `aria-live="polite"`.
- Dismissible via a close button.
- Auto-removed after 5 seconds.
- Non-blocking — the form and transaction list remain fully operable.

---

## Testing Strategy

### PBT Applicability Assessment

This feature has several pure or near-pure functions (`validateForm`, `computeBalance`, `getCategoryTotals`, `computePercentages`, display formatters, `loadTransactions`). These are ideal for property-based testing. UI interaction properties (form reset, list ordering, delete) can also be tested via lightweight DOM manipulation in a test environment. **PBT is applicable.**

### Property-Based Testing Library

**[fast-check](https://github.com/dubzzz/fast-check)** loaded via CDN in the test HTML file. It is a mature, zero-dependency property-based testing library for JavaScript with no build step required.

Each property test runs a minimum of **100 iterations**.

Each test is tagged with a comment:
```js
// Feature: expense-budget-visualizer, Property N: <property_text>
```

### Unit / Example Tests

| Criteria | Test type | Description |
|---|---|---|
| 1.1 — Form fields present | EXAMPLE | Assert 3 fields exist with correct attributes and select options |
| 2.5 — Empty list shows placeholder | EXAMPLE | Assert `#empty-message` is visible when `transactions = []` |
| 3.2, 3.3 — Balance updates synchronously | EXAMPLE | Add/delete transaction; assert balance element updated |
| 4.2 — Chart updates synchronously | EXAMPLE | Mutation; assert chart data reflects change |
| 4.5, 4.6 — Empty state shown when no transactions | EDGE_CASE | Assert canvas hidden, empty-state shown |
| 5.4 — Init does not write to localStorage | EXAMPLE | Mock `localStorage.setItem`; init app; assert 0 calls |
| 5.5 — Corrupt data → empty list + warning | EDGE_CASE | Seed bad JSON; call `loadTransactions()`; assert `[]` + toast |
| 5.6 — Unavailable localStorage → empty + warning | EDGE_CASE | Mock unavailable; call `loadTransactions()`; assert `[]` + toast |
| 5.7 — Write failure → warning toast | EDGE_CASE | Mock `setItem` to throw; add transaction; assert toast shown |

### Property-Based Tests (one test per property)

| Property | Generators | Assertion |
|---|---|---|
| P1 — Validator | `fc.record({ name: fc.string(), amount: fc.float(), category: fc.oneof(...) })` | `validateForm()` result matches expected classification |
| P2 — Add grows list | Valid transaction arbitraries + starting list | List length +1, entry present |
| P3 — Form resets | Valid transaction arbitrary | All form fields default after submit |
| P4 — Name truncation | `fc.string({ minLength: 0, maxLength: 60 })` | Truncation rule holds |
| P5 — Newest-first | `fc.array(validTransaction, { minLength: 1 })` | Rendered order is reverse of insertion |
| P6 — Delete exact item | Non-empty transaction list + valid index | Correct item removed, rest intact |
| P7 — Balance sum | `fc.array(validTransaction)` | `computeBalance()` === rounded sum |
| P8 — Chart data integrity | `fc.array(validTransaction, { minLength: 1 })` | Totals correct + percentages sum to 100 |
| P9 — Zero-category exclusion | Transaction list with at least one zero-total category | Zero-total category absent from chart labels/data |
| P10 — Persistence round-trip | Sequence of add/delete operations | localStorage equals in-memory array after each step |
| P11 — Load round-trip | Valid `Transaction[]` array | `loadTransactions()` returns deeply equal array |

### Smoke / Structural Checks (manual or CI script)

- HTML has no `<style>` blocks or `style=""` attributes.
- HTML has no inline `<script>` blocks.
- `css/styles.css` exists and is the only CSS file.
- `js/app.js` exists and is the only JS file.
- `index.html` opens without JS console errors in Chrome/Firefox/Edge/Safari via `file://`.
- Layout shows no horizontal scrollbar at 320 px, 768 px, 1280 px, 1920 px viewport widths.
- Each category entry in the list shows both a colour indicator AND an icon.
