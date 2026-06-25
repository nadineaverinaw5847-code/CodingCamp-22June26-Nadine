// js/app.js — Expense & Budget Visualizer application logic

// --- State ---
let transactions = [];
let chartInstance = null;

// --- Category Config ---

const CATEGORY_CONFIG = {
  Food:      { icon: '🍔', colour: '#FF6384' },
  Transport: { icon: '🚌', colour: '#36A2EB' },
  Fun:       { icon: '🎉', colour: '#FFCE56' }
};

// --- Transaction List Renderer ---

/**
 * Renders the transaction list into #transaction-list, newest-first.
 * Does NOT mutate the `transactions` storage array — uses a reversed copy.
 * When the list is empty, shows a placeholder message instead of <li> items.
 *
 * Each <li> contains:
 *  - A colour-coded category badge with the category emoji icon
 *  - The item name (full text; CSS handles truncation via text-overflow: ellipsis)
 *  - The amount formatted as $X.XX
 *  - A delete <button> with aria-label="Delete [name]"
 *
 * @param {Array} txArray - The transactions array (ordered oldest-first in storage).
 */
function renderList(txArray) {
  const ul = document.getElementById('transaction-list');
  if (!ul) return;

  // Clear current contents
  ul.innerHTML = '';

  if (!txArray || txArray.length === 0) {
    const p = document.createElement('p');
    p.id = 'empty-message';
    p.textContent = 'No transactions recorded yet.';
    ul.appendChild(p);
    return;
  }

  // Render newest-first without mutating the storage array
  const reversed = txArray.slice().reverse();

  reversed.forEach(function (t) {
    const config = CATEGORY_CONFIG[t.category] || { icon: '', colour: '#ccc' };

    const li = document.createElement('li');
    li.className = 'transaction-item';

    // Category badge (emoji icon + colour pill)
    const badge = document.createElement('span');
    badge.className = 'category-badge';
    badge.style.backgroundColor = config.colour;
    badge.setAttribute('aria-label', t.category);
    badge.textContent = config.icon;

    // Item name (full name; CSS handles truncation)
    const nameSpan = document.createElement('span');
    nameSpan.className = 'transaction-name';
    nameSpan.textContent = t.name;

    // Amount formatted to 2 d.p. with $ prefix
    const amountSpan = document.createElement('span');
    amountSpan.className = 'transaction-amount';
    amountSpan.textContent = '$' + t.amount.toFixed(2);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('aria-label', 'Delete ' + t.name);
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', function () {
      deleteTransaction(t.id);
    });

    li.appendChild(badge);
    li.appendChild(nameSpan);
    li.appendChild(amountSpan);
    li.appendChild(deleteBtn);

    ul.appendChild(li);
  });
}

// --- Delete Transaction ---

/**
 * Removes the transaction with the given id from the in-memory array,
 * persists the updated list to localStorage, then triggers a full re-render.
 *
 * @param {string} id - The id of the transaction to remove.
 */
function deleteTransaction(id) {
  transactions = transactions.filter(function (t) {
    return t.id !== id;
  });
  saveTransactions(transactions);
  renderAll();
}

// --- Balance Display Component ---

/**
 * Computes the algebraic sum of all transaction amounts, rounded to 2 decimal places.
 * Returns 0.00 for an empty array or when amounts sum to zero.
 *
 * @param {Array} txArray - The transactions array.
 * @returns {number} The balance rounded to 2 decimal places.
 */
function computeBalance(txArray) {
  if (!txArray || txArray.length === 0) {
    return 0.00;
  }

  const sum = txArray.reduce(function (acc, t) {
    return acc + t.amount;
  }, 0);

  return Math.round(sum * 100) / 100;
}

/**
 * Renders the current balance into #balance-display as "$X.XX".
 * Calls computeBalance with the current transactions array.
 */
function renderBalance() {
  const el = document.getElementById('balance-display');
  if (!el) return;

  const balance = computeBalance(transactions);
  el.textContent = '$' + balance.toFixed(2);
}

// --- Chart Data Helpers ---

/**
 * Aggregates transaction amounts by category.
 * Always returns an object with all three category keys, defaulting to 0.
 *
 * @param {Array} txArray - The transactions array.
 * @returns {{ Food: number, Transport: number, Fun: number }}
 */
function getCategoryTotals(txArray) {
  const totals = { Food: 0, Transport: 0, Fun: 0 };
  if (!txArray || txArray.length === 0) return totals;

  txArray.forEach(function (t) {
    if (t.category in totals) {
      totals[t.category] += t.amount;
    }
  });

  return totals;
}

/**
 * Converts raw category totals to integer percentages that sum to exactly 100.
 * Uses the Largest-Remainder (Hamilton) method so rounding errors are absorbed
 * by the largest slice. Categories with a total of 0 are excluded entirely.
 * Returns {} when all totals are 0.
 *
 * @param {{ Food: number, Transport: number, Fun: number }} totals
 * @returns {Object} e.g. { Food: 67, Transport: 33 }
 */
function computePercentages(totals) {
  // Only include categories with a positive total
  const positive = Object.keys(totals).filter(function (k) {
    return totals[k] > 0;
  });

  if (positive.length === 0) return {};

  const grandTotal = positive.reduce(function (sum, k) {
    return sum + totals[k];
  }, 0);

  // Compute exact (floating-point) percentages and floor each one
  const floored = {};
  let sumFloored = 0;

  positive.forEach(function (k) {
    const exact = (totals[k] / grandTotal) * 100;
    floored[k] = Math.floor(exact);
    sumFloored += floored[k];
  });

  // Distribute remaining percentage points (100 - sumFloored) to the categories
  // with the largest fractional remainders — i.e. largest-remainder method.
  const remainder = 100 - sumFloored;

  if (remainder > 0) {
    // Sort by descending fractional remainder
    const sorted = positive.slice().sort(function (a, b) {
      const fracA = (totals[a] / grandTotal) * 100 - floored[a];
      const fracB = (totals[b] / grandTotal) * 100 - floored[b];
      return fracB - fracA;
    });

    for (let i = 0; i < remainder; i++) {
      floored[sorted[i]] += 1;
    }
  }

  return floored;
}

// --- Chart Plugin ---

/**
 * Custom Chart.js afterDraw plugin that draws icon + percentage text
 * centred inside each pie slice.  No external CDN plugins required.
 */
const percentageLabelPlugin = {
  id: 'percentageLabels',
  afterDraw: function (chart) {
    // Retrieve the transactions captured at render time from chart metadata
    const txArray = chart._expenseTxArray;
    if (!txArray) return;

    const percentages = computePercentages(getCategoryTotals(txArray));
    const ctx2d = chart.ctx;
    const meta = chart.getDatasetMeta(0);

    if (!meta || !meta.data || meta.data.length === 0) return;

    ctx2d.save();

    meta.data.forEach(function (arc, index) {
      const label = chart.data.labels[index]; // e.g. "🍔 Food"
      // Extract category name (second word) and map to icon+percentage
      const categoryName = label.split(' ')[1]; // "Food", "Transport", "Fun"
      const config = CATEGORY_CONFIG[categoryName];
      if (!config) return;

      const pct = percentages[categoryName];
      if (pct === undefined) return;

      // Compute the centroid of the arc
      const midAngle = arc.startAngle + (arc.endAngle - arc.startAngle) / 2;
      const outerRadius = arc.outerRadius;
      const innerRadius = arc.innerRadius || 0;
      const centroidR = innerRadius + (outerRadius - innerRadius) * 0.6;

      const x = arc.x + centroidR * Math.cos(midAngle);
      const y = arc.y + centroidR * Math.sin(midAngle);

      // Draw icon line
      ctx2d.fillStyle = '#fff';
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';
      ctx2d.font = 'bold 14px sans-serif';

      const iconText = config.icon;
      const pctText = pct + '%';
      const lineHeight = 18;

      ctx2d.fillText(iconText, x, y - lineHeight / 2);
      ctx2d.fillText(pctText, x, y + lineHeight / 2);
    });

    ctx2d.restore();
  }
};

// --- Chart Renderer ---

/**
 * Renders or updates the spending pie chart.
 *
 * - If Chart.js is not loaded, hides the chart section and shows a warning toast.
 * - If all categories are zero, shows the empty-state and destroys any existing instance.
 * - Otherwise, creates the chart on first call or mutates data on subsequent calls
 *   for fast (<100 ms) updates with no animation.
 *
 * @param {Array} txArray - The current transactions array.
 */
function renderChart(txArray) {
  // --- Guard: Chart.js CDN may have failed to load ---
  if (typeof window.Chart === 'undefined') {
    const section = document.getElementById('chart-section');
    if (section) section.style.display = 'none';
    showToast('Chart library failed to load. Spending chart is unavailable.', 'warning');
    return;
  }

  const canvas = document.getElementById('spending-chart');
  const emptyState = document.getElementById('chart-empty-state');

  const totals = getCategoryTotals(txArray);
  const percentages = computePercentages(totals);
  const hasData = Object.keys(percentages).length > 0;

  // --- No data: show empty state ---
  if (!hasData) {
    if (canvas) canvas.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';

    if (chartInstance !== null) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  // --- Has data: show canvas, hide empty state ---
  if (canvas) canvas.style.display = '';
  if (emptyState) emptyState.style.display = 'none';

  // Build ordered arrays for the categories that have data
  const categoryOrder = ['Food', 'Transport', 'Fun'];
  const labels = [];
  const dataValues = [];
  const backgroundColors = [];

  categoryOrder.forEach(function (cat) {
    if (totals[cat] > 0) {
      const cfg = CATEGORY_CONFIG[cat];
      labels.push(cfg.icon + ' ' + cat);
      dataValues.push(totals[cat]);
      backgroundColors.push(cfg.colour);
    }
  });

  // --- First render: create Chart.js instance ---
  if (chartInstance === null) {
    const ctx = canvas.getContext('2d');

    const config = {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: backgroundColors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (context) {
                const cat = context.label.split(' ')[1]; // "Food" etc.
                const amount = context.parsed;
                const pct = percentages[cat] !== undefined ? percentages[cat] : 0;
                return cat + ': $' + amount.toFixed(2) + ' (' + pct + '%)';
              }
            }
          }
        }
      },
      plugins: [percentageLabelPlugin]
    };

    // Attach transactions reference so the plugin can compute percentages
    chartInstance = new window.Chart(ctx, config);
    chartInstance._expenseTxArray = txArray;

  } else {
    // --- Subsequent renders: mutate data and update without animation ---
    chartInstance._expenseTxArray = txArray;
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = dataValues;
    chartInstance.data.datasets[0].backgroundColor = backgroundColors;
    chartInstance.update('none');
  }
}

// --- Render All ---

/**
 * Re-renders the transaction list, balance display, and chart.
 */
function renderAll() {
  renderList(transactions);
  renderBalance();
  renderChart(transactions);
}

// --- Helpers ---

/**
 * Returns a unique string ID.
 * Uses crypto.randomUUID() when available, otherwise falls back to
 * a Date.now() + Math.random() combination.
 * @returns {string}
 */
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return String(Date.now()) + '-' + String(Math.random()).slice(2);
}

/**
 * Returns true if localStorage is available and functional, false otherwise.
 * @returns {boolean}
 */
function isLocalStorageAvailable() {
  try {
    localStorage.setItem('__ls_test__', '1');
    localStorage.removeItem('__ls_test__');
    return true;
  } catch (e) {
    return false;
  }
}

// --- Toast ---

/**
 * Appends a dismissible toast notification to #toast-container.
 * Auto-removes after 5000 ms.
 * @param {string} message - The message to display.
 * @param {'warning'|'error'} type - Visual style of the toast.
 */
function showToast(message, type) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast toast--' + type;
  toast.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', function () {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  });

  toast.appendChild(closeBtn);
  container.appendChild(toast);

  setTimeout(function () {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 5000);
}

// --- Persistence ---

/**
 * Reads and validates transactions from localStorage.
 * Populates the module-level `transactions` array.
 * Shows a warning toast if data was unavailable, corrupt, or partially invalid.
 * @returns {Array} The validated array of transaction objects.
 */
function loadTransactions() {
  if (!isLocalStorageAvailable()) {
    showToast('localStorage is unavailable. Data will not be saved this session.', 'warning');
    return [];
  }

  const raw = localStorage.getItem('expense_transactions');
  if (raw === null) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    showToast('Stored data could not be read and has been cleared.', 'warning');
    return [];
  }

  if (!Array.isArray(parsed)) {
    showToast('Stored data could not be read and has been cleared.', 'warning');
    return [];
  }

  const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];

  const valid = parsed.filter(function (item) {
    if (!item || typeof item !== 'object') return false;
    if (typeof item.id !== 'string' || item.id.trim() === '') return false;
    if (typeof item.name !== 'string') return false;
    const trimmedName = item.name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 100) return false;
    if (typeof item.amount !== 'number' || !isFinite(item.amount)) return false;
    if (item.amount <= 0 || item.amount > 999999999.99) return false;
    if (!VALID_CATEGORIES.includes(item.category)) return false;
    if (typeof item.createdAt !== 'number' || !isFinite(item.createdAt)) return false;
    return true;
  });

  if (parsed.length > 0 && valid.length === 0) {
    showToast('Some stored transactions were invalid and could not be restored.', 'warning');
  }

  transactions = valid;
  return valid;
}

/**
 * Serializes and writes the given transaction array to localStorage.
 * Shows a warning toast if the write fails.
 * @param {Array} txArray - The transaction array to persist.
 */
function saveTransactions(txArray) {
  try {
    localStorage.setItem('expense_transactions', JSON.stringify(txArray));
  } catch (e) {
    showToast('Could not save data to localStorage.', 'warning');
  }
}

// --- Validation ---

/**
 * Validates the three input fields of the transaction form.
 *
 * Rules:
 *  - name    : non-empty after .trim()
 *  - amount  : parseable as a float, in range [0.01, 999999999.99],
 *              at most 2 decimal places
 *  - category: exactly one of "Food", "Transport", "Fun"
 *
 * @param {string|*} name     - Raw value from the item-name input.
 * @param {string|number} amount - Raw value from the amount input.
 * @param {string|*} category - Raw value from the category select.
 * @returns {{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }}
 */
function validateForm(name, amount, category) {
  const errors = {};

  // --- Name validation ---
  if (typeof name !== 'string' || name.trim().length === 0) {
    errors.name = 'Item name is required and cannot be empty.';
  }

  // --- Amount validation ---
  const amountStr = String(amount).trim();
  const parsed = parseFloat(amountStr);

  if (amountStr === '' || isNaN(parsed) || !isFinite(parsed)) {
    errors.amount = 'Amount must be a valid number.';
  } else if (parsed < 0.01 || parsed > 999999999.99) {
    errors.amount = 'Amount must be between 0.01 and 999,999,999.99.';
  } else {
    // Check at most 2 decimal places using the raw string.
    // Handles both "1.234" and scientific notation edge-cases.
    const dotIndex = amountStr.indexOf('.');
    if (dotIndex !== -1 && amountStr.length - dotIndex - 1 > 2) {
      errors.amount = 'Amount must have at most 2 decimal places.';
    }
  }

  // --- Category validation ---
  const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];
  if (!VALID_CATEGORIES.includes(category)) {
    errors.category = 'Please select a valid category: Food, Transport, or Fun.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors: errors
  };
}

// --- Transaction ---

/**
 * Builds a Transaction object from the current form values, pushes it onto
 * the in-memory array, persists to localStorage, resets the form, and
 * triggers a full re-render.
 *
 * Called only after validateForm() has returned valid: true.
 *
 * @param {string} name     - Trimmed item name.
 * @param {string} amount   - Raw amount string (will be parsed to float).
 * @param {string} category - One of "Food", "Transport", "Fun".
 */
function addTransaction(name, amount, category) {
  const transaction = {
    id: generateId(),
    name: name.trim(),
    amount: parseFloat(amount),
    category: category,
    createdAt: Date.now()
  };

  transactions.push(transaction);
  saveTransactions(transactions);

  // Reset form fields to defaults
  const nameInput = document.getElementById('item-name');
  const amountInput = document.getElementById('item-amount');
  const categorySelect = document.getElementById('item-category');

  if (nameInput) nameInput.value = '';
  if (amountInput) amountInput.value = '';
  if (categorySelect) categorySelect.value = '';

  renderAll();
}

// --- Form Event Wiring ---

document.addEventListener('DOMContentLoaded', function () {
  // Load persisted transactions on startup
  transactions = loadTransactions();
  renderAll();

  const form = document.getElementById('transaction-form');
  if (!form) return;

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    const nameInput = document.getElementById('item-name');
    const amountInput = document.getElementById('item-amount');
    const categorySelect = document.getElementById('item-category');

    const name = nameInput ? nameInput.value : '';
    const amount = amountInput ? amountInput.value : '';
    const category = categorySelect ? categorySelect.value : '';

    const result = validateForm(name, amount, category);

    // Inline error spans
    const nameError = document.getElementById('name-error');
    const amountError = document.getElementById('amount-error');
    const categoryError = document.getElementById('category-error');

    if (!result.valid) {
      // Display inline errors for failing fields; clear errors for passing fields
      if (nameError) nameError.textContent = result.errors.name || '';
      if (amountError) amountError.textContent = result.errors.amount || '';
      if (categoryError) categoryError.textContent = result.errors.category || '';
    } else {
      // Clear all inline errors
      if (nameError) nameError.textContent = '';
      if (amountError) amountError.textContent = '';
      if (categoryError) categoryError.textContent = '';

      addTransaction(name, amount, category);
    }
  });
});
