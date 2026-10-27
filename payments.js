
"use strict";

(() => {
  const CUSTOMERS_KEY = "popoyeCustomers";
  const POLICIES_KEY = "popoyePolicies";
  const PAYMENTS_KEY = "popoyePayments";
  const PAGE_SIZE = 5;

  // Login protection for the existing Popoye Insurance project.
  if (sessionStorage.getItem("popoyeLoggedIn") !== "true") {
    window.location.href = "login.html";
    return;
  }

  const $ = (id) => document.getElementById(id);

  const elements = {
    table: $("paymentsTableBody"),
    total: $("totalPayments"),
    collected: $("totalCollected"),
    pending: $("pendingAmount"),
    failed: $("failedPayments"),
    search: $("searchInput"),
    statusFilter: $("statusFilter"),
    methodFilter: $("methodFilter"),
    modal: $("paymentModal"),
    form: $("paymentForm"),
    modalTitle: $("modalTitle"),
    recordId: $("paymentRecordId"),
    customer: $("customerSelect"),
    policy: $("policySelect"),
    amount: $("amountInput"),
    date: $("paymentDate"),
    method: $("methodSelect"),
    status: $("paymentStatus"),
    transaction: $("transactionInput"),
    policyHelp: $("policyHelp"),
    empty: $("emptyState"),
    paginationInfo: $("paginationInfo"),
    pageNumbers: $("pageNumbers"),
    prev: $("prevPage"),
    next: $("nextPage"),
    notice: $("notice")
  };

  let currentPage = 1;
  let noticeTimer;
  let payments = loadArray(PAYMENTS_KEY);
  let customers = loadArray(CUSTOMERS_KEY);
  let policies = loadArray(POLICIES_KEY);

  function loadArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function savePayments() {
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function money(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  function localDate() {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000)
      .toISOString()
      .slice(0, 10);
  }

  function formatDate(value) {
    if (!value) return "—";

    const parts = String(value).slice(0, 10).split("-");
    if (parts.length !== 3) return escapeHTML(value);

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function getCustomerName(customer) {
    return customer.name ||
      customer.customerName ||
      customer.fullName ||
      "Unnamed Customer";
  }

  function getVehicleNumber(customer) {
    return customer.vehicleNumber ||
      customer.vehicleNo ||
      customer.registrationNumber ||
      "No vehicle number";
  }

  function getCustomerById(id) {
    return customers.find((customer) => String(customer.id) === String(id));
  }

  function getPolicyById(id) {
    return policies.find((policy) =>
      String(policy.id) === String(id) ||
      String(policy.policyNumber) === String(id)
    );
  }

  function getPaymentCustomer(payment) {
    if (payment.customerId != null) {
      const customer = getCustomerById(payment.customerId);
      if (customer) return customer;
    }

    return {
      id: payment.customerId || "",
      name: payment.customerName || "Unknown Customer",
      vehicleNumber: payment.vehicleNumber || ""
    };
  }

  function getPaymentPolicy(payment) {
    if (payment.policyId != null) {
      const policy = getPolicyById(payment.policyId);
      if (policy) return policy;
    }

    return {
      id: payment.policyId || "",
      policyNumber: payment.policyNumber || "—",
      premiumAmount: payment.amount || payment.premiumAmount || 0
    };
  }

  function statusClass(status) {
    if (status === "Paid") return "status-paid";
    if (status === "Failed") return "status-failed";
    return "status-pending";
  }

  function showNotice(message) {
    elements.notice.textContent = message;
    elements.notice.classList.add("show");

    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      elements.notice.classList.remove("show");
    }, 3000);
  }

  function refreshSourceData() {
    customers = loadArray(CUSTOMERS_KEY);
    policies = loadArray(POLICIES_KEY);
    payments = loadArray(PAYMENTS_KEY);
  }

  function renderStats() {
    const paid = payments.filter((payment) => payment.status === "Paid");
    const pending = payments.filter((payment) => payment.status === "Pending");
    const failed = payments.filter((payment) => payment.status === "Failed");

    elements.total.textContent = payments.length;
    elements.collected.textContent = money(
      paid.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    );
    elements.pending.textContent = money(
      pending.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    );
    elements.failed.textContent = failed.length;
  }

  function getFilteredPayments() {
    const query = elements.search.value.trim().toLowerCase();
    const selectedStatus = elements.statusFilter.value;
    const selectedMethod = elements.methodFilter.value;

    return payments
      .filter((payment) => {
        const customer = getPaymentCustomer(payment);
        const policy = getPaymentPolicy(payment);

        const searchable = [
          payment.id,
          payment.paymentId,
          customer.name,
          getVehicleNumber(customer),
          payment.transactionId,
          payment.referenceId,
          policy.policyNumber
        ].join(" ").toLowerCase();

        const matchesSearch = !query || searchable.includes(query);
        const matchesStatus = !selectedStatus ||
          payment.status === selectedStatus;
        const matchesMethod = !selectedMethod ||
          payment.method === selectedMethod;

        return matchesSearch && matchesStatus && matchesMethod;
      })
      .sort((a, b) =>
        String(b.createdAt || b.date || "")
          .localeCompare(String(a.createdAt || a.date || ""))
      );
  }

  function renderTable() {
    const filtered = getFilteredPayments();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * PAGE_SIZE;
    const visible = filtered.slice(start, start + PAGE_SIZE);

    elements.empty.hidden = filtered.length !== 0;

    elements.table.innerHTML = visible.map((payment) => {
      const customer = getPaymentCustomer(payment);
      const policy = getPaymentPolicy(payment);
      const id = payment.id ?? payment.paymentId ?? "";
      const displayId = payment.paymentNumber ||
        payment.paymentId ||
        `PAY-${String(id).slice(-8)}`;

      return `
        <tr>
          <td>
            <span class="customer-name">${escapeHTML(displayId)}</span>
            <span class="sub-text">${escapeHTML(policy.policyNumber || "—")}</span>
          </td>
          <td>
            <span class="customer-name">${escapeHTML(getCustomerName(customer))}</span>
            <span class="sub-text">${escapeHTML(getVehicleNumber(customer))}</span>
          </td>
          <td><strong>${money(payment.amount)}</strong></td>
          <td>${escapeHTML(payment.method || "Other")}</td>
          <td>${formatDate(payment.date)}</td>
          <td>
            <span class="status ${statusClass(payment.status)}">
              ${escapeHTML(payment.status || "Pending")}
            </span>
          </td>
          <td>
            <div class="action-buttons">
              <button class="action-btn" type="button"
                data-action="receipt" data-id="${escapeHTML(id)}">Receipt</button>
              <button class="action-btn" type="button"
                data-action="edit" data-id="${escapeHTML(id)}">Edit</button>
              <button class="action-btn delete" type="button"
                data-action="delete" data-id="${escapeHTML(id)}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    elements.paginationInfo.textContent = filtered.length
      ? `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length}`
      : "Showing 0 of 0";

    elements.prev.disabled = currentPage <= 1;
    elements.next.disabled = currentPage >= totalPages;

    elements.pageNumbers.innerHTML = "";

    for (let page = 1; page <= totalPages; page++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `page-number${page === currentPage ? " active" : ""}`;
      button.textContent = page;
      button.setAttribute("aria-label", `Page ${page}`);

      button.addEventListener("click", () => {
        currentPage = page;
        renderTable();
      });

      elements.pageNumbers.appendChild(button);
    }
  }

  function renderAll() {
    renderStats();
    renderTable();
  }

  function populateCustomers(selectedId = "") {
    elements.customer.innerHTML =
      '<option value="">Select customer</option>';

    customers.forEach((customer) => {
      const option = document.createElement("option");
      option.value = customer.id;
      option.textContent =
        `${getCustomerName(customer)} — ${getVehicleNumber(customer)}`;
      elements.customer.appendChild(option);
    });

    if (selectedId !== "") {
      elements.customer.value = String(selectedId);
    }
  }

  function populatePolicies(customerId, selectedPolicyId = "") {
    elements.policy.innerHTML = '<option value="">Select policy</option>';

    const customer = getCustomerById(customerId);

    const customerPolicies = policies.filter((policy) => {
      if (String(policy.customerId) === String(customerId)) return true;

      // Compatibility with older records that only store a customer name.
      if (customer && !policy.customerId) {
        return policy.customerName === getCustomerName(customer);
      }

      return false;
    });

    customerPolicies.forEach((policy) => {
      const option = document.createElement("option");
      option.value = policy.id;
      option.textContent =
        `${policy.policyNumber || `Policy ${policy.id}`} — ${money(policy.premiumAmount)}`;
      option.dataset.premium = Number(policy.premiumAmount) || 0;
      elements.policy.appendChild(option);
    });

    elements.policyHelp.textContent = customerPolicies.length
      ? "Choose the policy related to this payment."
      : "No policy found for this customer. Add a policy first.";

    if (selectedPolicyId !== "") {
      elements.policy.value = String(selectedPolicyId);
    }
  }

  function openModal(payment = null) {
    refreshSourceData();
    elements.form.reset();
    elements.recordId.value = "";
    elements.date.value = localDate();
    elements.status.value = "Pending";
    elements.method.value = "UPI";

    populateCustomers();

    if (payment) {
      elements.modalTitle.textContent = "Edit Payment";
      elements.recordId.value = payment.id;
      elements.amount.value = Number(payment.amount || 0);
      elements.date.value = payment.date || localDate();
      elements.method.value = payment.method || "UPI";
      elements.status.value = payment.status || "Pending";
      elements.transaction.value = payment.transactionId || "";

      populateCustomers(payment.customerId);
      populatePolicies(payment.customerId, payment.policyId);
    } else {
      elements.modalTitle.textContent = "Add Payment";
      elements.policy.innerHTML = '<option value="">Select policy</option>';
      elements.policyHelp.textContent = "Choose a customer first.";
    }

    elements.modal.hidden = false;
    document.body.style.overflow = "hidden";
    elements.customer.focus();
  }

  function closeModal() {
    elements.modal.hidden = true;
    document.body.style.overflow = "";
  }

  function createPaymentId() {
    return `PAY${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
  }

  function savePayment(event) {
    event.preventDefault();

    refreshSourceData();

    const recordId = elements.recordId.value;
    const customerId = elements.customer.value;
    const policyId = elements.policy.value;
    const customer = getCustomerById(customerId);
    const policy = getPolicyById(policyId);
    const amount = Number(elements.amount.value);

    if (!customer) {
      showNotice("Please select a valid customer.");
      return;
    }

    if (!policy || String(policy.customerId) !== String(customerId)) {
      showNotice("Please select a policy belonging to this customer.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      showNotice("Enter a valid amount greater than zero.");
      return;
    }

    const transactionId = elements.transaction.value.trim();

    const duplicateTransaction = transactionId && payments.some((payment) =>
      payment.transactionId === transactionId &&
      String(payment.id) !== String(recordId)
    );

    if (duplicateTransaction) {
      showNotice("This reference ID is already in use.");
      return;
    }

    const existing = recordId
      ? payments.find((payment) => String(payment.id) === String(recordId))
      : null;

    const payment = {
      ...(existing || {}),
      id: existing ? existing.id : createPaymentId(),
      paymentNumber: existing?.paymentNumber ||
        `POP-${Date.now().toString().slice(-9)}`,
      customerId: customer.id,
      customerName: getCustomerName(customer),
      vehicleNumber: getVehicleNumber(customer),
      policyId: policy.id,
      policyNumber: policy.policyNumber || "",
      amount,
      premiumAmount: amount,
      method: elements.method.value,
      status: elements.status.value,
      date: elements.date.value,
      transactionId,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      demo: true
    };

    if (existing) {
      payments = payments.map((item) =>
        String(item.id) === String(recordId) ? payment : item
      );
    } else {
      payments.unshift(payment);
    }

    try {
      savePayments();
    } catch {
      showNotice("Could not save. Browser storage may be full.");
      return;
    }

    closeModal();
    currentPage = 1;
    renderAll();
    showNotice(existing
      ? "Payment record updated."
      : "Payment record saved in demo mode.");
  }

  function findPayment(id) {
    return payments.find((payment) => String(payment.id) === String(id));
  }

  function deletePayment(id) {
    const payment = findPayment(id);
    if (!payment) return;

    const confirmed = window.confirm(
      "Delete this payment record? This cannot be undone."
    );

    if (!confirmed) return;

    payments = payments.filter((item) => String(item.id) !== String(id));
    savePayments();
    renderAll();
    showNotice("Payment record deleted.");
  }

  function printReceipt(id) {
    const payment = findPayment(id);
    if (!payment) return;

    const customer = getPaymentCustomer(payment);
    const policy = getPaymentPolicy(payment);

    const receiptWindow = window.open("", "_blank", "width=750,height=750");

    if (!receiptWindow) {
      showNotice("Allow pop-ups in your browser to print the receipt.");
      return;
    }

    const receiptNumber = payment.paymentNumber ||
      payment.paymentId ||
      payment.id;

    const receiptHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Payment Receipt ${escapeHTML(receiptNumber)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #243247; padding: 30px; }
          .receipt { max-width: 650px; margin: auto; border: 1px solid #dce4ed; padding: 30px; }
          h1 { color: #142B4A; margin-bottom: 5px; }
          .brand { color: #0D9488; font-weight: bold; }
          .tag { display: inline-block; padding: 6px 12px; border-radius: 20px; background: #e5f5ed; }
          table { width: 100%; border-collapse: collapse; margin: 25px 0; }
          td { padding: 13px 8px; border-bottom: 1px solid #e1e7ef; }
          td:first-child { color: #718096; }
          .disclaimer { margin-top: 28px; padding: 12px; background: #f4f7fb; font-size: 12px; line-height: 1.5; }
          .print-btn { padding: 10px 18px; background: #0D9488; border: 0; color: white; border-radius: 6px; cursor: pointer; }
          @media print { .print-btn { display: none; } body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="brand">POPOYE INSURANCE</div>
          <h1>Payment Receipt</h1>
          <p>Receipt No: ${escapeHTML(receiptNumber)}</p>
          <p><strong>Status:</strong> <span class="tag">${escapeHTML(payment.status || "Pending")}</span></p>
          <table>
            <tr><td>Customer</td><td>${escapeHTML(getCustomerName(customer))}</td></tr>
            <tr><td>Vehicle number</td><td>${escapeHTML(getVehicleNumber(customer))}</td></tr>
            <tr><td>Policy number</td><td>${escapeHTML(policy.policyNumber || "—")}</td></tr>
            <tr><td>Payment date</td><td>${formatDate(payment.date)}</td></tr>
            <tr><td>Payment method</td><td>${escapeHTML(payment.method || "—")}</td></tr>
            <tr><td>Reference ID</td><td>${escapeHTML(payment.transactionId || "Not provided")}</td></tr>
            <tr><td><strong>Amount</strong></td><td><strong>${money(payment.amount)}</strong></td></tr>
          </table>
          <div class="disclaimer">
            DEMO RECEIPT — Generated from a browser-based payment record.
            It is not proof of a real bank transfer or gateway-confirmed payment.
          </div>
          <p style="margin-top:25px"><button class="print-btn" onclick="window.print()">Print Receipt</button></p>
        </div>
      </body>
      </html>
    `;

    receiptWindow.document.open();
    receiptWindow.document.write(receiptHTML);
    receiptWindow.document.close();
  }

  function exportCSV() {
    const rows = getFilteredPayments();

    if (!rows.length) {
      showNotice("There are no payment records to export.");
      return;
    }

    const headers = [
      "Payment ID",
      "Customer",
      "Vehicle Number",
      "Policy Number",
      "Amount",
      "Payment Method",
      "Payment Date",
      "Status",
      "Reference ID",
      "Demo Record"
    ];

    const csvCell = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csvRows = rows.map((payment) => {
      const customer = getPaymentCustomer(payment);
      const policy = getPaymentPolicy(payment);

      return [
        payment.paymentNumber || payment.paymentId || payment.id,
        getCustomerName(customer),
        getVehicleNumber(customer),
        policy.policyNumber || "",
        payment.amount,
        payment.method,
        payment.date,
        payment.status,
        payment.transactionId || "",
        "Yes"
      ];
    });

    const csv = "\uFEFF" + [
      headers,
      ...csvRows
    ].map((row) => row.map(csvCell).join(",")).join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `popoye-payments-${localDate()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showNotice("Payment CSV exported.");
  }

  // Page controls
  $("addPaymentBtn").addEventListener("click", () => openModal());
  $("closeModalBtn").addEventListener("click", closeModal);
  $("cancelBtn").addEventListener("click", closeModal);
  elements.form.addEventListener("submit", savePayment);

  elements.modal.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-modal]")) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.modal.hidden) closeModal();
  });

  elements.customer.addEventListener("change", () => {
    populatePolicies(elements.customer.value);
    elements.amount.value = "";
  });

  elements.policy.addEventListener("change", () => {
    const option = elements.policy.selectedOptions[0];

    if (option && option.dataset.premium) {
      elements.amount.value = option.dataset.premium;
    }
  });

  elements.search.addEventListener("input", () => {
    currentPage = 1;
    renderTable();
  });

  elements.statusFilter.addEventListener("change", () => {
    currentPage = 1;
    renderTable();
  });

  elements.methodFilter.addEventListener("change", () => {
    currentPage = 1;
    renderTable();
  });

  elements.prev.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  elements.next.addEventListener("click", () => {
    const totalPages = Math.max(
      1,
      Math.ceil(getFilteredPayments().length / PAGE_SIZE)
    );

    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });

  elements.table.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;
    const payment = findPayment(id);

    if (action === "delete") deletePayment(id);
    if (action === "receipt") printReceipt(id);
    if (action === "edit" && payment) openModal(payment);
  });

  $("exportBtn").addEventListener("click", exportCSV);

  $("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
  });

  $("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("popoyeLoggedIn");
    window.location.href = "login.html";
  });

  // Use the same theme preference as the other pages.
  function applyTheme() {
    const theme = localStorage.getItem("popoyeTheme");
    document.body.classList.toggle("dark-mode", theme === "dark");
  }

  window.addEventListener("storage", (event) => {
    if ([CUSTOMERS_KEY, POLICIES_KEY, PAYMENTS_KEY, "popoyeTheme"].includes(event.key)) {
      refreshSourceData();
      renderAll();
      applyTheme();
    }
  });

  applyTheme();
  renderAll();
})();
