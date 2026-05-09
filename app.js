const STORAGE_KEY = "standart-stroy-simple-app";

const state = loadState();
let draft = {
  type: "expense",
  accountId: "acc-tochka",
  projectId: "project-main",
  transferFromId: "acc-tochka",
  transferToId: "acc-leroy",
  debtAction: "debtOut",
  debtAccountId: "acc-tochka",
  vat: false,
  photoCount: 0,
};
let dialogMode = null;
let editingItem = null;
let selectedOverviewProjectId = state.projects[0]?.id || "";
let editingOperationId = null;
let settingsEditMode = false;
let operationsEditMode = false;
let projectContractDrafts = [];

const operationChoices = [
  ["income", "Доход"],
  ["expense", "Расход"],
  ["transfer", "Перевод"],
  ["debt", "Долг"],
  ["freeze", "Заморозка"],
];

const operationTypes = {
  income: { label: "Доход", sign: 1 },
  expense: { label: "Расход", sign: -1 },
  transfer: { label: "Перевод", sign: 0 },
  debt: { label: "Долг", sign: 0 },
  freeze: { label: "Заморозка", sign: 0 },
  debtGiven: { label: "В долг дали", sign: -1 },
  debtTaken: { label: "В долг взяли", sign: 1 },
  expected: { label: "Заморозили", sign: 0 },
};

const debtActionChoices = [
  ["debtOut", "Я дал / Я вернул долг"],
  ["debtIn", "Мне дали / Мне вернули долг"],
];

const debtActions = {
  debtOut: { label: "Я дал / Я вернул долг", sign: -1 },
  debtIn: { label: "Мне дали / Мне вернули долг", sign: 1 },
  iGave: { label: "Я дал / Я вернул долг", sign: -1 },
  iReturned: { label: "Я дал / Я вернул долг", sign: -1 },
  gotBack: { label: "Мне дали / Мне вернули долг", sign: 1 },
  iBorrowed: { label: "Мне дали / Мне вернули долг", sign: 1 },
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  render();
});

function initialState() {
  return {
    accounts: [
      { id: "acc-tochka", name: "Точка банк", kind: "Расчетный счет", balance: 0 },
      { id: "acc-leroy", name: "Леруа", kind: "Баланс поставщика", balance: 0 },
      { id: "acc-special", name: "Спецсчет", kind: "Спецсчет", balance: 0 },
      { id: "acc-owner", name: "Я", kind: "Личные средства", balance: 0 },
      { id: "acc-investor", name: "Инвестор", kind: "Личные средства", balance: 0 },
    ],
    projects: [
      { id: "project-main", name: "Текущий объект", kind: "Объект" },
      { id: "project-office", name: "Офис", kind: "Офис" },
      { id: "project-storage", name: "Склад/инструмент", kind: "Склад" },
      { id: "project-other", name: "Прочее", kind: "Прочее" },
    ],
    categories: [
      { id: "cat-materials", name: "Материалы" },
      { id: "cat-labor", name: "Работа мастеров" },
      { id: "cat-delivery", name: "Доставка" },
      { id: "cat-tools", name: "Инструмент" },
      { id: "cat-other", name: "Прочее" },
    ],
    counterparties: [
      { id: "cp-none", name: "Без контрагента", kind: "Прочее" },
      { id: "cp-worker", name: "Рабочий", kind: "Рабочий" },
      { id: "cp-supplier", name: "Поставщик", kind: "Поставщик" },
      { id: "cp-customer", name: "Заказчик", kind: "Заказчик" },
    ],
    workerContracts: [],
    operations: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const loaded = { ...initialState(), ...JSON.parse(raw) };
    if (!Array.isArray(loaded.workerContracts)) loaded.workerContracts = [];
    const specialAccount = loaded.accounts?.find((account) => account.id === "acc-special");
    if (specialAccount?.kind === "Заморожено 0 ₽") specialAccount.kind = "Спецсчет";
    return loaded;
  } catch {
    return initialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view, button.dataset.title));
  });

  document.getElementById("addFromJournalBtn").addEventListener("click", startNewOperation);
  document.getElementById("operationForm").addEventListener("submit", addOperation);
  document.getElementById("amountInput").addEventListener("input", formatAmountInput);
  document.getElementById("photoInput").addEventListener("change", (event) => {
    draft.photoCount = event.target.files.length;
    document.getElementById("photoInfo").textContent = draft.photoCount
      ? `Выбрано фото: ${draft.photoCount}`
      : "Фото не выбрано";
  });

  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => openSettingsDialog(button.dataset.add));
  });

  document.getElementById("operationsEditBtn").addEventListener("click", () => {
    operationsEditMode = !operationsEditMode;
    renderOperations();
  });

  document.getElementById("settingsEditBtn").addEventListener("click", () => {
    settingsEditMode = !settingsEditMode;
    renderSettings();
  });

  document.getElementById("settingsForm").addEventListener("submit", saveDialogItem);
  document.getElementById("dialogCancelBtn").addEventListener("click", closeSettingsDialog);
}

function render() {
  renderAccounts();
  renderInvestments();
  renderOperations();
  renderAddForm();
  renderOverview();
  renderSettings();
}

function showView(viewId, title) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewId);
  });
  document.getElementById("screenTitle").textContent = title || "Главная";
  if (viewId === "addView") {
    document.querySelectorAll(".nav-button").forEach((button) => button.classList.remove("active"));
  }
}

function renderAccounts() {
  const balances = calculateBalances();
  const frozenAmounts = calculateFrozenAmounts();
  const visibleAccounts = state.accounts.filter((account) => !isPersonalAccount(account));
  const total = visibleAccounts.reduce((sum, account) => sum + visibleBalance(account, balances, frozenAmounts), 0);
  document.getElementById("totalBalance").textContent = money(total);
  document.getElementById("accountsList").innerHTML = visibleAccounts
    .map((account) => {
      const balance = visibleBalance(account, balances, frozenAmounts);
      const subtitle = accountSubtitle(account, frozenAmounts[account.id] || 0);
      return `
        <button class="account-row" type="button">
          <span>
            <span class="row-title">${escapeHtml(account.name)}</span>
            ${subtitle ? `<span class="row-subtitle">${escapeHtml(subtitle)}</span>` : ""}
          </span>
          <span class="row-money ${balance < 0 ? "negative" : ""}">${money(balance)}</span>
        </button>
      `;
    })
    .join("");
}

function renderInvestments() {
  const investments = calculateInvestments();
  const investors = state.accounts.filter(isPersonalAccount);
  document.getElementById("investmentsList").innerHTML = investors
    .map((account) => {
      const amounts = investments[account.id] || { cash: 0, vat: 0 };
      return `
        <article class="investment-row">
          <div class="row-title">${escapeHtml(account.name)}</div>
          <div class="investment-values">
            <span>
              <span class="row-subtitle">Наличные</span>
              <strong>${money(amounts.cash)}</strong>
            </span>
            <span>
              <span class="row-subtitle">С НДС</span>
              <strong>${money(amounts.vat)}</strong>
            </span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderOperations() {
  const list = document.getElementById("operationsList");
  const operations = activeOperations();
  const editButton = document.getElementById("operationsEditBtn");
  editButton.textContent = operationsEditMode ? "Готово" : "Изменить";
  editButton.classList.toggle("active", operationsEditMode);
  if (!operations.length) {
    list.innerHTML = `<div class="empty-state">Операций пока нет</div>`;
    return;
  }
  list.innerHTML = operations
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(renderOperationRow)
    .join("");
  bindOperationActions();
}

function bindOperationActions() {
  document.querySelectorAll("[data-edit-operation]").forEach((button) => {
    button.addEventListener("click", () => openOperationEditor(button.dataset.editOperation));
  });
  document.querySelectorAll("[data-archive-operation]").forEach((button) => {
    button.addEventListener("click", () => archiveOperation(button.dataset.archiveOperation));
  });
}

function renderOverview() {
  syncOverviewProject();
  renderOverviewProjects();
  renderOverviewCategories();
  renderOverviewWorkers();
}

function syncOverviewProject() {
  if (!getById(state.projects, selectedOverviewProjectId)) {
    selectedOverviewProjectId = state.projects[0]?.id || "";
  }
}

function renderOverviewProjects() {
  document.getElementById("overviewProjectCards").innerHTML = state.projects
    .map((project) => choiceCard(project.id, project.name, projectSubtitle(project), selectedOverviewProjectId === project.id, "overview-project"))
    .join("");
  document.querySelectorAll("[data-overview-project]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedOverviewProjectId = button.getAttribute("data-overview-project");
      renderOverview();
    });
  });
}

function renderOverviewCategories() {
  const totals = new Map();
  activeOperations()
    .filter((operation) => operation.type === "expense" && operation.projectId === selectedOverviewProjectId)
    .forEach((operation) => {
      const key = operation.categoryName || "Без категории";
      totals.set(key, (totals.get(key) || 0) + operation.amount);
    });
  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  document.getElementById("overviewCategoryList").innerHTML = rows.length
    ? rows.map(([name, amount]) => summaryRow(name, money(amount))).join("")
    : `<div class="empty-state compact-empty">Расходов пока нет</div>`;
}

function renderOverviewWorkers() {
  const contracts = state.workerContracts.filter((contract) => contract.projectId === selectedOverviewProjectId);
  document.getElementById("overviewWorkerList").innerHTML = contracts.length
    ? contracts.map(renderWorkerContractCard).join("")
    : `<div class="empty-state compact-empty">Рабочие не добавлены</div>`;
}

function renderWorkerContractCard(contract) {
  const worker = getById(state.counterparties, contract.counterpartyId);
  const paid = activeOperations()
    .filter((operation) => {
      return operation.type === "expense" && operation.projectId === contract.projectId && operation.counterpartyId === contract.counterpartyId;
    })
    .reduce((sum, operation) => sum + operation.amount, 0);
  const left = Number(contract.amount || 0) - paid;
  return `
    <article class="worker-card">
      <div class="row-title">${escapeHtml(worker?.name || "Рабочий")}</div>
      <div class="worker-values">
        <span><span class="row-subtitle">Договор</span><strong>${money(contract.amount)}</strong></span>
        <span><span class="row-subtitle">Выплачено</span><strong>${money(paid)}</strong></span>
        <span><span class="row-subtitle">Осталось</span><strong class="${left < 0 ? "negative" : ""}">${money(left)}</strong></span>
      </div>
      ${contract.comment ? `<div class="operation-meta">${escapeHtml(contract.comment)}</div>` : ""}
    </article>
  `;
}

function summaryRow(title, value) {
  return `
    <div class="summary-row">
      <span class="row-title">${escapeHtml(title)}</span>
      <span class="row-money">${value}</span>
    </div>
  `;
}

function renderOperationRow(operation) {
  if (operation.type === "transfer") return renderTransferOperation(operation);
  if (operation.type === "debt") return renderDebtOperation(operation);
  return renderStandardOperation(operation);
}

function renderStandardOperation(operation) {
  const type = operationTypes[operation.type] || operationTypes.expense;
  const account = getById(state.accounts, operation.accountId);
  const project = getById(state.projects, operation.projectId);
  return operationRow({
    id: operation.id,
    title: type.label,
    meta: [
      [formatDate(operation.createdAt), account?.name, project?.name].filter(Boolean).join(" · "),
      operation.categoryName,
      operation.comment,
    ],
    amount: signedMoney(operation.amount, type.sign),
    amountClass: amountClass(type.sign),
  });
}

function renderTransferOperation(operation) {
  const fromAccount = getById(state.accounts, operation.fromAccountId);
  const toAccount = getById(state.accounts, operation.toAccountId);
  return operationRow({
    id: operation.id,
    title: "Перевод",
    meta: [
      formatDate(operation.createdAt),
      `${fromAccount?.name || "Счет"} → ${toAccount?.name || "Счет"}`,
      operation.vat ? "С НДС" : "",
      operation.comment,
    ],
    amount: money(operation.amount),
    amountClass: "",
  });
}

function renderDebtOperation(operation) {
  const action = debtActions[operation.debtAction] || debtActions.iGave;
  const account = getById(state.accounts, operation.accountId);
  const counterparty = getById(state.counterparties, operation.counterpartyId);
  return operationRow({
    id: operation.id,
    title: action.label,
    meta: [
      [formatDate(operation.createdAt), account?.name, counterparty?.name].filter(Boolean).join(" · "),
      operation.comment,
    ],
    amount: signedMoney(operation.amount, action.sign),
    amountClass: amountClass(action.sign),
  });
}

function operationRow({ id, title, meta, amount, amountClass }) {
  return `
    <article class="operation-row">
      <div class="operation-top">
        <div>
          <div class="row-title">${escapeHtml(title)}</div>
          ${meta.filter(Boolean).map((line) => `<div class="operation-meta">${escapeHtml(line)}</div>`).join("")}
        </div>
        <div class="operation-amount ${amountClass}">${amount}</div>
      </div>
      ${operationsEditMode ? `
        <div class="operation-actions">
          <button type="button" class="icon-mini" data-edit-operation="${id}" aria-label="Редактировать операцию">✎</button>
          <button type="button" class="icon-mini" data-archive-operation="${id}" aria-label="В архив">↧</button>
        </div>
      ` : ""}
    </article>
  `;
}

function renderAddForm() {
  syncDraftWithState();
  renderTypeCards();
  renderFormMode();
  renderAccountCards();
  renderProjectCards();
  renderTransferCards();
  renderDebtCards();
  renderSelect("categorySelect", state.categories, draft.categoryId || "");
  renderSelect("counterpartySelect", state.counterparties, draft.counterpartyId || "");
  renderSelect("debtCounterpartySelect", state.counterparties, draft.debtCounterpartyId || "");
  setDefaultDates();
  document.getElementById("operationSubmitBtn").textContent = editingOperationId ? "Сохранить операцию" : "Добавить операцию";
}

function syncDraftWithState() {
  const firstAccountId = state.accounts[0]?.id || "";
  const secondAccountId = state.accounts.find((account) => account.id !== firstAccountId)?.id || firstAccountId;
  if (!getById(state.accounts, draft.accountId)) draft.accountId = firstAccountId;
  if (!getById(state.accounts, draft.transferFromId)) draft.transferFromId = firstAccountId;
  if (!getById(state.accounts, draft.transferToId)) draft.transferToId = secondAccountId;
  if (draft.transferFromId === draft.transferToId) draft.transferToId = secondAccountId;
  if (!getById(state.accounts, draft.debtAccountId)) draft.debtAccountId = firstAccountId;
  if (!getById(state.projects, draft.projectId)) draft.projectId = state.projects[0]?.id || "";
}

function renderTypeCards() {
  document.getElementById("typeCards").innerHTML = operationChoices
    .map(([id, label]) => {
      return `<button type="button" class="choice-card compact ${draft.type === id ? "active" : ""}" data-type="${id}">${escapeHtml(label)}</button>`;
    })
    .join("");
  document.querySelectorAll("[data-type]").forEach((button) => {
    button.addEventListener("click", () => {
      draft.type = button.dataset.type;
      renderAddForm();
    });
  });
}

function renderFormMode() {
  const isTransfer = draft.type === "transfer";
  const isDebt = draft.type === "debt";
  document.getElementById("standardFields").hidden = isTransfer || isDebt;
  document.getElementById("transferFields").hidden = !isTransfer;
  document.getElementById("debtFields").hidden = !isDebt;
}

function renderAccountCards() {
  document.getElementById("accountCards").innerHTML = state.accounts
    .map((account) => choiceCard(account.id, account.name, "", draft.accountId === account.id, "account"))
    .join("");
  document.querySelectorAll("[data-account]").forEach((button) => {
    button.addEventListener("click", () => {
      draft.accountId = button.dataset.account;
      renderAccountCards();
    });
  });
}

function renderProjectCards() {
  document.getElementById("projectCards").innerHTML = state.projects
    .map((project) => choiceCard(project.id, project.name, projectSubtitle(project), draft.projectId === project.id, "project"))
    .join("");
  document.querySelectorAll("[data-project]").forEach((button) => {
    button.addEventListener("click", () => {
      draft.projectId = button.dataset.project;
      renderProjectCards();
    });
  });
}

function renderTransferCards() {
  syncTransferDraft();
  renderAccountChoiceCards("transferFromCards", "transfer-from", draft.transferFromId, (id) => {
    draft.transferFromId = id;
    renderTransferCards();
  }, state.accounts.filter((account) => account.id !== draft.transferToId));
  renderAccountChoiceCards("transferToCards", "transfer-to", draft.transferToId, (id) => {
    draft.transferToId = id;
    renderTransferCards();
  }, state.accounts.filter((account) => account.id !== draft.transferFromId));
}

function syncTransferDraft() {
  const accounts = state.accounts;
  if (draft.transferFromId === draft.transferToId) {
    draft.transferToId = accounts.find((account) => account.id !== draft.transferFromId)?.id || "";
  }
  if (!accounts.some((account) => account.id === draft.transferFromId && account.id !== draft.transferToId)) {
    draft.transferFromId = accounts.find((account) => account.id !== draft.transferToId)?.id || accounts[0]?.id || "";
  }
  if (!accounts.some((account) => account.id === draft.transferToId && account.id !== draft.transferFromId)) {
    draft.transferToId = accounts.find((account) => account.id !== draft.transferFromId)?.id || "";
  }
}

function renderDebtCards() {
  document.getElementById("debtActionCards").innerHTML = debtActionChoices
    .map(([id, label]) => {
      return `<button type="button" class="choice-card ${draft.debtAction === id ? "active" : ""}" data-debt-action="${id}"><strong>${escapeHtml(label)}</strong></button>`;
    })
    .join("");
  document.querySelectorAll("[data-debt-action]").forEach((button) => {
    button.addEventListener("click", () => {
      draft.debtAction = button.dataset.debtAction;
      renderDebtCards();
    });
  });
  renderAccountChoiceCards("debtAccountCards", "debt-account", draft.debtAccountId, (id) => {
    draft.debtAccountId = id;
    renderDebtCards();
  });
}

function renderAccountChoiceCards(containerId, dataName, selectedId, onSelect, accounts = state.accounts) {
  document.getElementById(containerId).innerHTML = state.accounts
    .filter((account) => accounts.some((option) => option.id === account.id))
    .map((account) => choiceCard(account.id, account.name, "", selectedId === account.id, dataName))
    .join("");
  document.querySelectorAll(`[data-${dataName}]`).forEach((button) => {
    button.addEventListener("click", () => onSelect(button.getAttribute(`data-${dataName}`)));
  });
}

function choiceCard(id, title, subtitle, active, dataName) {
  return `
    <button type="button" class="choice-card ${active ? "active" : ""}" data-${dataName}="${id}">
      <strong>${escapeHtml(title)}</strong>
      ${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ""}
    </button>
  `;
}

function renderSelect(id, items, selectedId) {
  const select = document.getElementById(id);
  select.innerHTML =
    `<option value="" ${!selectedId ? "selected" : ""}>—</option>` +
    items.map((item) => `<option value="${item.id}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
}

function optionsHtml(items, selectedId) {
  return items
    .map((item) => `<option value="${item.id}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.name)}</option>`)
    .join("");
}

function contractCounterparties() {
  return state.counterparties.filter((counterparty) => counterparty.id !== "cp-none");
}

function prepareProjectContractDrafts(projectId) {
  projectContractDrafts = state.workerContracts
    .filter((contract) => contract.projectId === projectId)
    .map((contract) => ({ ...contract, amount: formatInputAmount(contract.amount) }));
}

function renderProjectContractEditor() {
  const container = document.getElementById("contractRows");
  if (!container) return;
  const counterparties = contractCounterparties();
  container.innerHTML = projectContractDrafts.length
    ? projectContractDrafts.map((contract, index) => contractDraftRow(contract, index, counterparties)).join("")
    : `<div class="empty-state compact-empty">Сотрудники не добавлены</div>`;
  bindProjectContractEditor();
}

function contractDraftRow(contract, index, counterparties) {
  return `
    <div class="contract-row" data-contract-index="${index}">
      <label class="field-label">Контрагент
        <select data-contract-field="counterpartyId">
          ${optionsHtml(counterparties, contract.counterpartyId)}
        </select>
      </label>
      <label class="field-label">Сумма договора
        <input data-contract-field="amount" inputmode="decimal" value="${escapeAttr(contract.amount || "")}" placeholder="0" />
      </label>
      <label class="field-label contract-comment">Комментарий
        <input data-contract-field="comment" value="${escapeAttr(contract.comment || "")}" placeholder="Что делает" />
      </label>
      <button type="button" class="icon-mini danger-mini contract-remove" data-remove-contract="${index}" aria-label="Убрать сотрудника">×</button>
    </div>
  `;
}

function bindProjectContractEditor() {
  document.querySelectorAll("[data-contract-field]").forEach((field) => {
    const eventName = field.tagName === "SELECT" ? "change" : "input";
    field.addEventListener(eventName, () => updateContractDraft(field));
  });
  document.querySelectorAll("[data-remove-contract]").forEach((button) => {
    button.addEventListener("click", () => {
      projectContractDrafts.splice(Number(button.dataset.removeContract), 1);
      renderProjectContractEditor();
    });
  });
  document.querySelectorAll('[data-contract-field="amount"]').forEach((input) => {
    input.addEventListener("input", formatAmountInput);
  });
}

function updateContractDraft(field) {
  const row = field.closest("[data-contract-index]");
  if (!row) return;
  const contract = projectContractDrafts[Number(row.dataset.contractIndex)];
  if (!contract) return;
  contract[field.dataset.contractField] = field.value;
}

function addProjectContractDraft() {
  const firstCounterparty = contractCounterparties()[0];
  if (!firstCounterparty) return notify("Сначала добавьте контрагента");
  projectContractDrafts.push({
    id: createId("contract"),
    counterpartyId: firstCounterparty.id,
    amount: "",
    comment: "",
  });
  renderProjectContractEditor();
}

function saveProjectContracts(projectId) {
  state.workerContracts = state.workerContracts.filter((contract) => contract.projectId !== projectId);
  projectContractDrafts.forEach((contract) => {
    if (!contract.counterpartyId) return;
    state.workerContracts.push({
      id: contract.id || createId("contract"),
      projectId,
      counterpartyId: contract.counterpartyId,
      amount: parseAmount(contract.amount),
      comment: String(contract.comment || "").trim(),
    });
  });
}

function startNewOperation() {
  editingOperationId = null;
  document.getElementById("operationForm").reset();
  draft.type = "expense";
  draft.photoCount = 0;
  document.getElementById("photoInfo").textContent = "Фото не выбрано";
  renderAddForm();
  showView("addView", "Добавить");
}

function openOperationEditor(id) {
  const operation = getById(state.operations, id);
  if (!operation) return;
  editingOperationId = id;
  fillOperationForm(operation);
  showView("addView", "Редактировать");
}

function fillOperationForm(operation) {
  document.getElementById("operationForm").reset();
  draft.type = operation.type;
  if (operation.type === "transfer") {
    draft.transferFromId = operation.fromAccountId;
    draft.transferToId = operation.toAccountId;
    renderAddForm();
    document.getElementById("transferVatInput").checked = Boolean(operation.vat);
    document.getElementById("transferDateInput").value = localDateTimeValue(new Date(operation.createdAt));
    document.getElementById("transferCommentInput").value = operation.comment || "";
  } else if (operation.type === "debt") {
    draft.debtAction = debtActions[operation.debtAction]?.sign < 0 ? "debtOut" : "debtIn";
    draft.debtAccountId = operation.accountId;
    renderAddForm();
    document.getElementById("debtCounterpartySelect").value = operation.counterpartyId || "";
    document.getElementById("debtDateInput").value = localDateTimeValue(new Date(operation.createdAt));
    document.getElementById("debtCommentInput").value = operation.comment || "";
  } else {
    draft.accountId = operation.accountId;
    draft.projectId = operation.projectId;
    renderAddForm();
    document.getElementById("vatInput").checked = Boolean(operation.vat);
    document.getElementById("categorySelect").value = operation.categoryId || "";
    document.getElementById("counterpartySelect").value = operation.counterpartyId || "";
    document.getElementById("commentInput").value = operation.comment || "";
  }
  document.getElementById("amountInput").value = formatInputAmount(operation.amount);
  document.getElementById("operationSubmitBtn").textContent = "Сохранить операцию";
}

function archiveOperation(id) {
  const operation = getById(state.operations, id);
  if (!operation) return;
  if (!confirm("Перенести операцию в архив?")) return;
  const previous = clone(operation);
  operation.archived = true;
  saveState();
  render();
  notify("Операция в архиве", {
    label: "Отменить",
    handler: () => replaceOperation(previous),
  });
}

function restoreOperation(id) {
  const operation = getById(state.operations, id);
  if (!operation) return;
  operation.archived = false;
  saveState();
  render();
  notify("Операция восстановлена");
}

function replaceOperation(snapshot) {
  const index = state.operations.findIndex((operation) => operation.id === snapshot.id);
  if (index >= 0) {
    state.operations[index] = clone(snapshot);
  } else {
    state.operations.unshift(clone(snapshot));
  }
  saveState();
  render();
  notify("Действие отменено");
}

function removeOperation(id) {
  const index = state.operations.findIndex((operation) => operation.id === id);
  if (index >= 0) state.operations.splice(index, 1);
  saveState();
  render();
  notify("Действие отменено");
}

function addOperation(event) {
  event.preventDefault();
  const amount = parseAmount(document.getElementById("amountInput").value);
  if (!amount) return notify("Введите сумму");
  const existing = editingOperationId ? getById(state.operations, editingOperationId) : null;
  const previous = existing ? clone(existing) : null;
  const operation = buildOperation(amount);
  if (!operation) return;
  if (existing) {
    if (draft.type !== "transfer" && draft.type !== "debt") operation.createdAt = existing.createdAt;
    Object.assign(existing, operation, { id: existing.id, archived: false });
  } else {
    state.operations.unshift(operation);
  }
  const savedOperationId = existing ? existing.id : operation.id;
  saveState();
  resetOperationForm(event.target);
  render();
  showView("operationsView", "Операции");
  if (existing && previous) {
    notify("Операция сохранена", {
      label: "Отменить",
      handler: () => replaceOperation(previous),
    });
  } else {
    notify("Операция добавлена", {
      label: "Отменить",
      handler: () => removeOperation(savedOperationId),
    });
  }
}

function buildOperation(amount) {
  if (draft.type === "transfer") return buildTransferOperation(amount);
  if (draft.type === "debt") return buildDebtOperation(amount);
  return buildStandardOperation(amount);
}

function buildStandardOperation(amount) {
  const category = getById(state.categories, document.getElementById("categorySelect").value);
  return {
    id: createId(),
    type: draft.type,
    amount,
    accountId: draft.accountId,
    projectId: draft.projectId,
    vat: document.getElementById("vatInput").checked,
    categoryId: category?.id || "",
    categoryName: category?.name || "",
    counterpartyId: document.getElementById("counterpartySelect").value,
    comment: document.getElementById("commentInput").value.trim(),
    photoCount: draft.photoCount,
    createdAt: new Date().toISOString(),
  };
}

function buildTransferOperation(amount) {
  if (!draft.transferFromId || !draft.transferToId) return notify("Выберите оба счета");
  if (draft.transferFromId === draft.transferToId) return notify("Выберите разные счета");
  return {
    id: createId(),
    type: "transfer",
    amount,
    fromAccountId: draft.transferFromId,
    toAccountId: draft.transferToId,
    vat: document.getElementById("transferVatInput").checked,
    comment: document.getElementById("transferCommentInput").value.trim(),
    createdAt: isoFromLocalInput(document.getElementById("transferDateInput").value),
  };
}

function buildDebtOperation(amount) {
  return {
    id: createId(),
    type: "debt",
    debtAction: draft.debtAction,
    amount,
    accountId: draft.debtAccountId,
    counterpartyId: document.getElementById("debtCounterpartySelect").value,
    comment: document.getElementById("debtCommentInput").value.trim(),
    createdAt: isoFromLocalInput(document.getElementById("debtDateInput").value),
  };
}

function resetOperationForm(form) {
  form.reset();
  editingOperationId = null;
  draft.photoCount = 0;
  document.getElementById("photoInfo").textContent = "Фото не выбрано";
  document.getElementById("operationSubmitBtn").textContent = "Добавить операцию";
}

function activeOperations() {
  return state.operations.filter((operation) => !operation.archived);
}

function calculateBalances() {
  const balances = Object.fromEntries(state.accounts.map((account) => [account.id, Number(account.balance || 0)]));
  activeOperations().forEach((operation) => {
    if (operation.type === "transfer") {
      balances[operation.fromAccountId] = (balances[operation.fromAccountId] || 0) - operation.amount;
      balances[operation.toAccountId] = (balances[operation.toAccountId] || 0) + operation.amount;
      return;
    }
    if (operation.type === "debt") {
      const action = debtActions[operation.debtAction] || debtActions.iGave;
      balances[operation.accountId] = (balances[operation.accountId] || 0) + operation.amount * action.sign;
      return;
    }
    const type = operationTypes[operation.type];
    if (!type || operation.type === "expected" || operation.type === "freeze") return;
    balances[operation.accountId] = (balances[operation.accountId] || 0) + operation.amount * type.sign;
  });
  return balances;
}

function calculateFrozenAmounts() {
  const frozenAmounts = Object.fromEntries(state.accounts.map((account) => [account.id, 0]));
  activeOperations().forEach((operation) => {
    if (operation.type !== "freeze") return;
    frozenAmounts[operation.accountId] = (frozenAmounts[operation.accountId] || 0) + operation.amount;
  });
  return frozenAmounts;
}

function calculateInvestments() {
  const investments = Object.fromEntries(
    state.accounts.filter(isPersonalAccount).map((account) => [account.id, { cash: 0, vat: 0 }])
  );
  activeOperations().forEach((operation) => {
    if (operation.type === "transfer") {
      const fromAccount = getById(state.accounts, operation.fromAccountId);
      const toAccount = getById(state.accounts, operation.toAccountId);
      const bucket = operation.vat ? "vat" : "cash";
      if (fromAccount && isPersonalAccount(fromAccount) && toAccount && !isPersonalAccount(toAccount)) {
        if (investments[operation.fromAccountId]) investments[operation.fromAccountId][bucket] += operation.amount;
      }
      if (fromAccount && !isPersonalAccount(fromAccount) && toAccount && isPersonalAccount(toAccount)) {
        if (investments[operation.toAccountId]) investments[operation.toAccountId][bucket] -= operation.amount;
      }
      return;
    }
    if (operation.type !== "expense" && operation.type !== "income") return;
    if (!investments[operation.accountId]) return;
    const bucket = operation.vat ? "vat" : "cash";
    const sign = operation.type === "expense" ? 1 : -1;
    investments[operation.accountId][bucket] += operation.amount * sign;
  });
  return investments;
}

function renderSettings() {
  const editButton = document.getElementById("settingsEditBtn");
  editButton.textContent = settingsEditMode ? "Готово" : "Изменить";
  editButton.classList.toggle("active", settingsEditMode);
  renderSettingsList("settingsAccounts", state.accounts);
  renderSettingsList("settingsProjects", state.projects);
  renderSettingsList("settingsCategories", state.categories);
  renderSettingsList("settingsCounterparties", state.counterparties);
  renderArchivedOperations();
}

function renderArchivedOperations() {
  const archived = state.operations.filter((operation) => operation.archived);
  document.getElementById("settingsArchivedOperations").innerHTML = archived.length
    ? archived
        .map((operation) => {
          const type = operation.type === "debt" ? debtActions[operation.debtAction]?.label : operationTypes[operation.type]?.label;
          return `
            <div class="settings-row">
              <span>
                <span class="row-title">${escapeHtml(type || "Операция")}</span>
                <span class="row-subtitle">${formatDate(operation.createdAt)} · ${money(operation.amount)}</span>
              </span>
              <span class="settings-actions">
                <button type="button" class="icon-mini" data-restore-operation="${operation.id}" aria-label="Восстановить">↥</button>
              </span>
            </div>
          `;
        })
        .join("")
    : `<div class="empty-state compact-empty">Архив пуст</div>`;
  document.querySelectorAll("[data-restore-operation]").forEach((button) => {
    button.addEventListener("click", () => restoreOperation(button.dataset.restoreOperation));
  });
}

function renderSettingsList(elementId, items) {
  const mode = settingsModeByElementId(elementId);
  document.getElementById(elementId).innerHTML = items
    .map((item) => {
      return `
        <div class="settings-row">
          <span>
            <span class="row-title">${escapeHtml(item.name)}</span>
          </span>
          ${settingsEditMode ? `
            <span class="settings-actions">
              <button type="button" class="icon-mini" data-edit="${mode}" data-id="${item.id}" aria-label="Редактировать">✎</button>
              <button type="button" class="icon-mini danger-mini" data-delete="${mode}" data-id="${item.id}" aria-label="Удалить">×</button>
            </span>
          ` : ""}
        </div>
      `;
    })
    .join("");
  document.querySelectorAll(`[data-edit="${mode}"]`).forEach((button) => {
    button.addEventListener("click", () => openSettingsDialog(mode, button.dataset.id));
  });
  document.querySelectorAll(`[data-delete="${mode}"]`).forEach((button) => {
    button.addEventListener("click", () => deleteSettingsItem(mode, button.dataset.id));
  });
}

function settingsModeByElementId(elementId) {
  return {
    settingsAccounts: "account",
    settingsProjects: "project",
    settingsCategories: "category",
    settingsCounterparties: "counterparty",
  }[elementId];
}

function openSettingsDialog(mode, itemId = null) {
  dialogMode = mode;
  editingItem = itemId ? getSettingsCollection(mode).find((item) => item.id === itemId) : null;
  const titleMap = {
    account: editingItem ? "Редактировать счет" : "Добавить счет",
    project: editingItem ? "Редактировать объект" : "Добавить объект",
    category: editingItem ? "Редактировать категорию" : "Добавить категорию",
    counterparty: editingItem ? "Редактировать контрагента" : "Добавить контрагента",
  };
  document.getElementById("dialogTitle").textContent = titleMap[mode] || "Добавить";
  document.getElementById("dialogFields").innerHTML = dialogFields(mode, editingItem);
  document.querySelector('#settingsForm [name="balance"]')?.addEventListener("input", formatAmountInput);
  if (mode === "project") {
    prepareProjectContractDrafts(editingItem?.id);
    renderProjectContractEditor();
    document.getElementById("addContractBtn")?.addEventListener("click", addProjectContractDraft);
  }
  document.getElementById("settingsDialog").showModal();
}

function dialogFields(mode, item = null) {
  if (mode === "category") {
    return `
      <label class="field-label">Название<input name="name" value="${escapeAttr(item?.name || "")}" required /></label>
    `;
  }
  if (mode === "account") {
    return `
      <label class="field-label">Название<input name="name" value="${escapeAttr(item?.name || "")}" required /></label>
      <label class="field-label">Начальный баланс<input name="balance" inputmode="decimal" value="${item ? formatInputAmount(item.balance) : ""}" placeholder="0" /></label>
    `;
  }
  if (mode === "project") {
    return `
      <label class="field-label">Название<input name="name" value="${escapeAttr(item?.name || "")}" required /></label>
      <label class="field-label">Дата начала<input name="startDate" type="date" value="${escapeAttr(item?.startDate || "")}" /></label>
      <label class="field-label">Дата окончания<input name="endDate" type="date" value="${escapeAttr(item?.endDate || "")}" /></label>
      <section class="contracts-editor">
        <div class="section-head compact-head">
          <div class="field-title">Сотрудники</div>
          <button id="addContractBtn" type="button" class="small-action add-action" aria-label="Добавить сотрудника">+</button>
        </div>
        <div id="contractRows" class="contract-rows"></div>
      </section>
    `;
  }
  return `
    <label class="field-label">Название<input name="name" value="${escapeAttr(item?.name || "")}" required /></label>
  `;
}

function saveDialogItem(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  const collection = getSettingsCollection(dialogMode);
  const target = editingItem || {};
  const name = String(data.get("name") || "").trim();
  if (!name) return notify("Введите название");
  if (dialogMode === "account") {
    Object.assign(target, { id: target.id || createId("acc"), name, kind: target.kind || "Счет", balance: parseAmount(data.get("balance")) });
  }
  if (dialogMode === "project") {
    Object.assign(target, {
      id: target.id || createId("project"),
      name,
      kind: target.kind || "Объект",
      startDate: String(data.get("startDate") || ""),
      endDate: String(data.get("endDate") || ""),
    });
    saveProjectContracts(target.id);
  }
  if (dialogMode === "category") {
    Object.assign(target, { id: target.id || createId("cat"), name });
    delete target.subcategories;
  }
  if (dialogMode === "counterparty") {
    Object.assign(target, { id: target.id || createId("cp"), name, kind: target.kind || "Контрагент" });
  }
  if (!editingItem) collection.push(target);
  saveAfterDialog(event.target);
}

function saveAfterDialog(form) {
  saveState();
  closeSettingsDialog();
  form.reset();
  render();
  notify("Сохранено");
}

function deleteSettingsItem(mode, id) {
  if (!confirm("Удалить запись?")) return;
  const collection = getSettingsCollection(mode);
  const index = collection.findIndex((item) => item.id === id);
  if (index >= 0) collection.splice(index, 1);
  if (mode === "account" && draft.accountId === id) draft.accountId = state.accounts[0]?.id || "";
  if (mode === "account" && draft.transferFromId === id) draft.transferFromId = state.accounts[0]?.id || "";
  if (mode === "account" && draft.transferToId === id) draft.transferToId = state.accounts.find((account) => account.id !== draft.transferFromId)?.id || draft.transferFromId;
  if (mode === "account" && draft.debtAccountId === id) draft.debtAccountId = state.accounts[0]?.id || "";
  if (mode === "project" && draft.projectId === id) draft.projectId = state.projects[0]?.id || "";
  if (mode === "project" && selectedOverviewProjectId === id) selectedOverviewProjectId = state.projects[0]?.id || "";
  if (mode === "project") state.workerContracts = state.workerContracts.filter((contract) => contract.projectId !== id);
  if (mode === "counterparty") state.workerContracts = state.workerContracts.filter((contract) => contract.counterpartyId !== id);
  saveState();
  render();
  notify("Удалено");
}

function closeSettingsDialog() {
  document.getElementById("settingsDialog").close();
  editingItem = null;
  projectContractDrafts = [];
}

function getSettingsCollection(mode) {
  return {
    account: state.accounts,
    project: state.projects,
    category: state.categories,
    counterparty: state.counterparties,
  }[mode];
}

function getById(items, id) {
  return items.find((item) => item.id === id);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPersonalAccount(account) {
  return account.id === "acc-owner" || account.id === "acc-investor" || account.kind === "Личные средства";
}

function isSpecialAccount(account) {
  return account.id.includes("special") || account.name.toLowerCase().includes("спец");
}

function visibleBalance(account, balances, frozenAmounts) {
  const balance = balances[account.id] || 0;
  if (!isSpecialAccount(account)) return balance;
  return balance - (frozenAmounts[account.id] || 0);
}

function accountSubtitle(account, frozenAmount) {
  if (isSpecialAccount(account) && frozenAmount) return money(frozenAmount);
  return "";
}

function projectSubtitle(project) {
  const dates = [];
  if (project.startDate) dates.push(formatDateOnly(project.startDate));
  if (project.endDate) dates.push(formatDateOnly(project.endDate));
  const left = daysLeft(project.endDate);
  const leftText = left === null ? "" : left >= 0 ? `осталось ${left} дн.` : `просрочено ${Math.abs(left)} дн.`;
  return [dates.join(" - "), leftText].filter(Boolean).join(" · ");
}

function daysLeft(endDate) {
  if (!endDate) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(`${endDate}T00:00:00`);
  return Math.ceil((end - start) / 86400000);
}

function formatDateOnly(value) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(`${value}T00:00:00`));
}

function money(value) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function signedMoney(value, sign) {
  if (sign < 0) return `−${money(value)}`;
  return money(value);
}

function amountClass(sign) {
  if (sign < 0) return "negative";
  if (sign > 0) return "positive";
  return "";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function setDefaultDates() {
  const value = localDateTimeValue(new Date());
  const transferDateInput = document.getElementById("transferDateInput");
  const debtDateInput = document.getElementById("debtDateInput");
  if (transferDateInput && !transferDateInput.value) transferDateInput.value = value;
  if (debtDateInput && !debtDateInput.value) debtDateInput.value = value;
}

function localDateTimeValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function isoFromLocalInput(value) {
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

function parseAmount(value) {
  const number = Number(String(value || "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

function formatAmountInput(event) {
  const input = event.target;
  input.value = formatAmountText(input.value);
}

function formatInputAmount(value) {
  return formatAmountText(String(value ?? "").replace(".", ","));
}

function formatAmountText(value) {
  const normalized = String(value || "")
    .replace(/\s/g, "")
    .replace(".", ",")
    .replace(/[^\d,-]/g, "");
  const negative = normalized.startsWith("-");
  const withoutMinus = normalized.replaceAll("-", "");
  const hasComma = withoutMinus.includes(",");
  const [integerPart, decimalPart = ""] = withoutMinus.split(",");
  const integer = integerPart.replace(/\D/g, "");
  const decimal = decimalPart.replace(/\D/g, "").slice(0, 2);
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${negative ? "-" : ""}${grouped}${hasComma ? `,${decimal}` : ""}`;
}

function createId(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

let toastTimer = null;
function notify(message, action = null) {
  clearTimeout(toastTimer);
  const toast = document.getElementById("toast");
  toast.replaceChildren();
  const text = document.createElement("span");
  text.textContent = message;
  toast.appendChild(text);
  toast.classList.toggle("with-action", Boolean(action));
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label || "Отменить";
    button.addEventListener("click", () => {
      toast.classList.remove("show");
      action.handler();
    });
    toast.appendChild(button);
  }
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), action ? 7000 : 2200);
}
