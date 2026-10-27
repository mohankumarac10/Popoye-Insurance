
document.addEventListener("DOMContentLoaded", function () {
  // Require the demo login session.
  if (sessionStorage.getItem("popoyeLoggedIn") !== "true") {
    window.location.replace("login.html");
    return;
  }

  const STORAGE_KEY = "popoyeCustomers";
  const PAGE_SIZE = 5;

  const $ = function (id) {
    return document.getElementById(id);
  };

  const form = $("customerForm");
  const modal = $("customerModal");
  const tableBody = $("customerTableBody");
  const searchInput = $("searchInput");
  const filterSelect = $("customerFilter");
  const message = $("customerMessage");

  let customers = [];
  let currentPage = 1;
  let messageTimer;

  function loadCustomers() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      customers = Array.isArray(saved) ? saved : [];
    } catch (error) {
      customers = [];
      showMessage("Unable to read saved records. Check browser storage.", true);
    }
  }

  function saveCustomers() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
      return true;
    } catch (error) {
      showMessage("Unable to save records. Browser storage may be full.", true);
      return false;
    }
  }

  function showMessage(text, isError = false) {
    clearTimeout(messageTimer);
    message.textContent = text;
    message.style.color = isError ? "#DC2626" : "#0D9488";

    messageTimer = setTimeout(function () {
      message.textContent = "";
    }, 4000);
  }

  function escapeCSV(value) {
    return '"' + String(value ?? "").replace(/"/g, '""') + '"';
  }

  function generateId() {
    return "CUS-" + Date.now().toString(36).toUpperCase() +
      "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function getFilteredCustomers() {
    const query = searchInput.value.trim().toLowerCase();
    const filter = filterSelect.value;

    return customers.filter(function (customer) {
      const matchesSearch = [
        customer.id,
        customer.name,
        customer.phone,
        customer.email,
        customer.vehicleNumber,
        customer.address
      ].some(function (value) {
        return String(value || "").toLowerCase().includes(query);
      });

      const hasPhone = Boolean(String(customer.phone || "").trim());

      const matchesFilter =
        filter === "all" ||
        (filter === "withPhone" && hasPhone) ||
        (filter === "withoutPhone" && !hasPhone);

      return matchesSearch && matchesFilter;
    });
  }

  function createCell(row, text) {
    const cell = document.createElement("td");
    cell.textContent = text || "—";
    row.appendChild(cell);
    return cell;
  }

  function renderCustomers() {
    const filtered = getFilteredCustomers();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

    currentPage = Math.min(currentPage, totalPages);
    currentPage = Math.max(currentPage, 1);

    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const visible = filtered.slice(startIndex, startIndex + PAGE_SIZE);

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

        const detailsCell = document.createElement("td");
        const name = document.createElement("div");
        name.className = "customer-name";
        name.textContent = customer.name;

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

        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");
        actions.className = "action-buttons";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "small-btn edit-btn";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", function () {
          openEditModal(customer.id);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "small-btn delete-btn";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", function () {
          deleteCustomer(customer.id);
        });

        actions.append(editButton, deleteButton);
        actionsCell.appendChild(actions);
        row.appendChild(actionsCell);

        tableBody.appendChild(row);
      });
    }

    $("pageInfo").textContent = filtered.length
      ? "Showing " + (startIndex + 1) + "–" +
        Math.min(startIndex + PAGE_SIZE, filtered.length) +
        " of " + filtered.length + " customers"
      : "Showing 0 customers";

    $("pageNumber").textContent = currentPage + " / " + totalPages;
    $("prevPage").disabled = currentPage <= 1;
    $("nextPage").disabled = currentPage >= totalPages;

    $("totalCustomers").textContent = customers.length;

    $("customersWithPhone").textContent = customers.filter(function (c) {
      return Boolean(String(c.phone || "").trim());
    }).length;

    const now = new Date();
    const newThisMonth = customers.filter(function (customer) {
      if (!customer.createdAt) return false;
      const date = new Date(customer.createdAt + "T00:00:00");
      return !Number.isNaN(date.getTime()) &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();
    }).length;

    $("newCustomers").textContent = newThisMonth;
  }

  function openAddModal() {
    form.reset();
    $("editCustomerId").value = "";
    $("modalTitle").textContent = "Add New Customer";
    $("saveCustomerBtn").textContent = "Save Customer";
    modal.hidden = false;
    $("customerName").focus();
  }

  function openEditModal(id) {
    const customer = customers.find(function (item) {
      return item.id === id;
    });

    if (!customer) return;

    form.reset();
    $("editCustomerId").value = customer.id;
    $("customerName").value = customer.name || "";
    $("customerPhone").value = customer.phone || "";
    $("customerEmail").value = customer.email || "";
    $("vehicleNumber").value = customer.vehicleNumber || "";
    $("customerAddress").value = customer.address || "";

    $("modalTitle").textContent = "Edit Customer";
    $("saveCustomerBtn").textContent = "Update Customer";
    modal.hidden = false;
    $("customerName").focus();
  }

  function closeModal() {
    modal.hidden = true;
    form.reset();
    $("editCustomerId").value = "";
  }

  function deleteCustomer(id) {
    const customer = customers.find(function (item) {
      return item.id === id;
    });

    if (!customer) return;

    if (!confirm("Delete customer " + customer.name + "?")) return;

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

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const id = $("editCustomerId").value;
    const name = $("customerName").value.trim();
    const phone = $("customerPhone").value.trim();
    const email = $("customerEmail").value.trim();
    const vehicleNumber = $("vehicleNumber").value.trim().toUpperCase();
    const address = $("customerAddress").value.trim();

    if (!name || !phone || !vehicleNumber) {
      showMessage("Please complete all required fields.", true);
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      showMessage("Enter a valid 10-digit Indian mobile number.", true);
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMessage("Enter a valid email address.", true);
      return;
    }

    const duplicatePhone = customers.some(function (customer) {
      return customer.phone === phone && customer.id !== id;
    });

    if (duplicatePhone) {
      showMessage("This phone number is already registered.", true);
      return;
    }

    const duplicateVehicle = customers.some(function (customer) {
      return String(customer.vehicleNumber || "").toUpperCase() === vehicleNumber &&
        customer.id !== id;
    });

    if (duplicateVehicle) {
      showMessage("This vehicle number is already registered.", true);
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
    currentPage = 1;
    renderCustomers();
    showMessage(existing
      ? "Customer updated successfully."
      : "Customer added successfully.");
  });

  $("addCustomerBtn").addEventListener("click", openAddModal);
  $("closeModalBtn").addEventListener("click", closeModal);
  $("cancelBtn").addEventListener("click", closeModal);

  modal.addEventListener("click", function (event) {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });

  searchInput.addEventListener("input", function () {
    currentPage = 1;
    renderCustomers();
  });

  filterSelect.addEventListener("change", function () {
    currentPage = 1;
    renderCustomers();
  });

  $("prevPage").addEventListener("click", function () {
    if (currentPage > 1) {
      currentPage--;
      renderCustomers();
    }
  });

  $("nextPage").addEventListener("click", function () {
    const totalPages = Math.max(
      1, Math.ceil(getFilteredCustomers().length / PAGE_SIZE)
    );

    if (currentPage < totalPages) {
      currentPage++;
      renderCustomers();
    }
  });

  $("exportBtn").addEventListener("click", function () {
    const records = getFilteredCustomers();

    if (!records.length) {
      showMessage("There are no customers to export.", true);
      return;
    }

    const headers = [
      "Customer ID", "Full Name", "Phone", "Email",
      "Vehicle Number", "Address", "Registered Date"
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

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "popoye-customers.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showMessage("Customer CSV exported successfully.");
  });

  // Shared demo theme and navigation.
  if (localStorage.getItem("popoyeTheme") === "dark") {
    document.body.classList.add("dark-mode");
  }

  $("themeToggle").addEventListener("click", function () {
    document.body.classList.toggle("dark-mode");

    localStorage.setItem(
      "popoyeTheme",
      document.body.classList.contains("dark-mode") ? "dark" : "light"
    );
  });

  $("menuToggle").addEventListener("click", function () {
    $("sidebar").classList.toggle("open");
  });

  $("logoutBtn").addEventListener("click", function () {
    sessionStorage.removeItem("popoyeLoggedIn");
    window.location.replace("login.html");
  });

  $("currentYear").textContent = new Date().getFullYear();

  loadCustomers();
  renderCustomers();
});
