
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // POPOYE INSURANCE - REPORTS MODULE
  // Reports use LocalStorage demo data
  // ==========================================

  const KEYS = {
    customers: "popoyeCustomers",
    policies: "popoyePolicies",
    payments: "popoyePayments",
    login: "popoyeLoggedIn"
  };

  if (localStorage.getItem(KEYS.login) !== "true") {
    window.location.href = "login.html";
    return;
  }

  const $ = (id) => document.getElementById(id);

  const COLORS = {
    navy: "#142B4A",
    teal: "#0D9488",
    grey: "#94A3B8",
    amber: "#D97706",
    red: "#DC2626",
    grid: "#E3EAF2",
    text: "#718096"
  };

  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.error("Unable to read " + key, error);
      return [];
    }
  }

  function money(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
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

  function getRange() {
    const period = $("reportPeriod").value;
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (period === "month") {
      return {
        start: localDateString(new Date(today.getFullYear(), today.getMonth(), 1)),
        end: localDateString(today)
      };
    }

    if (period === "last30") {
      const from = new Date(start);
      from.setDate(from.getDate() - 29);
      return {
        start: localDateString(from),
        end: localDateString(today)
      };
    }

    if (period === "year") {
      return {
        start: localDateString(new Date(today.getFullYear(), 0, 1)),
        end: localDateString(today)
      };
    }

    return { start: "", end: "" };
  }

  function isInRange(dateValue, range) {
    if (!range.start && !range.end) return true;
    if (!dateValue) return false;

    const date = String(dateValue).slice(0, 10);

    return (!range.start || date >= range.start) &&
      (!range.end || date <= range.end);
  }

  function getData() {
    const range = getRange();
    const allCustomers = readArray(KEYS.customers);
    const allPolicies = readArray(KEYS.policies);
    const allPayments = readArray(KEYS.payments);

    const customers = allCustomers.filter((customer) =>
      isInRange(customer.createdAt || customer.updatedAt, range)
    );

    const policies = allPolicies.filter((policy) =>
      isInRange(
        policy.createdAt || policy.startDate || policy.updatedAt,
        range
      )
    );

    const payments = allPayments.filter((payment) =>
      isInRange(payment.date || payment.createdAt, range)
    );

    return { customers, policies, payments };
  }

  function getPolicyStatus(policy) {
    if (policy.status === "Pending") return "Pending";

    if (!policy.expiryDate) {
      return policy.status || "Unknown";
    }

    const today = localDateString();
    const expiry = String(policy.expiryDate).slice(0, 10);

    if (expiry < today) return "Expired";

    const expiryDate = new Date(expiry + "T00:00:00");
    const todayDate = new Date(today + "T00:00:00");
    const daysLeft = Math.round(
      (expiryDate - todayDate) / (1000 * 60 * 60 * 24)
    );

    if (daysLeft <= 30) return "Expiring";
    return "Active";
  }

  function drawBarChart(canvasId, legendId, labels, values, colors) {
    const canvas = $(canvasId);
    const context = canvas.getContext("2d");
    const container = canvas.parentElement;
    const width = Math.max(container.clientWidth, 240);
    const height = Math.max(container.clientHeight, 200);
    const ratio = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const padding = { top: 22, right: 18, bottom: 48, left: 38 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const maxValue = Math.max(...values, 1);
    const step = Math.max(1, Math.ceil(maxValue / 4));
    const maxAxis = step * 4;

    context.font = "11px Arial";
    context.textAlign = "right";
    context.textBaseline = "middle";
    context.fillStyle = COLORS.text;
    context.strokeStyle = COLORS.grid;
    context.lineWidth = 1;

    for (let tick = 0; tick <= maxAxis; tick += step) {
      const y = padding.top + chartHeight -
        (tick / maxAxis) * chartHeight;

      context.beginPath();
      context.moveTo(padding.left, y);
      context.lineTo(width - padding.right, y);
      context.stroke();

      context.fillText(String(tick), padding.left - 8, y);
    }

    const groupWidth = chartWidth / labels.length;
    const barWidth = Math.min(52, groupWidth * 0.55);

    labels.forEach((label, index) => {
      const barHeight = (values[index] / maxAxis) * chartHeight;
      const x = padding.left +
        groupWidth * index +
        (groupWidth - barWidth) / 2;
      const y = padding.top + chartHeight - barHeight;

      context.fillStyle = colors[index];
      context.beginPath();
      context.roundRect(x, y, barWidth, Math.max(barHeight, 1), 5);
      context.fill();

      context.fillStyle = COLORS.navy;
      context.textAlign = "center";
      context.textBaseline = "bottom";
      context.font = "bold 12px Arial";
      context.fillText(String(values[index]), x + barWidth / 2, y - 5);

      context.fillStyle = COLORS.text;
      context.font = "11px Arial";
      context.textBaseline = "top";

      const labelParts = label.split(" ");
      if (labelParts.length > 1) {
        context.fillText(
          labelParts[0],
          x + barWidth / 2,
          padding.top + chartHeight + 10
        );
        context.fillText(
          labelParts.slice(1).join(" "),
          x + barWidth / 2,
          padding.top + chartHeight + 23
        );
      } else {
        context.fillText(
          label,
          x + barWidth / 2,
          padding.top + chartHeight + 10
        );
      }
    });

    $(legendId).innerHTML = labels.map((label, index) => `
      <span class="report-legend-item">
        <span class="report-legend-dot"
          style="background:${colors[index]}"></span>
        ${escapeHTML(label)}: ${values[index]}
      </span>
    `).join("");
  }

  function updateSummary(data) {
    $("reportCustomers").textContent = data.customers.length;
    $("reportPolicies").textContent = data.policies.length;

    const paid = data.payments.filter((payment) => payment.status === "Paid");
    const pending = data.payments.filter(
      (payment) => payment.status === "Pending"
    );

    $("reportCollected").textContent = money(
      paid.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    );

    $("reportPendingAmount").textContent = money(
      pending.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    );
  }

  function renderOverview(data) {
    const active = data.policies.filter(
      (policy) => getPolicyStatus(policy) === "Active"
    ).length;

    const expiring = data.policies.filter(
      (policy) => getPolicyStatus(policy) === "Expiring"
    ).length;

    const expired = data.policies.filter(
      (policy) => getPolicyStatus(policy) === "Expired"
    ).length;

    const paid = data.payments.filter(
      (payment) => payment.status === "Paid"
    ).length;

    const pending = data.payments.filter(
      (payment) => payment.status === "Pending"
    ).length;

    const failed = data.payments.filter(
      (payment) => payment.status === "Failed"
    ).length;

    drawBarChart(
      "policyChart",
      "policyLegend",
      ["Active", "Expiring", "Expired"],
      [active, expiring, expired],
      [COLORS.teal, COLORS.amber, COLORS.red]
    );

    drawBarChart(
      "paymentChart",
      "paymentLegend",
      ["Paid", "Pending", "Failed"],
      [paid, pending, failed],
      [COLORS.teal, COLORS.amber, COLORS.red]
    );
  }

  function renderTable(title, description, headers, rows) {
    $("reportTableTitle").textContent = title;
    $("reportTableDescription").textContent = description;

    $("reportTableHead").innerHTML = `
      <tr>${headers.map((header) =>
        `<th>${escapeHTML(header)}</th>`
      ).join("")}</tr>`;

    if (!rows.length) {
      $("reportTableBody").innerHTML = `
        <tr>
          <td colspan="${headers.length}" class="report-empty">
            No records found for the selected report period.
          </td>
        </tr>`;
      return;
    }

    $("reportTableBody").innerHTML = rows.map((row) => `
      <tr>${row.map((cell) =>
        `<td>${escapeHTML(cell)}</td>`
      ).join("")}</tr>
    `).join("");
  }

  function renderSelectedReport(data) {
    const type = $("reportType").value;

    if (type === "customers") {
      renderTable(
        "Customer Report",
        "Customer records matching the selected period.",
        ["Customer Name", "Phone", "Email", "Vehicle Number", "Created"],
        data.customers.map((customer) => [
          customer.name || "—",
          customer.phone || "—",
          customer.email || "—",
          customer.vehicleNumber || "—",
          customer.createdAt
            ? String(customer.createdAt).slice(0, 10)
            : "—"
        ])
      );
      return;
    }

    if (type === "policies") {
      renderTable(
        "Policy Report",
        "Policy records matching the selected period.",
        ["Policy Number", "Customer", "Vehicle Number", "Expiry Date",
          "Premium", "Status"],
        data.policies.map((policy) => [
          policy.policyNumber || "—",
          policy.customerName || "—",
          policy.vehicleNumber || "—",
          policy.expiryDate || "—",
          money(policy.premium),
          getPolicyStatus(policy)
        ])
      );
      return;
    }

    if (type === "payments") {
      renderTable(
        "Payment Report",
        "Payment records matching the selected period.",
        ["Reference ID", "Customer", "Method", "Date", "Amount", "Status"],
        data.payments.map((payment) => [
          payment.id || "—",
          payment.customerName || "—",
          payment.method || "—",
          payment.date || "—",
          money(payment.amount),
          payment.status || "Pending"
        ])
      );
      return;
    }

    renderTable(
      "Business Overview",
      "Summary of your stored business records.",
      ["Category", "Records", "Amount / Details"],
      [
        ["Customers", data.customers.length, "Customer records"],
        ["Policies", data.policies.length, "Policy records"],
        [
          "Paid Payments",
          data.payments.filter((payment) => payment.status === "Paid").length,
          money(data.payments
            .filter((payment) => payment.status === "Paid")
            .reduce((sum, payment) => sum + Number(payment.amount || 0), 0))
        ],
        [
          "Pending Payments",
          data.payments.filter((payment) => payment.status === "Pending").length,
          money(data.payments
            .filter((payment) => payment.status === "Pending")
            .reduce((sum, payment) => sum + Number(payment.amount || 0), 0))
        ],
        [
          "Failed Payments",
          data.payments.filter((payment) => payment.status === "Failed").length,
          "Requires review"
        ]
      ]
    );
  }

  function refreshReport() {
    const data = getData();
    updateSummary(data);
    renderOverview(data);
    renderSelectedReport(data);
    $("reportMessage").textContent =
      "Report refreshed: " + new Date().toLocaleString("en-IN");
  }

  function exportReport() {
    const data = getData();
    const type = $("reportType").value;
    let headers;
    let rows;
    let filename;

    if (type === "customers") {
      headers = ["Customer Name", "Phone", "Email", "Vehicle Number", "Created"];
      rows = data.customers.map((customer) => [
        customer.name || "",
        customer.phone || "",
        customer.email || "",
        customer.vehicleNumber || "",
        customer.createdAt || ""
      ]);
      filename = "popoye-customer-report.csv";
    } else if (type === "policies") {
      headers = [
        "Policy Number", "Customer", "Vehicle Number", "Expiry Date",
        "Premium", "Status"
      ];
      rows = data.policies.map((policy) => [
        policy.policyNumber || "",
        policy.customerName || "",
        policy.vehicleNumber || "",
        policy.expiryDate || "",
        policy.premium || 0,
        getPolicyStatus(policy)
      ]);
      filename = "popoye-policy-report.csv";
    } else if (type === "payments") {
      headers = [
        "Reference ID", "Customer", "Method", "Date", "Amount", "Status"
      ];
      rows = data.payments.map((payment) => [
        payment.id || "",
        payment.customerName || "",
        payment.method || "",
        payment.date || "",
        payment.amount || 0,
        payment.status || "Pending"
      ]);
      filename = "popoye-payment-report.csv";
    } else {
      headers = ["Category", "Records", "Amount / Details"];
      rows = [
        ["Customers", data.customers.length, "Customer records"],
        ["Policies", data.policies.length, "Policy records"],
        [
          "Paid Payments",
          data.payments.filter((payment) => payment.status === "Paid").length,
          data.payments
            .filter((payment) => payment.status === "Paid")
            .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
        ],
        [
          "Pending Payments",
          data.payments.filter((payment) => payment.status === "Pending").length,
          data.payments
            .filter((payment) => payment.status === "Pending")
            .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
        ],
        [
          "Failed Payments",
          data.payments.filter((payment) => payment.status === "Failed").length,
          "Requires review"
        ]
      ];
      filename = "popoye-business-report.csv";
    }

    if (!rows.length) {
      $("reportMessage").textContent =
        "No records are available to export for this report.";
      return;
    }

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
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    $("reportMessage").textContent = "Report exported successfully.";
  }

  $("refreshReport").addEventListener("click", refreshReport);
  $("reportPeriod").addEventListener("change", refreshReport);
  $("reportType").addEventListener("change", refreshReport);
  $("exportReport").addEventListener("click", exportReport);

  $("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("sidebar-open");
  });

  $("logoutBtn").addEventListener("click", () => {
    if (window.confirm("Are you sure you want to log out?")) {
      localStorage.removeItem(KEYS.login);
      window.location.href = "login.html";
    }
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refreshReport, 150);
  });

  refreshReport();
});
