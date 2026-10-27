
document.addEventListener("DOMContentLoaded", function () {
  // Protect the dashboard during the demo session.
  if (sessionStorage.getItem("popoyeLoggedIn") !== "true") {
    window.location.replace("login.html");
    return;
  }

  const readRecords = function (key) {
    try {
      const records = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(records) ? records : [];
    } catch (error) {
      return [];
    }
  };

  // Read the shared demo storage keys.
  const customers = readRecords("popoyeCustomers");
  const policies = readRecords("popoyePolicies");
  const payments = readRecords("popoyePayments");

  const setText = function (id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };

  const money = function (amount) {
    return Number(amount || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    });
  };

  // Summary cards.
  setText("totalCustomers", customers.length);
  setText("totalPolicies", policies.length);

  const successfulPayments = payments.filter(function (payment) {
    return ["paid", "success", "successful", "completed"].includes(
      String(payment.status || "").toLowerCase()
    );
  });

  const premiumCollected = successfulPayments.reduce(function (sum, payment) {
    return sum + (
      Number(payment.amount ?? payment.premiumAmount ?? payment.premium ?? 0) || 0
    );
  }, 0);

  const pendingCount = payments.filter(function (payment) {
    return ["pending", "unpaid", "processing"].includes(
      String(payment.status || "").toLowerCase()
    );
  }).length;

  setText("totalPremium", money(premiumCollected));
  setText("pendingPayments", pendingCount);

  // Renewal counts.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thirtyDaysLater = new Date(today);
  thirtyDaysLater.setDate(today.getDate() + 30);

  let expired = 0;
  let expiring = 0;
  let active = 0;

  policies.forEach(function (policy) {
    const rawDate = policy.expiryDate || policy.expiry || policy.endDate;
    if (!rawDate) return;

    const expiryDate = new Date(rawDate + "T00:00:00");
    if (Number.isNaN(expiryDate.getTime())) return;

    const status = String(policy.status || "").toLowerCase();

    if (["expired", "cancelled", "canceled"].includes(status)) {
      if (status === "expired") expired++;
      return;
    }

    if (expiryDate < today) {
      expired++;
    } else if (expiryDate <= thirtyDaysLater) {
      expiring++;
    } else {
      active++;
    }
  });

  setText("expiredPolicies", expired);
  setText("expiringPolicies", expiring);
  setText("activePolicies", active);

  // Recent payment table.
  const tableBody = document.getElementById("recentPaymentsBody");

  if (tableBody) {
    tableBody.replaceChildren();

    const recentPayments = payments.slice().reverse().slice(0, 5);

    if (recentPayments.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 5;
      cell.className = "empty-state";
      cell.textContent = "No payments recorded yet.";

      row.appendChild(cell);
      tableBody.appendChild(row);
    } else {
      recentPayments.forEach(function (payment) {
        const row = document.createElement("tr");

        const customerName =
          payment.customerName || payment.name || "Unknown customer";

        const vehicleNumber =
          payment.vehicleNumber || payment.vehicleNo || "—";

        const amount =
          payment.amount ?? payment.premiumAmount ?? payment.premium ?? 0;

        const method = payment.method || payment.paymentMethod || "—";
        const status = String(payment.status || "pending").toLowerCase();

        [
          customerName,
          vehicleNumber,
          money(amount),
          method
        ].forEach(function (value) {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.appendChild(cell);
        });

        const statusCell = document.createElement("td");
        const badge = document.createElement("span");

        badge.className = "payment-status " +
          (["paid", "success", "successful", "completed"].includes(status)
            ? "paid"
            : "pending");

        badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        statusCell.appendChild(badge);
        row.appendChild(statusCell);

        tableBody.appendChild(row);
      });
    }
  }

  // Footer year.
  setText("currentYear", new Date().getFullYear());

  // Mobile sidebar.
  const sidebar = document.getElementById("sidebar");
  const menuToggle = document.getElementById("menuToggle");

  if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", function () {
      sidebar.classList.toggle("open");
    });
  }

  // Demo dark mode.
  const themeToggle = document.getElementById("themeToggle");

  if (localStorage.getItem("popoyeTheme") === "dark") {
    document.body.classList.add("dark-mode");
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      document.body.classList.toggle("dark-mode");

      localStorage.setItem(
        "popoyeTheme",
        document.body.classList.contains("dark-mode") ? "dark" : "light"
      );
    });
  }

  // Demo logout.
  const logoutBtn = document.getElementById("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      sessionStorage.removeItem("popoyeLoggedIn");
      window.location.replace("login.html");
    });
  }
});
