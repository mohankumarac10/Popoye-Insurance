
"use strict";

(() => {
  const POLICIES_KEY = "popoyePolicies";
  const CUSTOMERS_KEY = "popoyeCustomers";
  const CONTACTED_KEY = "popoyeRemindersContacted";
  const PAGE_SIZE = 5;

  if (sessionStorage.getItem("popoyeLoggedIn") !== "true") {
    window.location.href = "login.html";
    return;
  }

  const $ = id => document.getElementById(id);

  const ui = {
    table: $("remindersTableBody"),
    search: $("searchInput"),
    status: $("statusFilter"),
    message: $("messageFilter"),
    empty: $("emptyState"),
    info: $("paginationInfo"),
    pageNumbers: $("pageNumbers"),
    prev: $("prevPage"),
    next: $("nextPage"),
    notice: $("notice")
  };

  let customers = [];
  let policies = [];
  let currentPage = 1;
  let noticeTimer;

  function readArray(key) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function readContacted() {
    try {
      const data = JSON.parse(localStorage.getItem(CONTACTED_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveContacted(records) {
    localStorage.setItem(CONTACTED_KEY, JSON.stringify(records));
  }

  function refreshData() {
    customers = readArray(CUSTOMERS_KEY);
    policies = readArray(POLICIES_KEY);
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

  function customerPhone(customer) {
    return customer?.phone ||
      customer?.phoneNumber ||
      customer?.mobile ||
      customer?.mobileNumber ||
      customer?.contactNumber ||
      "";
  }

  function customerFor(policy) {
    return customers.find(customer =>
      String(customer.id) === String(policy.customerId)
    ) || {
      name: policy.customerName || "Unknown Customer",
      vehicleNumber: policy.vehicleNumber || "",
      phone: policy.phone || policy.phoneNumber || ""
    };
  }

  function localToday() {
    const date = new Date();
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 10);
  }

  function parseDate(value) {
    const text = String(value || "").slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return null;
    }

    const [year, month, day] = text.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return date;
  }

  function formatDate(value) {
    const date = parseDate(value);
    if (!date) return "Date unavailable";

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    }).format(date);
  }

  function daysUntil(expiryDate) {
    const expiry = parseDate(expiryDate);
    const today = parseDate(localToday());

    if (!expiry || !today) return null;

    return Math.round((expiry.getTime() - today.getTime()) / 86400000);
  }

  function getExpiryStatus(policy) {
    const days = daysUntil(policy.expiryDate);

    if (days === null) {
      return { key: "unknown", label: "Date unavailable", days: null };
    }

    if (days < 0) {
      return { key: "overdue", label: "Expired", days };
    }

    if (days <= 7) {
      return { key: "week", label: days === 0 ? "Expires today" : "Urgent", days };
    }

    if (days <= 30) {
      return { key: "month", label: "Expiring soon", days };
    }

    return { key: "future", label: "Upcoming", days };
  }

  function policyKey(policy) {
    return String(policy.id || policy.policyNumber || "");
  }

  function isContacted(policy) {
    return readContacted().includes(policyKey(policy));
  }

  function statusClass(status) {
    return {
      overdue: "status-overdue",
      week: "status-week",
      month: "status-month",
      future: "status-future",
      unknown: "status-unknown"
    }[status] || "status-unknown";
  }

  function showNotice(message) {
    ui.notice.textContent = message;
    ui.notice.classList.add("show");

    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      ui.notice.classList.remove("show");
    }, 3000);
  }

  function renderStats() {
    const statuses = policies.map(getExpiryStatus);

    $("overdueCount").textContent =
      statuses.filter(s => s.key === "overdue").length;

    $("weekCount").textContent =
      statuses.filter(s => s.days !== null && s.days >= 0 && s.days <= 7).length;

    $("monthCount").textContent =
      statuses.filter(s => s.days !== null && s.days >= 0 && s.days <= 30).length;

    $("futureCount").textContent =
      statuses.filter(s => s.days !== null && s.days > 30).length;
  }

  function filteredPolicies() {
    const query = ui.search.value.trim().toLowerCase();
    const statusFilter = ui.status.value;
    const messageFilter = ui.message.value;

    return policies
      .filter(policy => {
        const customer = customerFor(policy);
        const status = getExpiryStatus(policy);
        const contacted = isContacted(policy);

        const searchable = [
          customerName(customer),
          vehicleNumber(customer),
          customerPhone(customer),
          policy.policyNumber,
          policy.insuranceType
        ].join(" ").toLowerCase();

        const matchesSearch = !query || searchable.includes(query);
        const matchesStatus = !statusFilter || status.key === statusFilter;
        const matchesContacted =
          !messageFilter ||
          (messageFilter === "sent" && contacted) ||
          (messageFilter === "notSent" && !contacted);

        return matchesSearch && matchesStatus && matchesContacted;
      })
      .sort((a, b) => {
        const aDays = daysUntil(a.expiryDate);
        const bDays = daysUntil(b.expiryDate);

        if (aDays === null) return 1;
        if (bDays === null) return -1;
        return aDays - bDays;
      });
  }

  function daysLabel(days) {
    if (days === null) return "—";
    if (days < 0) return `${Math.abs(days)} day(s) overdue`;
    if (days === 0) return "Today";
    return `${days} day(s)`;
  }

  function renderTable() {
    const list = filteredPolicies();
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));

    currentPage = Math.min(Math.max(currentPage, 1), totalPages);

    const start = (currentPage - 1) * PAGE_SIZE;
    const visible = list.slice(start, start + PAGE_SIZE);

    ui.table.innerHTML = visible.map(policy => {
      const customer = customerFor(policy);
      const status = getExpiryStatus(policy);
      const contacted = isContacted(policy);
      const key = policyKey(policy);

      return `
        <tr>
          <td>
            <span class="customer-name">${escapeHTML(customerName(customer))}</span>
            <span class="sub-text">${escapeHTML(customerPhone(customer) || "Phone unavailable")}</span>
          </td>
          <td>${escapeHTML(vehicleNumber(customer))}</td>
          <td>${escapeHTML(policy.policyNumber || "—")}</td>
          <td>${money(policy.premiumAmount)}</td>
          <td>${formatDate(policy.expiryDate)}</td>
          <td>${escapeHTML(daysLabel(status.days))}</td>
          <td>
            <span class="expiry-status ${statusClass(status.key)}">
              ${escapeHTML(status.label)}
            </span>
            ${contacted ? '<span class="sub-text">Marked contacted</span>' : ""}
          </td>
          <td>
            <div class="action-buttons">
              <button class="action-btn whatsapp" type="button"
                data-action="whatsapp" data-id="${escapeHTML(key)}">
                WhatsApp
              </button>
              <button class="action-btn ${contacted ? "contacted" : ""}" type="button"
                data-action="toggle" data-id="${escapeHTML(key)}">
                ${contacted ? "Unmark" : "Contacted"}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    ui.empty.hidden = list.length > 0;

    $("listSubtitle").textContent =
      `${list.length} policy record(s), ordered by nearest expiry date.`;

    ui.info.textContent = list.length
      ? `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, list.length)} of ${list.length}`
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

  function renderAll() {
    renderStats();
    renderTable();
  }

  function buildWhatsAppMessage(policy, customer) {
    const expiry = formatDate(policy.expiryDate);
    const premium = money(policy.premiumAmount);

    return `Hello ${customerName(customer)}, this is Popoye Insurance.

Your two-wheeler insurance renewal reminder:
Vehicle Number: ${vehicleNumber(customer)}
Policy Number: ${policy.policyNumber || "Not available"}
Premium Amount: ${premium}
Policy Expiry Date: ${expiry}

Please contact us to confirm your renewal details and payment options.

Thank you,
Popoye Insurance`;
  }

  function openWhatsApp(policy) {
    const customer = customerFor(policy);
    const phone = customerPhone(customer).replace(/\D/g, "");

    if (!phone) {
      showNotice("No phone number found. Add one in the Customers page first.");
      return;
    }

    // India phone numbers are commonly stored as 10 digits or with country code 91.
    let internationalPhone = phone;

    if (internationalPhone.length === 10) {
      internationalPhone = "91" + internationalPhone;
    } else if (
      internationalPhone.length === 11 &&
      internationalPhone.startsWith("0")
    ) {
      internationalPhone = "91" + internationalPhone.slice(1);
    }

    if (internationalPhone.length < 11 || internationalPhone.length > 15) {
      showNotice("Check the customer's phone number and country code.");
      return;
    }

    const message = buildWhatsAppMessage(policy, customer);
    const url = `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank", "noopener,noreferrer");
    showNotice("WhatsApp opened with a draft. Review and send it manually.");
  }

  function toggleContacted(id) {
    const records = readContacted();
    const key = String(id);
    const exists = records.includes(key);

    const updated = exists
      ? records.filter(item => item !== key)
      : [...records, key];

    try {
      saveContacted(updated);
      renderTable();
      showNotice(exists
        ? "Contacted marker removed."
        : "Marked as contacted. No message was sent automatically.");
    } catch {
      showNotice("Could not save the contacted marker.");
    }
  }

  function exportCSV() {
    const list = filteredPolicies();

    if (!list.length) {
      showNotice("No renewal records available to export.");
      return;
    }

    const headers = [
      "Customer",
      "Phone",
      "Vehicle Number",
      "Policy Number",
      "Insurance Type",
      "Premium Amount",
      "Expiry Date",
      "Days Until Expiry",
      "Renewal Status",
      "Marked Contacted"
    ];

    const cell = value =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const rows = list.map(policy => {
      const customer = customerFor(policy);
      const status = getExpiryStatus(policy);

      return [
        customerName(customer),
        customerPhone(customer),
        vehicleNumber(customer),
        policy.policyNumber || "",
        policy.insuranceType || "",
        policy.premiumAmount || 0,
        policy.expiryDate || "",
        status.days === null ? "" : status.days,
        status.label,
        isContacted(policy) ? "Yes" : "No"
      ];
    });

    const csv = "\uFEFF" + [headers, ...rows]
      .map(row => row.map(cell).join(","))
      .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `popoye-renewal-reminders-${localToday()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showNotice("Renewal report exported.");
  }

  ui.search.addEventListener("input", () => {
    currentPage = 1;
    renderTable();
  });

  ui.status.addEventListener("change", () => {
    currentPage = 1;
    renderTable();
  });

  ui.message.addEventListener("change", () => {
    currentPage = 1;
    renderTable();
  });

  ui.prev.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  ui.next.addEventListener("click", () => {
    const totalPages = Math.max(
      1,
      Math.ceil(filteredPolicies().length / PAGE_SIZE)
    );

    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });

  ui.table.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    const policy = policies.find(item => policyKey(item) === id);

    if (!policy) {
      showNotice("Policy record not found. Refresh the page.");
      return;
    }

    if (button.dataset.action === "whatsapp") {
      openWhatsApp(policy);
    }

    if (button.dataset.action === "toggle") {
      toggleContacted(id);
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
    if (
      event.key === POLICIES_KEY ||
      event.key === CUSTOMERS_KEY ||
      event.key === CONTACTED_KEY ||
      event.key === "popoyeTheme"
    ) {
      refreshData();
      applyTheme();
      renderAll();
    }
  });

  refreshData();
  applyTheme();
  renderAll();
})();
