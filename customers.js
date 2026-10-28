
"use strict";

document.addEventListener("DOMContentLoaded", function () {
  // ==========================================
  // POPOYE INSURANCE - CUSTOMERS MODULE
  // LocalStorage demo implementation
  // ==========================================

  // Require the demo login session.
  if (sessionStorage.getItem("popoyeLoggedIn") !== "true") {
    window.location.replace("login.html");
    return;
  }

  const STORAGE_KEY = "popoyeCustomers";
  const THEME_KEY = "popoyeTheme";
  const PAGE_SIZE = 5;

  const $ = function (id) {
    return document.getElementById(id);
  };

  // Main elements required by this page.
  const form = $("customerForm");
  const modal = $("customerModal");
  const tableBody = $("customerTableBody");
  const searchInput = $("searchInput");
  const filterSelect = $("customerFilter");
  const message = $("customerMessage");

  if (
    !form ||
    !modal ||
    !tableBody ||
    !searchInput ||
    !filterSelect ||
    !message
  ) {
    console.error(
      "Customers page setup error: Check the required HTML IDs."
    );
    return;
  }

  let customers = [];
  let currentPage = 1;
  let messageTimer;

  // ==========================================
  // SAFE EVENT LISTENER
  // Optional controls will not crash the script.
  // ==========================================

  function on(id, eventName, handler) {
    const element = $(id);

    if (element) {
      element.addEventListener(eventName, handler);
    }

    return element;
  }

  // ==========================================
  // MESSAGES
  // ==========================================

  function showMessage(text, isError = false) {
    clearTimeout(messageTimer);

    message.textContent = text;
    message.style.color = isError ? "#DC2626" : "#0D9488";

    messageTimer = setTimeout(function () {
      message.textContent = "";
    }, 4000);
  }

  // ==========================================
  // LOCALSTORAGE
  // ==========================================

  function loadCustomers() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      customers = Array.isArray(saved) ? saved : [];
    } catch (error) {
      customers = [];

      showMessage(
        "Unable to read saved records. Check browser storage.",
        true
      );

      console.error("Customer loading error:", error);
    }
  }

  function saveCustomers() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(customers)
      );

      return true;
    } catch (error) {
      showMessage(
        "Unable to save records. Browser storage may be full.",
        true
      );

      console.error("Customer saving error:", error);
      return false;
    }
  }

  // ==========================================
  // CUSTOMER ID
  // ==========================================

  function generateId() {
    return (
      "CUS-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      Math.random().toString(36).slice(2, 6).toUpperCase()
    );
  }

  // ==========================================
  // SEARCH AND FILTER
  // ==========================================

  function getFilteredCustomers() {
    const query = searchInput.value.trim().toLowerCase();
    const filter = filterSelect.value;

    return customers.filter(function (customer) {
      const searchableValues = [
        customer.id,
        customer.name,
        customer.phone,
        customer.email,
        customer.vehicleNumber,
        customer.address
      ];

      const matchesSearch = searchableValues.some(function (value) {
        return String(value || "").toLowerCase().includes(query);
      });

      const hasPhone = Boolean(
        String(customer.phone || "").trim()
      );

      const matchesFilter =
        filter === "all" ||
        (filter === "withPhone" && hasPhone) ||
        (filter === "withoutPhone" && !hasPhone);

      return matchesSearch && matchesFilter;
    });
  }

  // ==========================================
  // TABLE HELPERS
  // ==========================================

  function createCell(row, text) {
    const cell = document.createElement("td");

    cell.textContent =
      text !== null && text !== undefined && text !== ""
        ? String(text)
        : "—";

    row.appendChild(cell);

    return cell;
  }

  function createActionButton(label, className, handler) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "small-btn " + className;
    button.textContent = label;
    button.addEventListener("click", handler);

    return button;
  }

  // ==========================================
  // CUSTOMER STATISTICS
  // ==========================================

  function updateStatistics() {
    if ($("totalCustomers")) {
      $("totalCustomers").textContent = customers.length;
    }

    if ($("customersWithPhone")) {
      $("customersWithPhone").textContent =
        customers.filter(function (customer) {
          return Boolean(String(customer.phone || "").trim());
        }).length;
    }

    if ($("newCustomers")) {
      const now = new Date();

      const newThisMonth = customers.filter(function (customer) {
        if (!customer.createdAt) {
          return false;
        }

        const date = new Date(
          customer.createdAt + "T00:00:00"
        );

        return (
          !Number.isNaN(date.getTime()) &&
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      }).length;

      $("newCustomers").textContent = newThisMonth;
    }
  }

  // ==========================================
  // RENDER CUSTOMERS AND PAGINATION
  // ==========================================

  function renderCustomers() {
    const filtered = getFilteredCustomers();

    const totalPages = Math.max(
      1,
      Math.ceil(filtered.length / PAGE_SIZE)
    );

    currentPage = Math.max(
      1,
      Math.min(currentPage, totalPages)
    );

    const startIndex = (currentPage - 1) * PAGE_SIZE;

    const visible = filtered.slice(
      startIndex,
      startIndex + PAGE_SIZE
    );

    tableBody.replaceChildren();

    if (visible.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 6;
      cell.className = "empty-state";

      cell.textContent = customers.length
        ? "No customers match your search."
        : "No customers registered yet. Click Add Customer to begin.";

      row.appendChild(cell);
      tableBody.appendChild(row);
    } else {
      visible.forEach(function (customer) {
        const row = document.createElement("tr");

        createCell(row, customer.id);

        // Customer name and email.
        const detailsCell = document.createElement("td");

        const name = document.createElement("div");
        name.className = "customer-name";
        name.textContent = customer.name || "—";

        detailsCell.appendChild(name);

        if (customer.email) {
          const email = document.createElement("div");

          email.className = "customer-email";
          email.textContent = customer.email;

          detailsCell.appendChild(email);
        }

        row.appendChild(detailsCell);

        createCell(row, customer.phone);
        createCell(row, customer.vehicleNumber);
        createCell(row, customer.createdAt);

        // Edit and delete buttons.
        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");

        actions.className = "action-buttons";

        const editButton = createActionButton(
          "Edit",
          "edit-btn",
          function () {
            openEditModal(customer.id);
          }
        );

        const deleteButton = createActionButton(
          "Delete",
          "delete-btn",
          function () {
            deleteCustomer(customer.id);
          }
        );

        actions.append(editButton, deleteButton);
        actionsCell.appendChild(actions);
        row.appendChild(actionsCell);

        tableBody.appendChild(row);
      });
    }

    // Pagination information.
    if ($("pageInfo")) {
      $("pageInfo").textContent = filtered.length
        ? "Showing " +
          (startIndex + 1) +
          "–" +
          Math.min(startIndex + PAGE_SIZE, filtered.length) +
          " of " +
          filtered.length +
          " customers"
        : "Showing 0 customers";
    }

    if ($("pageNumber")) {
      $("pageNumber").textContent =
        currentPage + " / " + totalPages;
    }

    if ($("prevPage")) {
      $("prevPage").disabled = currentPage <= 1;
    }

    if ($("nextPage")) {
      $("nextPage").disabled = currentPage >= totalPages;
    }

    updateStatistics();
  }

  // ==========================================
  // ADD CUSTOMER MODAL
  // ==========================================

  function openAddModal() {
    form.reset();

    if ($("editCustomerId")) {
      $("editCustomerId").value = "";
    }

    if ($("modalTitle")) {
      $("modalTitle").textContent = "Add New Customer";
    }

    if ($("saveCustomerBtn")) {
      $("saveCustomerBtn").textContent = "Save Customer";
    }

    modal.hidden = false;

    if ($("customerName")) {
      $("customerName").focus();
    }
  }

  // ==========================================
  // EDIT CUSTOMER MODAL
  // ==========================================

  function openEditModal(id) {
    const customer = customers.find(function (item) {
      return item.id === id;
    });

    if (!customer) {
      showMessage("Customer not found.", true);
      return;
    }

    form.reset();

    if ($("editCustomerId")) {
      $("editCustomerId").value = customer.id;
    }

    if ($("customerName")) {
      $("customerName").value = customer.name || "";
    }

    if ($("customerPhone")) {
      $("customerPhone").value = customer.phone || "";
    }

    if ($("customerEmail")) {
      $("customerEmail").value = customer.email || "";
    }

    if ($("vehicleNumber")) {
      $("vehicleNumber").value = customer.vehicleNumber || "";
    }

    if ($("customerAddress")) {
      $("customerAddress").value = customer.address || "";
    }

    if ($("modalTitle")) {
      $("modalTitle").textContent = "Edit Customer";
    }

    if ($("saveCustomerBtn")) {
      $("saveCustomerBtn").textContent = "Update Customer";
    }

    modal.hidden = false;

    if ($("customerName")) {
      $("customerName").focus();
    }
  }

  // ==========================================
  // CLOSE MODAL
  // ==========================================

  function closeModal() {
    modal.hidden = true;
    form.reset();

    if ($("editCustomerId")) {
      $("editCustomerId").value = "";
    }
  }

  // ==========================================
  // DELETE CUSTOMER
  // ==========================================

  function deleteCustomer(id) {
    const customer = customers.find(function (item) {
      return item.id === id;
    });

    if (!customer) {
      showMessage("Customer not found.", true);
      return;
    }

    if (!confirm("Delete customer " + customer.name + "?")) {
      return;
    }

    const original = customers;

    customers = customers.filter(function (item) {
      return item.id !== id;
    });

    if (!saveCustomers()) {
      customers = original;
      return;
    }

    renderCustomers();
    showMessage("Customer deleted successfully.");
  }

  // ==========================================
  // ADD AND UPDATE CUSTOMER
  // ==========================================

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const id = $("editCustomerId")
      ? $("editCustomerId").value
      : "";

    const name = $("customerName")
      ? $("customerName").value.trim()
      : "";

    const phone = $("customerPhone")
      ? $("customerPhone").value.trim()
      : "";

    const email = $("customerEmail")
      ? $("customerEmail").value.trim()
      : "";

    const vehicleNumber = $("vehicleNumber")
      ? $("vehicleNumber").value.trim().toUpperCase()
      : "";

    const address = $("customerAddress")
      ? $("customerAddress").value.trim()
      : "";

    // Required fields.
    if (!name || !phone || !vehicleNumber) {
      showMessage(
        "Please complete all required fields.",
        true
      );
      return;
    }

    // Indian mobile number validation.
    if (!/^[6-9]\d{9}$/.test(phone)) {
      showMessage(
        "Enter a valid 10-digit Indian mobile number.",
        true
      );
      return;
    }

    // Email validation.
    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      showMessage("Enter a valid email address.", true);
      return;
    }

    // Duplicate phone validation.
    const duplicatePhone = customers.some(function (customer) {
      return customer.phone === phone && customer.id !== id;
    });

    if (duplicatePhone) {
      showMessage(
        "This phone number is already registered.",
        true
      );
      return;
    }

    // Duplicate vehicle validation.
    const duplicateVehicle = customers.some(function (customer) {
      return (
        String(customer.vehicleNumber || "").toUpperCase() ===
          vehicleNumber &&
        customer.id !== id
      );
    });

    if (duplicateVehicle) {
      showMessage(
        "This vehicle number is already registered.",
        true
      );
      return;
    }

    const existing = customers.find(function (customer) {
      return customer.id === id;
    });

    const customer = {
      id: existing ? existing.id : generateId(),
      name: name,
      phone: phone,
      email: email,
      vehicleNumber: vehicleNumber,
      address: address,
      createdAt: existing
        ? existing.createdAt
        : new Date().toISOString().slice(0, 10)
    };

    const original = customers;

    if (existing) {
      customers = customers.map(function (item) {
        return item.id === id ? customer : item;
      });
    } else {
      customers = [customer, ...customers];
    }

    if (!saveCustomers()) {
      customers = original;
      return;
    }

    closeModal();

    // Return to the first page after saving.
    currentPage = 1;

    renderCustomers();

    showMessage(
      existing
        ? "Customer updated successfully."
        : "Customer added successfully."
    );
  });

  // ==========================================
  // SEARCH AND FILTER EVENTS
  // ==========================================

  searchInput.addEventListener("input", function () {
    currentPage = 1;
    renderCustomers();
  });

  filterSelect.addEventListener("change", function () {
    currentPage = 1;
    renderCustomers();
  });

  // ==========================================
  // PAGINATION EVENTS
  // ==========================================

  on("prevPage", "click", function () {
    if (currentPage > 1) {
      currentPage--;
      renderCustomers();
    }
  });

  on("nextPage", "click", function () {
    const totalPages = Math.max(
      1,
      Math.ceil(getFilteredCustomers().length / PAGE_SIZE)
    );

    if (currentPage < totalPages) {
      currentPage++;
      renderCustomers();
    }
  });

  // ==========================================
  // CSV EXPORT
  // Exports the filtered customer records.
  // ==========================================

  function escapeCSV(value) {
    let text = String(value ?? "");

    // Prevent spreadsheet formula execution.
    if (/^[\s]*[=+\-@]/.test(text)) {
      text = "'" + text;
    }

    return '"' + text.replace(/"/g, '""') + '"';
  }

  on("exportBtn", "click", function () {
    const records = getFilteredCustomers();

    if (!records.length) {
      showMessage(
        "There are no customers to export.",
        true
      );
      return;
    }

    const headers = [
      "Customer ID",
      "Full Name",
      "Phone",
      "Email",
      "Vehicle Number",
      "Address",
      "Registered Date"
    ];

    const rows = records.map(function (customer) {
      return [
        customer.id,
        customer.name,
        customer.phone,
        customer.email,
        customer.vehicleNumber,
        customer.address,
        customer.createdAt
      ];
    });

    const csv = [headers, ...rows]
      .map(function (row) {
        return row.map(escapeCSV).join(",");
      })
      .join("\r\n");

    const blob = new Blob(
      ["\uFEFF" + csv],
      { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "popoye-customers.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    // Release the temporary download URL after the click.
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);

    showMessage("Customer CSV exported successfully.");
  });

  // ==========================================
  // MODAL EVENTS
  // ==========================================

  on("addCustomerBtn", "click", openAddModal);
  on("closeModalBtn", "click", closeModal);
  on("cancelBtn", "click", closeModal);

  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  // ==========================================
  // DARK MODE
  // Shares the theme key with other pages.
  // ==========================================

  function applySavedTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);

    document.body.classList.toggle(
      "dark-mode",
      savedTheme === "dark"
    );
  }

  applySavedTheme();

  on("themeToggle", "click", function () {
    const isDark = document.body.classList.toggle("dark-mode");

    try {
      localStorage.setItem(
        THEME_KEY,
        isDark ? "dark" : "light"
      );
    } catch (error) {
      console.error("Unable to save theme preference:", error);
    }
  });

  // ==========================================
  // MOBILE SIDEBAR
  // ==========================================

  on("menuToggle", "click", function () {
    const sidebar = $("sidebar");

    if (sidebar) {
      sidebar.classList.toggle("open");
    }
  });

  // ==========================================
  // LOGOUT
  // ==========================================

  on("logoutBtn", "click", function () {
    sessionStorage.removeItem("popoyeLoggedIn");
    window.location.replace("login.html");
  });

  // ==========================================
  // FOOTER YEAR
  // ==========================================

  if ($("currentYear")) {
    $("currentYear").textContent = new Date().getFullYear();
  }

  // ==========================================
  // INITIALIZE PAGE
  // ==========================================

  loadCustomers();
  renderCustomers();
});
