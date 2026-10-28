
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // POPOYE INSURANCE - REMINDERS MODULE
  // WhatsApp actions are prepared-message demos
  // ==========================================

  const CUSTOMERS_KEY = "popoyeCustomers";
  const POLICIES_KEY = "popoyePolicies";
  const REMINDERS_KEY = "popoyeReminders";
  const LOGIN_KEY = "popoyeLoggedIn";

  if (localStorage.getItem(LOGIN_KEY) !== "true") {
    window.location.href = "login.html";
    return;
  }

  const $ = (id) => document.getElementById(id);

  let currentPage = 1;
  let reminderRows = [];
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

  function saveReminders(data) {
    try {
      localStorage.setItem(REMINDERS_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error("Unable to save reminders", error);
      showMessage("Unable to save reminder status. Check browser storage.", true);
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

  function localDateString(date = new Date()) {
    const local = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000
    );
    return local.toISOString().slice(0, 10);
  }

  function daysUntil(dateString) {
    if (!dateString) return null;

    const today = new Date(localDateString() + "T00:00:00");
    const expiry = new Date(String(dateString).slice(0, 10) + "T00:00:00");

    if (Number.isNaN(expiry.getTime())) return null;

    return Math.round((expiry - today) / (1000 * 60 * 60 * 24));
  }

  function showMessage(message, isError = false) {
    clearTimeout(messageTimer);
    $("reminderMessage").textContent = message;
    $("reminderMessage").style.color = isError ? "#b91c1c" : "";

    messageTimer = setTimeout(() => {
      $("reminderMessage").textContent = "";
      $("reminderMessage").style.color = "";
    }, 4000);
  }

  function getReminderMap() {
    return new Map(
      readArray(REMINDERS_KEY).map((item) => [
        String(item.policyId),
        item
      ])
    );
  }

  function buildRows() {
    const customers = readArray(CUSTOMERS_KEY);
    const policies = readArray(POLICIES_KEY);
    const reminderMap = getReminderMap();

    reminderRows = policies
      .filter((policy) => policy.expiryDate)
      .map((policy) => {
        const customer = customers.find(
          (item) => String(item.id) === String(policy.customerId)
        );

        const saved = reminderMap.get(String(policy.id)) || {};

        return {
          policyId: String(policy.id),
          customerId: customer ? String(customer.id) : "",
          customerName: customer?.name || policy.customerName || "Unknown customer",
          phone: customer?.phone || "",
          vehicleNumber: policy.vehicleNumber ||
            customer?.vehicleNumber || "",
          policyNumber: policy.policyNumber || "",
          expiryDate: String(policy.expiryDate).slice(0, 10),
          premium: Number(policy.premium) || 0,
          daysLeft: daysUntil(policy.expiryDate),
          status: saved.status || "Pending",
          lastContacted: saved.lastContacted || "",
          notes: saved.notes || ""
        };
      })
      .filter((row) => row.daysLeft !== null)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }

  function getFilteredRows() {
    const search = $("reminderSearch").value.trim().toLowerCase();
    const period = $("reminderDays").value;
    const status = $("reminderStatusFilter").value;

    return reminderRows.filter((row) => {
      const searchable = [
        row.customerName,
        row.phone,
        row.vehicleNumber,
        row.policyNumber
      ].join(" ").toLowerCase();

      const withinPeriod = period === "all" ||
        (row.daysLeft <= Number(period));

      return searchable.includes(search) &&
        withinPeriod &&
        (!status || row.status === status);
    });
  }

  function updateStats() {
    const allRows = reminderRows;

    $("dueSoonCount").textContent = allRows.filter(
      (row) => row.daysLeft >= 0 && row.daysLeft <= 30
    ).length;

    $("expiredCount").textContent = allRows.filter(
      (row) => row.daysLeft < 0
    ).length;

    $("contactedCount").textContent = allRows.filter(
      (row) => row.status === "Contacted"
    ).length;

    $("followupCount").textContent = allRows.filter(
      (row) => row.status === "Pending" && row.daysLeft <= 30
    ).length;
  }

  function statusClass(status) {
    if (status === "Contacted") return "reminder-status-contacted";
    if (status === "Renewed") return "reminder-status-renewed";
    return "reminder-status-pending";
  }

  function renderTable() {
    const rows = getFilteredRows();
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

    currentPage = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);

    if (!pageRows.length) {
      $("remindersTableBody").innerHTML = `
        <tr>
          <td colspan="8" class="reminder-empty">
            No policies match your filters. Check your saved policies or select
            a wider expiry period.
          </td>
        </tr>`;
    } else {
      $("remindersTableBody").innerHTML = pageRows.map((row) => {
        const dayClass = row.daysLeft < 0
          ? "reminder-days-overdue"
          : row.daysLeft <= 7
            ? "reminder-days-soon"
            : "reminder-days-normal";

        const dayText = row.daysLeft < 0
          ? `${Math.abs(row.daysLeft)} days overdue`
          : row.daysLeft === 0
            ? "Expires today"
            : `${row.daysLeft} days`;

        return `
          <tr>
            <td>${escapeHTML(row.customerName)}</td>
            <td>${escapeHTML(row.phone || "—")}</td>
            <td>${escapeHTML(row.vehicleNumber || "—")}</td>
            <td>${escapeHTML(row.policyNumber || "—")}</td>
            <td>${escapeHTML(row.expiryDate)}</td>
            <td class="reminder-days ${dayClass}">
              ${escapeHTML(dayText)}
            </td>
            <td>
              <span class="reminder-status ${statusClass(row.status)}">
                ${escapeHTML(row.status)}
              </span>
            </td>
            <td>
              <div class="reminder-actions">
                <button type="button" class="reminder-action-btn"
                  data-action="whatsapp" data-id="${escapeHTML(row.policyId)}">
                  WhatsApp
                </button>
                <button type="button" class="reminder-action-btn"
                  data-action="status" data-id="${escapeHTML(row.policyId)}">
                  Update
                </button>
              </div>
            </td>
          </tr>`;
      }).join("");
    }

    $("reminderPageInfo").textContent =
      `Showing ${rows.length ? start + 1 : 0}–${Math.min(start + pageSize, rows.length)} of ${rows.length} records`;

    $("reminderPageNumber").textContent =
      `Page ${currentPage} of ${totalPages}`;

    $("reminderPrevPage").disabled = currentPage <= 1;
    $("reminderNextPage").disabled = currentPage >= totalPages;
  }

  function refresh() {
    buildRows();
    updateStats();
    renderTable();
  }

  function updateReminderStatus(policyId, status) {
    const reminders = readArray(REMINDERS_KEY);
    const existing = reminders.find(
      (item) => String(item.policyId) === String(policyId)
    );

    const updated = {
      ...(existing || {}),
      policyId: String(policyId),
      status,
      lastContacted: status === "Contacted"
        ? new Date().toISOString()
        : existing?.lastContacted || "",
      updatedAt: new Date().toISOString()
    };

    const next = reminders.filter(
      (item) => String(item.policyId) !== String(policyId)
    );

    next.push(updated);

    if (!saveReminders(next)) return false;

    refresh();
    return true;
  }

  function prepareWhatsApp(policyId) {
    const row = reminderRows.find(
      (item) => String(item.policyId) === String(policyId)
    );

    if (!row) {
      showMessage("Policy reminder could not be found.", true);
      return;
    }

    const digits = String(row.phone).replace(/\D/g, "");

    if (!digits) {
      showMessage("This customer does not have a phone number saved.", true);
      return;
    }

    // WhatsApp numbers should include the country code.
    // For Indian mobile numbers, add 91 when a 10-digit number is stored.
    const phone = digits.length === 10 ? "91" + digits : digits;

    const expiryText = new Date(
      row.expiryDate + "T00:00:00"
    ).toLocaleDateString("en-IN");

    const message =
      `Hello ${row.customerName}, this is Popoye Insurance. ` +
      `Your two-wheeler insurance policy ${row.policyNumber || ""} ` +
      `for vehicle ${row.vehicleNumber || ""} expires on ${expiryText}. ` +
      `Please contact us to renew your policy. ` +
      `This is a renewal reminder; please verify the details before sending.`;

    const url = "https://wa.me/" + phone +
      "?text=" + encodeURIComponent(message);

    // Opens WhatsApp with a prepared message. The user must review and send it.
    window.open(url, "_blank", "noopener,noreferrer");

    const shouldMark = window.confirm(
      "WhatsApp has been opened with a prepared message. Mark this reminder as Contacted?"
    );

    if (shouldMark) {
      if (updateReminderStatus(policyId, "Contacted")) {
        showMessage("Reminder marked as contacted.");
      }
    }
  }

  function updateStatusManually(policyId) {
    const row = reminderRows.find(
      (item) => String(item.policyId) === String(policyId)
    );

    if (!row) return;

    const choice = window.prompt(
      "Enter reminder status:\n1 = Pending\n2 = Contacted\n3 = Renewed",
      row.status === "Pending" ? "2" : row.status === "Contacted" ? "3" : "1"
    );

    if (choice === null) return;

    const statuses = {
      "1": "Pending",
      "2": "Contacted",
      "3": "Renewed"
    };

    const status = statuses[choice.trim()];

    if (!status) {
      showMessage("Enter 1, 2 or 3 to select a status.", true);
      return;
    }

    if (updateReminderStatus(policyId, status)) {
      showMessage("Reminder status updated.");
    }
  }

  function exportCSV() {
    const rows = getFilteredRows();

    if (!rows.length) {
      showMessage("There are no reminders to export.", true);
      return;
    }

    const headers = [
      "Customer",
      "Phone",
      "Vehicle Number",
      "Policy Number",
      "Expiry Date",
      "Days Left",
      "Premium",
      "Reminder Status"
    ];

    const data = rows.map((row) => [
      row.customerName,
      row.phone,
      row.vehicleNumber,
      row.policyNumber,
      row.expiryDate,
      row.daysLeft,
      row.premium,
      row.status
    ]);

    const csvValue = (value) =>
      '"' + String(value ?? "").replace(/"/g, '""') + '"';

    const csv = [headers, ...data]
      .map((line) => line.map(csvValue).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "popoye-renewal-reminders.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showMessage("Reminder report exported.");
  }

  $("refreshReminders").addEventListener("click", () => {
    currentPage = 1;
    refresh();
    showMessage("Reminder list refreshed.");
  });

  $("reminderDays").addEventListener("change", () => {
    currentPage = 1;
    renderTable();
  });

  $("reminderSearch").addEventListener("input", () => {
    currentPage = 1;
    renderTable();
  });

  $("reminderStatusFilter").addEventListener("change", () => {
    currentPage = 1;
    renderTable();
  });

  $("remindersTableBody").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    if (button.dataset.action === "whatsapp") {
      prepareWhatsApp(button.dataset.id);
    } else if (button.dataset.action === "status") {
      updateStatusManually(button.dataset.id);
    }
  });

  $("reminderPrevPage").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  $("reminderNextPage").addEventListener("click", () => {
    const totalPages = Math.max(
      1,
      Math.ceil(getFilteredRows().length / 10)
    );

    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });

  $("exportReminders").addEventListener("click", exportCSV);

  $("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("sidebar-open");
  });

  $("logoutBtn").addEventListener("click", () => {
    if (window.confirm("Are you sure you want to log out?")) {
      localStorage.removeItem(LOGIN_KEY);
      window.location.href = "login.html";
    }
  });

  refresh();
});
