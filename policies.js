
document.addEventListener("DOMContentLoaded", function () {
  if (sessionStorage.getItem("popoyeLoggedIn") !== "true") {
    window.location.replace("login.html");
    return;
  }

  const POLICY_KEY = "popoyePolicies";
  const CUSTOMER_KEY = "popoyeCustomers";
  const PAGE_SIZE = 5;

  const $ = id => document.getElementById(id);

  const form = $("policyForm");
  const modal = $("policyModal");
  const tableBody = $("policyTableBody");
  const searchInput = $("searchInput");
  const statusFilter = $("statusFilter");
  const typeFilter = $("typeFilter");
  const message = $("policyMessage");

  let policies = [];
  let customers = [];
  let currentPage = 1;
  let messageTimer;

  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function savePolicies() {
    try {
      localStorage.setItem(POLICY_KEY, JSON.stringify(policies));
      return true;
    } catch {
      showMessage("Unable to save policies. Check browser storage.", true);
      return false;
    }
  }

  function showMessage(text, error = false) {
    clearTimeout(messageTimer);
    message.textContent = text;
    message.style.color = error ? "#DC2626" : "#0D9488";

    messageTimer = setTimeout(() => {
      message.textContent = "";
    }, 4000);
  }

  function money(amount) {
    return Number(amount || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    });
  }

  function localToday() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
      return null;
    }

    const date = new Date(value + "T00:00:00");

    if (Number.isNaN(date.getTime())) return null;

    if (
      date.getFullYear() !== Number(value.slice(0, 4)) ||
      date.getMonth() + 1 !== Number(value.slice(5, 7)) ||
      date.getDate() !== Number(value.slice(8, 10))
    ) {
      return null;
    }

    return date;
  }

  function getStatus(policy) {
    const expiry = parseDate(policy.expiryDate);
    const start = parseDate(policy.startDate);
    const today = parseDate(localToday());

    if (!expiry || !start || !today) return "Invalid Dates";
    if (expiry < start) return "Invalid Dates";
    if (expiry < today) return "Expired";
    if (start > today) return "Not Started";

    const daysLeft = Math.round(
      (expiry.getTime() - today.getTime()) / 86400000
    );

    if (daysLeft <= 30) return "Expiring Soon";
    return "Active";
  }

  function getCustomer(id) {
    return customers.find(customer => customer.id === id);
  }

  function getCustomerName(policy) {
    const customer = getCustomer(policy.customerId);
    return customer ? customer.name : (policy.customerName || "Unknown Customer");
  }

  function getVehicleNumber(policy) {
    const customer = getCustomer(policy.customerId);
    return customer
      ? customer.vehicleNumber
      : (policy.vehicleNumber || "—");
  }

  function refreshCustomerOptions(selectedId = "") {
    const select = $("customerSelect");
    select.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = customers.length
      ? "Select a customer"
      : "No customers registered";
    select.appendChild(placeholder);

    customers.forEach(customer => {
      const option = document.createElement("option");
      option.value = customer.id;
      option.textContent =
        `${customer.name} — ${customer.vehicleNumber || "No vehicle number"}`;
      select.appendChild(option);
    });

    select.value = selectedId;

    const help = $("customerHelp");
    help.textContent = customers.length
      ? "Choose a registered customer."
      : "Go to Customers and register a customer first.";
  }

  function filteredPolicies() {
    const query = searchInput.value.trim().toLowerCase();

    return policies.filter(policy => {
      const searchable = [
        policy.policyNumber,
        getCustomerName(policy),
        getVehicleNumber(policy),
        policy.insuranceType
      ].join(" ").toLowerCase();

      const matchesSearch = searchable.includes(query);
      const status = getStatus(policy);

      const matchesStatus =
        statusFilter.value === "all" ||
        status === statusFilter.value;

      const matchesType =
        typeFilter.value === "all" ||
        policy.insuranceType === typeFilter.value;

      return matchesSearch && matchesStatus && matchesType;
    });
  }

  function cell(row, value) {
    const td = document.createElement("td");
    td.textContent = value || "—";
    row.appendChild(td);
    return td;
  }

  function renderPolicies() {
    const filtered = filteredPolicies();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

    currentPage = Math.max(1, Math.min(currentPage, totalPages));

    const start = (currentPage - 1) * PAGE_SIZE;
    const visible = filtered.slice(start, start + PAGE_SIZE);

    tableBody.replaceChildren();

    if (!visible.length) {
      const row = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 8;
      td.className = "empty-state";
      td.textContent = policies.length
        ? "No policies match your search or filters."
        : "No policies added yet. Click Add Policy to begin.";
      row.appendChild(td);
      tableBody.appendChild(row);
    }

    visible.forEach(policy => {
      const row = document.createElement("tr");

      const numberCell = cell(row, policy.policyNumber);
      numberCell.className = "policy-number";

      cell(row, getCustomerName(policy));
      cell(row, getVehicleNumber(policy));
      cell(row, policy.insuranceType);
      cell(row, money(policy.premiumAmount));
      cell(row, policy.expiryDate);

      const statusCell = document.createElement("td");
      const badge = document.createElement("span");
      const status = getStatus(policy);

      badge.className = "status-badge " + (
        status === "Active" ? "active" :
        status === "Expiring Soon" ? "expiring" : "expired"
      );

      badge.textContent = status;
      statusCell.appendChild(badge);
      row.appendChild(statusCell);

      const actionsCell = document.createElement("td");
      const actions = document.createElement("div");
      actions.className = "action-buttons";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "small-btn edit-btn";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => openEditModal(policy.id));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "small-btn delete-btn";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => deletePolicy(policy.id));

      actions.append(edit, remove);
      actionsCell.appendChild(actions);
      row.appendChild(actionsCell);

      tableBody.appendChild(row);
    });

    $("pageInfo").textContent = filtered.length
      ? `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length} policies`
      : "Showing 0 policies";

    $("pageNumber").textContent = `${currentPage} / ${totalPages}`;
    $("prevPage").disabled = currentPage <= 1;
    $("nextPage").disabled = currentPage >= totalPages;

    updateStatistics();
  }

  function updateStatistics() {
    $("totalPolicies").textContent = policies.length;

    $("activePolicies").textContent = policies.filter(
      p => getStatus(p) === "Active"
    ).length;

    $("expiringPolicies").textContent = policies.filter(
      p => getStatus(p) === "Expiring Soon"
    ).length;

    $("expiredPolicies").textContent = policies.filter(
      p => getStatus(p) === "Expired"
    ).length;
  }

  function openAddModal() {
    form.reset();
    $("editPolicyId").value = "";
    $("modalTitle").textContent = "Add New Policy";
    $("savePolicyBtn").textContent = "Save Policy";

    refreshCustomerOptions();

    $("startDate").value = localToday();

    const defaultExpiry = new Date();
    defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);
    defaultExpiry.setDate(defaultExpiry.getDate() - 1);

    const y = defaultExpiry.getFullYear();
    const m = String(defaultExpiry.getMonth() + 1).padStart(2, "0");
    const d = String(defaultExpiry.getDate()).padStart(2, "0");
    $("expiryDate").value = `${y}-${m}-${d}`;

    modal.hidden = false;
    $("customerSelect").focus();
  }

  function openEditModal(id) {
    const policy = policies.find(item => item.id === id);
    if (!policy) return;

    form.reset();
    $("editPolicyId").value = policy.id;

    refreshCustomerOptions(policy.customerId);

    $("policyNumber").value = policy.policyNumber;
    $("insuranceType").value = policy.insuranceType;
    $("premiumAmount").value = policy.premiumAmount;
    $("startDate").value = policy.startDate;
    $("expiryDate").value = policy.expiryDate;
    $("policyNotes").value = policy.notes || "";

    $("modalTitle").textContent = "Edit Policy";
    $("savePolicyBtn").textContent = "Update Policy";

    modal.hidden = false;
    $("customerSelect").focus();
  }

  function closeModal() {
    modal.hidden = true;
    form.reset();
    $("editPolicyId").value = "";
  }

  function deletePolicy(id) {
    const policy = policies.find(item => item.id === id);
    if (!policy) return;

    if (!confirm(`Delete policy ${policy.policyNumber}?`)) return;

    const previous = policies;
    policies = policies.filter(item => item.id !== id);

    if (!savePolicies()) {
      policies = previous;
      return;
    }

    renderPolicies();
    showMessage("Policy deleted successfully.");
  }

  form.addEventListener("submit", event => {
    event.preventDefault();

    const id = $("editPolicyId").value;
    const customerId = $("customerSelect").value;
    const policyNumber = $("policyNumber").value.trim();
    const insuranceType = $("insuranceType").value;
    const premiumAmount = Number($("premiumAmount").value);
    const startDate = $("startDate").value;
    const expiryDate = $("expiryDate").value;
    const notes = $("policyNotes").value.trim();

    if (!customers.some(customer => customer.id === customerId)) {
      showMessage("Please select a registered customer first.", true);
      return;
    }

    if (!policyNumber || !insuranceType) {
      showMessage("Please complete all required fields.", true);
      return;
    }

    if (!Number.isFinite(premiumAmount) ||
        premiumAmount <= 0 || premiumAmount > 100000000) {
      showMessage("Enter a valid premium amount greater than zero.", true);
      return;
    }

    const start = parseDate(startDate);
    const expiry = parseDate(expiryDate);

    if (!start || !expiry || expiry < start) {
      showMessage("Please enter valid dates. Expiry must not precede the start date.", true);
      return;
    }

    const duplicate = policies.some(policy =>
      policy.policyNumber.toLowerCase() === policyNumber.toLowerCase() &&
      policy.id !== id
    );

    if (duplicate) {
      showMessage("This policy number is already registered.", true);
      return;
    }

    const existing = policies.find(policy => policy.id === id);
    const customer = getCustomer(customerId);

    const record = {
      id: existing ? existing.id : (
        "POL-" + Date.now().toString(36).toUpperCase() +
        "-" + Math.random().toString(36).slice(2, 6).toUpperCase()
      ),
      customerId: customer.id,
      customerName: customer.name,
      vehicleNumber: customer.vehicleNumber || "",
      policyNumber,
      insuranceType,
      premiumAmount,
      startDate,
      expiryDate,
      notes,
      createdAt: existing
        ? existing.createdAt
        : localToday()
    };

    const previous = policies;

    policies = existing
      ? policies.map(policy => policy.id === id ? record : policy)
      : [record, ...policies];

    if (!savePolicies()) {
      policies = previous;
      return;
    }

    closeModal();
    currentPage = 1;
    renderPolicies();

    showMessage(existing
      ? "Policy updated successfully."
      : "Policy registered successfully.");
  });

  $("addPolicyBtn").addEventListener("click", () => {
    customers = readArray(CUSTOMER_KEY);

    if (!customers.length) {
      showMessage("Please add a customer before creating a policy.", true);
      return;
    }

    openAddModal();
  });

  $("closeModalBtn").addEventListener("click", closeModal);
  $("cancelBtn").addEventListener("click", closeModal);

  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });

  [searchInput, statusFilter, typeFilter].forEach(control => {
    control.addEventListener(
      control === searchInput ? "input" : "change",
      () => {
        currentPage = 1;
        renderPolicies();
      }
    );
  });

  $("prevPage").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderPolicies();
    }
  });

  $("nextPage").addEventListener("click", () => {
    const pages = Math.max(
      1, Math.ceil(filteredPolicies().length / PAGE_SIZE)
    );

    if (currentPage < pages) {
      currentPage++;
      renderPolicies();
    }
  });

  // Shared demo theme.
  if (localStorage.getItem("popoyeTheme") === "dark") {
    document.body.classList.add("dark-mode");
  }

  $("themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    localStorage.setItem(
      "popoyeTheme",
      document.body.classList.contains("dark-mode") ? "dark" : "light"
    );
  });

  $("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
  });

  $("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("popoyeLoggedIn");
    window.location.replace("login.html");
  });

  $("currentYear").textContent = new Date().getFullYear();

  customers = readArray(CUSTOMER_KEY);
  policies = readArray(POLICY_KEY);

  renderPolicies();
});
