# Requirements Document

## Introduction

The Expense and Budget Visualizer is a client-side web application that allows users to track personal expenses, categorize spending, and visualize their budget distribution through an interactive pie chart. The application runs entirely in the browser using HTML, CSS, and vanilla JavaScript, with all data persisted locally via the browser's Local Storage API. No backend server, build tooling, or external dependencies beyond a charting library are required.

---

## Glossary

- **App**: The Expense and Budget Visualizer web application.
- **Transaction**: A single expense entry consisting of an item name, a monetary amount, and a category.
- **Category**: One of the three predefined spending groups: Food, Transport, or Fun.
- **Transaction_List**: The scrollable on-screen list displaying all recorded transactions.
- **Input_Form**: The HTML form through which the user enters a new transaction.
- **Balance_Display**: The UI component at the top of the page showing the current total of all transaction amounts.
- **Chart**: The pie chart component rendered via Chart.js that visualises spending distribution by category.
- **Local_Storage**: The browser's built-in Web Storage API used to persist transaction data between sessions.
- **Validator**: The client-side logic responsible for checking that all Input_Form fields contain valid values before a transaction is saved.

---

## Requirements

### Requirement 1: Transaction Input

**User Story:** As a user, I want to enter a transaction with a name, amount, and category, so that I can record my expenses quickly and accurately.

#### Acceptance Criteria

1. THE Input_Form SHALL present three fields: Item Name (text, maximum 100 characters), Amount (numeric, value between 0.01 and 999,999,999.99 inclusive, up to 2 decimal places), and Category (select with options Food, Transport, Fun).
2. WHEN the user submits the Input_Form, THE Validator SHALL verify that the Item Name field is not empty, the Amount field contains a numeric value between 0.01 and 999,999,999.99 with up to 2 decimal places, and a Category option has been selected.
3. IF any Input_Form field fails validation, THEN THE App SHALL display an inline error message identifying the invalid field and SHALL NOT save the transaction.
4. WHEN all fields pass validation and the user submits the Input_Form, THE App SHALL create a new Transaction and add it to the Transaction_List.
5. WHEN a Transaction is successfully added, THE Input_Form SHALL reset all fields to their default empty state: Item Name and Amount cleared to empty, Category reset to an unselected placeholder prompt.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see all my recorded transactions in a scrollable list, so that I can review my spending history at a glance.

#### Acceptance Criteria

1. THE Transaction_List SHALL display all stored Transactions, each showing the item name (truncated to 30 characters with an ellipsis if longer), amount, and category.
2. WHILE more Transactions exist than the visible area can accommodate, THE Transaction_List SHALL remain scrollable to reveal all entries.
3. THE Transaction_List SHALL present Transactions in the order they were added, with the most recent entry appearing at the top.
4. WHEN the user activates the delete button on a Transaction entry, THE App SHALL remove that Transaction from the Transaction_List.
5. WHEN the Transaction_List contains no entries, THE App SHALL display a placeholder message indicating that no transactions have been recorded.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total spending at the top of the page, so that I always know how much I have spent in total.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the algebraic sum of the amounts of all Transactions currently in the Transaction_List, rounded to 2 decimal places.
2. WHEN a new Transaction is added, THE Balance_Display SHALL update to reflect the new total within 100 milliseconds.
3. WHEN a Transaction is deleted, THE Balance_Display SHALL update to reflect the new total within 100 milliseconds.
4. WHEN the Transaction_List is empty, THE Balance_Display SHALL show a value of 0.00.
5. WHEN the Transaction_List contains one or more Transactions whose amounts sum to zero, THE Balance_Display SHALL show 0.00 as the computed sum.

---

### Requirement 4: Spending Distribution Chart

**User Story:** As a user, I want a pie chart showing how my spending is split across categories, so that I can understand where my money is going visually.

#### Acceptance Criteria

1. THE Chart SHALL render a pie chart that partitions total spending across all Transactions by Category (Food, Transport, Fun).
2. WHEN a Transaction is added or deleted, THE Chart SHALL update to reflect the new category totals within 100 milliseconds.
3. WHILE the pie chart is visible, THE Chart SHALL display both a label and a percentage value for each rendered Category segment, where each percentage represents that Category's share of total spending rounded to the nearest whole number and all displayed percentages sum to 100%.
4. WHEN no Transactions exist for a given Category but at least one other Category has Transactions, THE Chart SHALL omit that Category's segment from the pie chart.
5. WHEN all Categories have zero Transactions, THE Chart SHALL display an empty-state indicator rather than a pie chart.
6. IF the empty-state indicator is displayed, THEN THE Chart SHALL not render any segment, label, or percentage value.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved between browser sessions, so that I do not lose my spending history when I close or refresh the page.

#### Acceptance Criteria

1. WHEN a Transaction is added, THE App SHALL serialize the updated Transaction_List to Local_Storage.
2. WHEN a Transaction is deleted, THE App SHALL serialize the updated Transaction_List to Local_Storage.
3. WHEN the App initialises, THE App SHALL read the Transaction_List from Local_Storage and render all previously saved Transactions in the Transaction_List.
4. WHEN the App initialises, THE App SHALL NOT write data back to Local_Storage unless the user performs an add or delete action.
5. IF Local_Storage returns data that cannot be deserialized into a valid list of Transaction objects, THEN THE App SHALL initialise with an empty Transaction_List and SHALL display a dismissible, non-blocking warning to the user that does not prevent further interaction.
6. IF Local_Storage is unavailable, THEN THE App SHALL initialise with an empty Transaction_List and SHALL display a dismissible, non-blocking warning to the user that does not prevent further interaction.
7. IF a write to Local_Storage fails after an add or delete action, THEN THE App SHALL display a dismissible, non-blocking warning to the user that does not prevent further interaction.

---

### Requirement 6: Project Structure and Code Quality

**User Story:** As a developer, I want the project to follow a simple, predictable folder structure, so that the codebase is easy to navigate and maintain.

#### Acceptance Criteria

1. THE App SHALL be structured so that all CSS resides in exactly one file inside a `css/` directory, with no inline styles or style blocks in the HTML file.
2. THE App SHALL be structured so that all JavaScript resides in exactly one file inside a `js/` directory, with no inline scripts or script blocks in the HTML file.
3. THE App SHALL load without JavaScript errors in a modern browser (Chrome, Firefox, Edge, Safari) when opened directly as a local file (using the `file://` protocol) without a local server.
4. WHEN opened directly in a browser, THE App SHALL render the full UI, apply all CSS styles, and execute all JavaScript functionality correctly.
5. WHERE Chart.js is used as the charting library, THE App SHALL load a pinned version of Chart.js via a CDN `<script>` tag (e.g., Chart.js 4.x) and SHALL NOT require a package manager or build step.

---

### Requirement 7: Performance and Responsiveness

**User Story:** As a user, I want the app to feel fast and responsive, so that adding or deleting transactions never feels slow or laggy.

#### Acceptance Criteria

1. THE App SHALL complete its initial load and render — including all Transactions visible in the Transaction_List — within 2 seconds on a connection with download speed ≥10 Mbps.
2. WHEN the user interacts with the Input_Form or Transaction_List, THE App SHALL reflect all local UI state changes (such as form field clearing and selection state updates) within 100 milliseconds.
3. WHILE a user interaction is being processed, THE Input_Form fields SHALL remain editable and THE Transaction_List SHALL remain scrollable.
4. WHEN the App performs an add or delete operation, THE App SHALL reflect the final result of the operation in the Transaction_List and Balance_Display within 3 seconds.

---

### Requirement 8: Visual Design and Usability

**User Story:** As a user, I want a clean, readable interface with a clear visual hierarchy, so that I can use the app without confusion or visual clutter.

#### Acceptance Criteria

1. THE App SHALL apply a typographic scale with at least 3 distinct font sizes, where heading text is visually larger than body text, and labels are visually distinguishable from body text.
2. THE Balance_Display SHALL be visible within the initial viewport without scrolling on any screen width between 320 px and 1920 px.
3. THE App SHALL use both colour AND iconography to visually distinguish the three Categories (Food, Transport, Fun) in both the Transaction_List and the Chart, so that category distinction does not rely on colour alone.
4. THE App SHALL present the Input_Form, Transaction_List, and Chart in a layout that produces no text overflow, no element truncation beyond the item name truncation rule, and no horizontal scrollbar on screen widths from 320 px to 1920 px.
5. WHEN the layout is rendered at any screen width between 320 px and 1920 px, no two primary UI components (Input_Form, Transaction_List, Chart) SHALL overlap each other.
