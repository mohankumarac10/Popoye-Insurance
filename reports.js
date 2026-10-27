
"use strict";

(() => {
  const PAGE_SIZE = 5;
  const KEYS = {
    customers: "popoyeCustomers",
    policies: "popoyePolicies",
    payments: "popoyePayments"
  };

  if (sessionStorage.getItem("popoyeLoggedIn") !== "true") {
    window.location.href = "login.html";
    return;
  }

  const $ = (id) => document.getElementById(id);

  const ui = {
    preset: $("datePreset"),
    customFields: $("customDateFields"),
    start: $("startDate"),
    end: $("endDate"),
    status: $("statusFilter"),
    search: $("searchInput"),
    error: $("filterError"),
    table: $("reportTableBody"),
    empty: $("emptyState"),
    subtitle: $("reportSubtitle"),
    collected: $("collectedTotal"),
    pending: $("pendingTotal"),
    paidCount: $("paidCount"),
    failedCount: $("failedCount"),
    statusDonut: $("statusDonut"),
    statusTotal: $("statusTotal"),
    legendPaid: $("legendPaid"),
    legendPending: $("legendPending"),
    legendFailed: $("legendFailed"),
    customerCount: $("customerCount"),
    policyCount: $("policyCount"),
    allPaymentCount: $("allPaymentCount"),
    filteredPaymentCount: $("filteredPaymentCount"),
    paginationInfo: $("paginationInfo"),
    pageNumbers: $("pageNumbers"),
    prev: $("prevPage"),
    next: $("nextPage")
  };

  let customers = [];
  let policies = [];
  let payments = [];
  let filteredPayments = [];
  let currentPage = 1;
  let activeRange = { start: "", end: "" };

  function loadArray(key) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function refreshData() {
    customers = loadArray(KEYS.customers);
    policies = loadArray(KEYS.policies);
    payments = loadArray(KEYS.payments);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
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

  function localDate(date = new Date()) {
    const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return adjusted.toISOString().slice(0, 10);
  }

  function customerName(customer) {
    return customer?.name ||
      customer?.customerName ||
      customer?.fullName ||
      "Unknown Customer";
  }

  function vehicleNumber(customer) {
    return customer?.vehicleNumber ||
      customer?.vehicleNo ||
      customer?.registrationNumber ||
      "—";
  }

  function customerFor(payment) {
    return customers.find(c =>
      String(c.id) === String(payment.customerId)
    ) || {
      name: payment.customerName || "Unknown Customer",
      vehicleNumber: payment.vehicleNumber || "—"
    };
  }

  function policyFor(payment) {
    return policies.find(p =>
      String(p.id) === String(payment.policyId) ||
      String(p.policyNumber) === String(payment.policyNumber)
    ) || {};
  }

  function paymentId(payment) {
    return payment.paymentNumber ||
      payment.paymentId ||
      payment.id ||
      "—";
  }

  function dateInRange(value, start, end) {
    if (!value) return false;
    const date = String(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  }

  function getRange() {
    const today = localDate();
    const preset = ui.preset.value;

    if (preset === "today") {
      return { start: today, end: today };
    }

    if (preset === "7" || preset === "30") {
      const days = Number(preset) - 1;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      return { start: localDate(startDate), end: today };
    }

    if (preset === "month") {
      return {
        start: `${today.slice(0, 7)}-01`,
        end: today
      };
    }

    if (preset === "custom") {
      return { start: ui.start.value, end: ui.end.value };
    }

    return { start: "", end: "" };
  }

  function applyFilters() {
    const range = getRange();

    if (range.start && range.end && range.start > range.end) {
      ui.error.textContent = "The start date must be on or before the end date.";
      ui.error.hidden = false;
      return;
    }

    ui.error.hidden = true;
    activeRange = range;
    currentPage = 1;
    renderReport();
  }

  function getFilteredPayments() {
    const query = ui.search.value.trim().toLowerCase();

    return payments.filter(payment => {
      const customer = customerFor(payment);
      const policy = policyFor(payment);
      const date = String(payment.date || "").slice(0, 10);

      // If a range is active, only include records with a valid date in range.
      const matchesDate = (!activeRange.start && !activeRange.end) ||
        dateInRange(date, activeRange.start, activeRange.end);

      const matchesStatus = !ui.status.value ||
        payment.status === ui.status.value;

      const searchable = [
        paymentId(payment),
        customerName(customer),
        vehicleNumber(customer),
        payment.transactionId,
        payment.referenceId,
        policy.policyNumber,
        payment.method
      ].join(" ").toLowerCase();

      return matchesDate && matchesStatus &&
        (!query || searchable.includes(query));
    }).sort((a, b) =>
      String(b.date || "").localeCompare(String(a.date || ""))
    );
  }

  function statusClass(status) {
    if (status === "Paid") return "status-paid";
    if (status === "Failed") return "status-failed";
    return "status-pending";
  }

  function renderSummary() {
    const paid = filteredPayments.filter(p => p.status === "Paid");
    const pending = filteredPayments.filter(p => p.status === "Pending");
    const failed = filteredPayments.filter(p => p.status === "Failed");

    const paidAmount = paid.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const pendingAmount = pending.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    ui.collected.textContent = money(paidAmount);
    ui.pending.textContent = money(pendingAmount);
    ui.paidCount.textContent = paid.length;
    ui.failedCount.textContent = failed.length;

    ui.statusTotal.textContent = filteredPayments.length;
    ui.legendPaid.textContent = paid.length;
    ui.legendPending.textContent = pending.length;
    ui.legendFailed.textContent = failed.length;

    const total = filteredPayments.length;
    const paidPercent = total ? paid.length / total * 100 : 0;
    const pendingPercent = total ? pending.length / total * 100 : 0;
    const failedPercent = total ? failed.length / total * 100 : 0;

    const paidEnd = paidPercent;
    const pendingEnd = paidEnd + pendingPercent;
    const failedEnd = pendingEnd + failedPercent;

    ui.statusDonut.style.background = total
      ? `conic-gradient(
          var(--paid) 0% ${paidEnd}%,
          var(--pending) ${paidEnd}% ${pendingEnd}%,
          var(--failed) ${pendingEnd}% ${failedEnd}%,
          var(--border) ${failedEnd}% 100%
        )`
      : "conic-gradient(var(--border) 0% 100%)";

    ui.customerCount.textContent = customers.length;
    ui.policyCount.textContent = policies.length;
    ui.allPaymentCount.textContent = payments.length;
    ui.filteredPaymentCount.textContent = filteredPayments.length;

    if (activeRange.start || activeRange.end) {
      ui.subtitle.textContent =
        `Payment entries from ${activeRange.start || "the beginning"} to ${activeRange.end || "today"}.`;
    } else {
      ui.subtitle.textContent = "All recorded payment entries.";
    }
  }

  function renderTable() {
    const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);

    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const rows = filteredPayments.slice(startIndex, startIndex + PAGE_SIZE);

    ui.table.innerHTML = rows.map(payment => {
      const customer = customerFor(payment);
      const method = payment.method || "Other";
      const status = payment.status || "Pending";

      return `
        <tr>
          <td>
            <span class="customer-name">${escapeHTML(paymentId(payment))}</span>
            <span class="sub-text">${escapeHTML(payment.transactionId || "No reference ID")}</span>
          </td>
          <td>${escapeHTML(customerName(customer))}</td>
          <td>${escapeHTML(vehicleNumber(customer))}</td>
          <td>${escapeHTML(payment.date || "—")}</td>
          <td>${escapeHTML(method)}</td>
          <td><strong>${money(payment.amount)}</strong></td>
          <td><span class="status ${statusClass(status)}">${escapeHTML(status)}</span></td>
        </tr>
      `;
    }).join("");

    ui.empty.hidden = filteredPayments.length > 0;

    ui.paginationInfo.textContent = filteredPayments.length
      ? `Showing ${startIndex + 1}–${Math.min(startIndex + PAGE_SIZE, filteredPayments.length)} of ${filteredPayments.length}`
      : "Showing 0 of 0";

    ui.prev.disabled = currentPage === 1;
    ui.next.disabled = currentPage === totalPages;

    ui.pageNumbers.innerHTML = "";

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

      ui.pageNumbers.appendChild(button);
    }
  }

  function renderReport() {
    filteredPayments = getFilteredPayments();
    renderSummary();
    renderTable();
  }

  function exportCSV() {
    if (!filteredPayments.length) {
      alert("No report records are available to export.");
      return;
    }

    const headers = [
      "Payment ID",
      "Customer",
      "Vehicle Number",
      "Policy Number",
      "Payment Date",
      "Payment Method",
      "Amount",
      "Status",
      "Reference ID",
      "Demo Record"
    ];

    const csvCell = value =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const rows = filteredPayments.map(payment => {
      const customer = customerFor(payment);
      const policy = policyFor(payment);

      return [
        paymentId(payment),
        customerName(customer),
        vehicleNumber(customer),
        policy.policyNumber || payment.policyNumber || "",
        payment.date || "",
        payment.method || "",
        payment.amount || 0,
        payment.status || "Pending",
        payment.transactionId || "",
        "Yes"
      ];
    });

    const csv = "\uFEFF" + [headers, ...rows]
      .map(row => row.map(csvCell).join(","))
      .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `popoye-report-${localDate()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  ui.preset.addEventListener("change", () => {
    ui.customFields.hidden = ui.preset.value !== "custom";
  });

  $("applyFilters").addEventListener("click", applyFilters);

  $("resetFilters").addEventListener("click", () => {
    ui.preset.value = "all";
    ui.start.value = "";
    ui.end.value = "";
    ui.status.value = "";
    ui.search.value = "";
    ui.customFields.hidden = true;
    ui.error.hidden = true;
    activeRange = { start: "", end: "" };
    currentPage = 1;
    renderReport();
  });

  ui.search.addEventListener("input", () => {
    currentPage = 1;
    renderReport();
  });

  ui.status.addEventListener("change", () => {
    currentPage = 1;
    renderReport();
  });

  ui.prev.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  ui.next.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));

    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });

  $("exportBtn").addEventListener("click", exportCSV);

  $("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
  });

  $("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("popoyeLoggedIn");
    window.location.href = "login.html";
  });

  function applyTheme() {
    document.body.classList.toggle(
      "dark-mode",
      localStorage.getItem("popoyeTheme") === "dark"
    );
  }

  window.addEventListener("storage", event => {
    if (Object.values(KEYS).includes(event.key) || event.key === "popoyeTheme") {
      refreshData();
      applyTheme();
      renderReport();
    }
  });

  refreshData();
  applyTheme();
  renderReport();
})();
