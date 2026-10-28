
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // POPOYE INSURANCE - PAYMENTS MODULE
  // Frontend demo: LocalStorage only
  // ==========================================

  const CUSTOMERS_KEY = "popoyeCustomers";
  const POLICIES_KEY = "popoyePolicies";
  const PAYMENTS_KEY = "popoyePayments";
  const LOGIN_KEY = "popoyeLoggedIn";

  if (localStorage.getItem(LOGIN_KEY) !== "true") {
    window.location.href = "login.html";
    return;
  }

  const $ = (id) => document.getElementById(id);

  const elements = {
    formCard: $("paymentFormCard"),
    form: $("paymentForm"),
    formTitle: $("paymentFormTitle"),
    paymentId: $("paymentId"),
    customer: $("paymentCustomer"),
    policy: $("paymentPolicy"),
    amount: $("paymentAmount"),
    method: $("paymentMethod"),
    date: $("paymentDate"),
    status: $("paymentStatus"),
    transactionId: $("transactionId"),
    notes: $("paymentNotes"),
    tableBody: $("paymentsTableBody"),
    search: $("paymentSearch"),
    statusFilter: $("paymentStatusFilter"),
    methodFilter: $("paymentMethodFilter"),
    pageSize: $("paymentPageSize"),
    message: $("paymentMessage")
  };

  let currentPage = 1;
  let messageTimer;

  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.error("Unable to read " + key, error);
      return [];
    }
  }

  function getCustomers() {
    return readArray(CUSTOMERS_KEY);
  }

  function getPolicies() {
    return readArray(POLICIES_KEY);
  }

  function getPayments() {
    return readArray(PAYMENTS_KEY);
  }

  function savePayments(payments) {
    try {
      localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
      return true;
    } catch (error) {
      console.error("Unable to save payment records", error);
      showMessage("Unable to save. Browser storage may be full.", true);
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function money(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  function todayString() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function makeId() {
    return "PAY-" + Date.now().toString(36).toUpperCase() +
      "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function showMessage(message, isError = false) {
    clearTimeout(messageTimer);
    elements.message.textContent = message;
    elements.message.className = "payment-message" +
      (isError ? " message-error" : " message-success");

    messageTimer = setTimeout(() => {
      elements.message.textContent = "";
      elements.message.className = "payment-message";
    }, 4000);
  }

  function customerName(customerId) {
    const customer = getCustomers().find(
      (item) => String(item.id) === String(customerId)
    );
    return customer ? customer.name : "Unknown customer";
  }

  function getCustomerPolicies(customerId) {
    return getPolicies().filter(
      (policy) => String(policy.customerId) === String(customerId)
    );
  }

  function populateCustomers(selectedId = "") {
    const customers = getCustomers();

    elements.customer.innerHTML =
      '<option value="">Select customer</option>' +
      customers.map((customer) =>
        `<option value="${escapeHTML(customer.id)}">
          ${escapeHTML(customer.name)}${customer.vehicleNumber
            ? " — " + escapeHTML(customer.vehicleNumber) : ""}
        </option>`
      ).join("");

    if (selectedId !== "") {
      elements.customer.value = String(selectedId);
    }
  }

  function populatePolicies(customerId, selectedPolicyId = "") {
    const policies = customerId
      ? getCustomerPolicies(customerId)
      : [];

    elements.policy.innerHTML =
      '<option value="">Select policy (optional)</option>' +
      policies.map((policy) =>
        `<option value="${escapeHTML(policy.id)}">
          ${escapeHTML(policy.policyNumber || "Policy")} — 
          ${escapeHTML(policy.vehicleNumber || "")}
        </option>`
      ).join("");

    if (selectedPolicyId !== "") {
      elements.policy.value = String(selectedPolicyId);
    }
  }

  function statusClass(status) {
    if (status === "Paid") return "payment-status-paid";
    if (status === "Failed") return "payment-status-failed";
    return "payment-status-pending";
  }

  function updateSummary() {
    const payments = getPayments();
    const successful = payments.filter((item) => item.status === "Paid");
    const pending = payments.filter((item) => item.status === "Pending");
    const failed = payments.filter((item) => item.status === "Failed");

    $("totalCollected").textContent = money(
      successful.reduce((total, item) => total + Number(item.amount || 0), 0)
    );
    $("successfulPayments").textContent = successful.length;
    $("pendingPayments").textContent = pending.length;
    $("failedPayments").textContent = failed.length;
  }

  function getFilteredPayments() {
    const searchTerm = elements.search.value.trim().toLowerCase();
    const status = elements.statusFilter.value;
    const method = elements.methodFilter.value;

    return getPayments()
      .filter((payment) => {
        const searchable = [
          payment.id,
          payment.customerName,
          customerName(payment.customerId),
          payment.policyNumber,
          payment.transactionId,
          payment.method,
          payment.notes
        ].join(" ").toLowerCase();

        return (!searchTerm || searchable.includes(searchTerm)) &&
          (!status || payment.status === status) &&
          (!method || payment.method === method);
      })
      .sort((a, b) => {
        const dateComparison = String(b.date || "").localeCompare(
          String(a.date || "")
        );
        return dateComparison ||
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      });
  }

  function renderPayments() {
    const payments = getFilteredPayments();
    const pageSize = Number(elements.pageSize.value) || 10;
    const totalPages = Math.max(1, Math.ceil(payments.length / pageSize));

    currentPage = Math.min(currentPage, totalPages);

    const startIndex = (currentPage - 1) * pageSize;
    const pageItems = payments.slice(startIndex, startIndex + pageSize);

    if (pageItems.length === 0) {
      elements.tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="payment-empty">
            No payment records found. Record a payment to get started.
          </td>
        </tr>`;
    } else {
      elements.tableBody.innerHTML = pageItems.map((payment) => {
        const displayName = payment.customerName ||
          customerName(payment.customerId);
        const status = ["Paid", "Pending", "Failed"].includes(payment.status)
          ? payment.status
          : "Pending";

        return `
          <tr>
            <td class="payment-reference">${escapeHTML(payment.id)}</td>
            <td>${escapeHTML(displayName)}</td>
            <td>${escapeHTML(payment.policyNumber || "—")}</td>
            <td class="payment-amount">${money(payment.amount)}</td>
            <td>${escapeHTML(payment.method || "—")}</td>
            <td>${escapeHTML(payment.date || "—")}</td>
            <td>
              <span class="payment-status ${statusClass(status)}">
                ${escapeHTML(status)}
              </span>
            </td>
            <td>
              <div class="payment-actions">
                <button type="button" class="payment-action-btn"
                  data-action="edit" data-id="${escapeHTML(payment.id)}">
                  Edit
                </button>
                <button type="button"
                  class="payment-action-btn payment-action-delete"
                  data-action="delete" data-id="${escapeHTML(payment.id)}">
                  Delete
                </button>
              </div>
            </td>
          </tr>`;
      }).join("");
    }

    const firstRecord = payments.length ? startIndex + 1 : 0;
    const lastRecord = Math.min(startIndex + pageSize, payments.length);

    $("paymentPageInfo").textContent =
      `Showing ${firstRecord}–${lastRecord} of ${payments.length} records`;
    $("paymentPageNumber").textContent =
      `Page ${currentPage} of ${totalPages}`;
    $("paymentPrevPage").disabled = currentPage <= 1;
    $("paymentNextPage").disabled = currentPage >= totalPages;
  }

  function refresh() {
    updateSummary();
    renderPayments();
  }

  function openForm(payment = null) {
    elements.form.reset();
    elements.paymentId.value = "";
    elements.formTitle.textContent = payment ? "Edit Payment" : "Record a Payment";

    populateCustomers(payment?.customerId || "");
    populatePolicies(payment?.customerId || "", payment?.policyId || "");

    elements.amount.value = payment?.amount ?? "";
    elements.method.value = payment?.method || "";
    elements.date.value = payment?.date || todayString();
    elements.status.value = payment?.status || "Pending";
    elements.transactionId.value = payment?.transactionId || "";
    elements.notes.value = payment?.notes || "";
    elements.paymentId.value = payment?.id || "";

    elements.formCard.hidden = false;
    elements.formCard.scrollIntoView({ behavior: "smooth", block: "start" });
    elements.customer.focus();
  }

  function closeForm() {
    elements.form.reset();
    elements.paymentId.value = "";
    elements.formCard.hidden = true;
  }

  function savePayment(event) {
    event.preventDefault();

    const customerId = elements.customer.value;
    const customer = getCustomers().find(
      (item) => String(item.id) === String(customerId)
    );

    if (!customer) {
      showMessage("Please select a valid customer.", true);
      return;
    }

    const amount = Number(elements.amount.value);

    if (!Number.isFinite(amount) || amount <= 0) {
      showMessage("Enter an amount greater than zero.", true);
      elements.amount.focus();
      return;
    }

    const paymentId = elements.paymentId.value;
    const payments = getPayments();
    const existing = payments.find((item) => item.id === paymentId);
    const policyId = elements.policy.value;
    const policy = getPolicies().find(
      (item) => String(item.id) === String(policyId)
    );

    const record = {
      id: paymentId || makeId(),
      customerId: customer.id,
      customerName: customer.name,
      policyId: policy ? policy.id : "",
      policyNumber: policy ? policy.policyNumber || "" : "",
      vehicleNumber: policy
        ? policy.vehicleNumber || ""
        : customer.vehicleNumber || "",
      amount,
      method: elements.method.value,
      date: elements.date.value,
      status: elements.status.value,
      transactionId: elements.transactionId.value.trim(),
      notes: elements.notes.value.trim(),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!record.date) {
      showMessage("Please select a payment date.", true);
      elements.date.focus();
      return;
    }

    let updatedPayments;

    if (existing) {
      updatedPayments = payments.map((item) =>
        item.id === paymentId ? record : item
      );
    } else {
      updatedPayments = [record, ...payments];
    }

    if (!savePayments(updatedPayments)) return;

    closeForm();
    currentPage = 1;
    refresh();
    showMessage(existing ? "Payment updated." : "Payment recorded.");
  }

  function editPayment(id) {
    const payment = getPayments().find((item) => item.id === id);

    if (!payment) {
      showMessage("Payment record not found.", true);
      return;
    }

    openForm(payment);
  }

  function deletePayment(id) {
    const payment = getPayments().find((item) => item.id === id);
    if (!payment) return;

    const confirmed = window.confirm(
      `Delete payment ${payment.id}? This cannot be undone.`
    );

    if (!confirmed) return;

    const updatedPayments = getPayments().filter((item) => item.id !== id);

    if (!savePayments(updatedPayments)) return;

    refresh();
    showMessage("Payment record deleted.");
  }

  function exportCSV() {
    const payments = getFilteredPayments();

    if (!payments.length) {
      showMessage("There are no payment records to export.", true);
      return;
    }

    const headers = [
      "Reference ID",
      "Customer",
      "Policy Number",
      "Vehicle Number",
      "Amount",
      "Method",
      "Date",
      "Status",
      "Transaction ID",
      "Notes"
    ];

    const rows = payments.map((payment) => [
      payment.id,
      payment.customerName || customerName(payment.customerId),
      payment.policyNumber || "",
      payment.vehicleNumber || "",
      payment.amount,
      payment.method,
      payment.date,
      payment.status,
      payment.transactionId || "",
      payment.notes || ""
    ]);

    const csvValue = (value) =>
      '"' + String(value ?? "").replace(/"/g, '""') + '"';

    const csv = [headers, ...rows]
      .map((row) => row.map(csvValue).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "popoye-insurance-payments.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showMessage("Payment records exported.");
  }

  // Open and close the payment form.
  $("showPaymentForm").addEventListener("click", () => openForm());
  $("cancelPaymentForm").addEventListener("click", closeForm);
  $("resetPaymentForm").addEventListener("click", () => {
    const editingId = elements.paymentId.value;
    if (editingId) {
      const payment = getPayments().find((item) => item.id === editingId);
      openForm(payment || null);
    } else {
      elements.form.reset();
      elements.date.value = todayString();
      elements.status.value = "Pending";
      populateCustomers();
      populatePolicies("");
    }
  });

  elements.form.addEventListener("submit", savePayment);

  elements.customer.addEventListener("change", () => {
    populatePolicies(elements.customer.value);
  });

  // Table actions.
  elements.tableBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const id = button.dataset.id;

    if (button.dataset.action === "edit") {
      editPayment(id);
    } else if (button.dataset.action === "delete") {
      deletePayment(id);
    }
  });

  // Search, filters and pagination.
  elements.search.addEventListener("input", () => {
    currentPage = 1;
    renderPayments();
  });

  elements.statusFilter.addEventListener("change", () => {
    currentPage = 1;
    renderPayments();
  });

  elements.methodFilter.addEventListener("change", () => {
    currentPage = 1;
    renderPayments();
  });

  elements.pageSize.addEventListener("change", () => {
    currentPage = 1;
    renderPayments();
  });

  $("paymentPrevPage").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderPayments();
    }
  });

  $("paymentNextPage").addEventListener("click", () => {
    const totalPages = Math.max(
      1,
      Math.ceil(getFilteredPayments().length / Number(elements.pageSize.value))
    );

    if (currentPage < totalPages) {
      currentPage++;
      renderPayments();
    }
  });

  $("exportPayments").addEventListener("click", exportCSV);

  // Sidebar and logout.
  $("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("sidebar-open");
  });

  $("logoutBtn").addEventListener("click", () => {
    if (window.confirm("Are you sure you want to log out?")) {
      localStorage.removeItem(LOGIN_KEY);
      window.location.href = "login.html";
    }
  });

  // Initial setup.
  elements.date.value = todayString();
  populateCustomers();
  populatePolicies("");
  refresh();
});
