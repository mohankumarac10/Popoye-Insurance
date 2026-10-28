
"use strict";

document.addEventListener("DOMContentLoaded", function () {
    // ==========================================
    // POPOYE INSURANCE - CUSTOMERS MODULE
    // Uses existing customers.html IDs
    // ==========================================

    const STORAGE_KEY = "popoyeCustomers";

    const $ = (id) => document.getElementById(id);

    // Form elements
    const addCustomerBtn = $("addCustomerBtn");
    const customerFormCard = $("customerFormCard");
    const customerForm = $("customerForm");
    const customerFormTitle = $("customerFormTitle");
    const cancelCustomerBtn = $("cancelCustomerBtn");
    const resetCustomerBtn = $("resetCustomerBtn");
    const customerId = $("customerId");

    // Input elements
    const customerName = $("customerName");
    const customerPhone = $("customerPhone");
    const customerEmail = $("customerEmail");
    const vehicleNumber = $("vehicleNumber");
    const vehicleModel = $("vehicleModel");
    const customerStatus = $("customerStatus");
    const customerAddress = $("customerAddress");

    // Table and filters
    const customersTableBody = $("customersTableBody");
    const customerSearch = $("customerSearch");
    const customerStatusFilter = $("customerStatusFilter");
    const customerPageSize = $("customerPageSize");
    const customerPrevBtn = $("customerPrevBtn");
    const customerNextBtn = $("customerNextBtn");

    // Pagination and messages
    const customerPageInfo = $("customerPageInfo");
    const customerPageNumber = $("customerPageNumber");
    const customerMessage = $("customerMessage");

    // Summary cards
    const customerCount = $("customerCount");
    const activeCustomerCount = $("activeCustomerCount");
    const inactiveCustomerCount = $("inactiveCustomerCount");
    const filteredCustomerCount = $("filteredCustomerCount");

    // CSV import
    const importCustomersBtn = $("importCustomersBtn");
    const importCustomersFile = $("importCustomersFile");

    // Sidebar
    const sidebar = $("sidebar");
    const menuToggle = $("menuToggle");

    let customers = loadCustomers();
    let currentPage = 1;

    // ==========================================
    // LOAD AND SAVE CUSTOMER DATA
    // ==========================================

    function loadCustomers() {
        try {
            const storedData = localStorage.getItem(STORAGE_KEY);

            if (!storedData) {
                return [];
            }

            const parsedData = JSON.parse(storedData);

            if (!Array.isArray(parsedData)) {
                return [];
            }

            return parsedData.map((customer, index) => ({
                id: String(customer.id || `CUS${Date.now()}${index}`),
                name: String(customer.name || customer.customerName || ""),
                phone: String(customer.phone || customer.customerPhone || ""),
                email: String(customer.email || customer.customerEmail || ""),
                vehicleNumber: String(customer.vehicleNumber || ""),
                vehicleModel: String(customer.vehicleModel || ""),
                status: String(customer.status || customer.customerStatus || "Active"),
                address: String(customer.address || customer.customerAddress || ""),
                createdAt: customer.createdAt || new Date().toISOString()
            }));
        } catch (error) {
            console.error("Unable to load customers:", error);
            return [];
        }
    }

    function saveCustomers() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
            return true;
        } catch (error) {
            console.error("Unable to save customers:", error);
            showMessage(
                "Unable to save customer data. Check your browser storage.",
                true
            );
            return false;
        }
    }

    // ==========================================
    // MESSAGE DISPLAY
    // ==========================================

    function showMessage(message, isError = false) {
        if (!customerMessage) return;

        customerMessage.textContent = message;
        customerMessage.classList.toggle("error", isError);

        customerMessage.setAttribute("role", "status");
    }

    // ==========================================
    // OPEN AND CLOSE CUSTOMER FORM
    // ==========================================

    function openCustomerForm(customer = null) {
        if (!customerFormCard || !customerForm) return;

        customerFormCard.hidden = false;

        if (customer) {
            customerFormTitle.textContent = "Edit Customer";

            customerId.value = customer.id;
            customerName.value = customer.name;
            customerPhone.value = customer.phone;
            customerEmail.value = customer.email;
            vehicleNumber.value = customer.vehicleNumber;
            vehicleModel.value = customer.vehicleModel;
            customerStatus.value = customer.status;
            customerAddress.value = customer.address;
        } else {
            customerForm.reset();
            customerId.value = "";
            customerStatus.value = "Active";
            customerFormTitle.textContent = "Add New Customer";
        }

        showMessage("");

        customerFormCard.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        customerName.focus({ preventScroll: true });
    }

    function closeCustomerForm() {
        if (!customerFormCard || !customerForm) return;

        customerForm.reset();
        customerId.value = "";
        customerStatus.value = "Active";
        customerFormTitle.textContent = "Add New Customer";
        customerFormCard.hidden = true;
    }

    if (addCustomerBtn) {
        addCustomerBtn.addEventListener("click", function () {
            openCustomerForm();
        });
    }

    if (cancelCustomerBtn) {
        cancelCustomerBtn.addEventListener("click", closeCustomerForm);
    }

    if (resetCustomerBtn) {
        resetCustomerBtn.addEventListener("click", function () {
            const editingId = customerId.value;

            customerForm.reset();
            customerId.value = editingId;
            customerStatus.value = "Active";

            customerName.focus();
        });
    }

    // ==========================================
    // ADD OR UPDATE CUSTOMER
    // ==========================================

    if (customerForm) {
        customerForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const id = customerId.value.trim();
            const name = customerName.value.trim();
            const phone = customerPhone.value.replace(/\D/g, "");
            const email = customerEmail.value.trim();
            const vehicle = vehicleNumber.value.trim().toUpperCase();
            const model = vehicleModel.value.trim();
            const status = customerStatus.value;
            const address = customerAddress.value.trim();

            // Required-field validation
            if (!name || !phone || !vehicle) {
                showMessage(
                    "Please enter the customer name, phone number, and vehicle number.",
                    true
                );
                return;
            }

            // Indian mobile number validation
            if (!/^[0-9]{10}$/.test(phone)) {
                showMessage(
                    "Enter a valid 10-digit mobile number.",
                    true
                );
                customerPhone.focus();
                return;
            }

            // Email validation
            if (
                email &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            ) {
                showMessage("Please enter a valid email address.", true);
                customerEmail.focus();
                return;
            }

            // Prevent duplicate phone numbers
            const duplicatePhone = customers.some(function (customer) {
                return customer.phone === phone && customer.id !== id;
            });

            if (duplicatePhone) {
                showMessage(
                    "A customer with this phone number already exists.",
                    true
                );
                customerPhone.focus();
                return;
            }

            // Prevent duplicate vehicle numbers
            const duplicateVehicle = customers.some(function (customer) {
                return (
                    customer.vehicleNumber.toUpperCase() === vehicle &&
                    customer.id !== id
                );
            });

            if (duplicateVehicle) {
                showMessage(
                    "This vehicle number is already registered.",
                    true
                );
                vehicleNumber.focus();
                return;
            }

            const now = new Date().toISOString();

            const customerData = {
                id: id || `CUS${Date.now()}`,
                name: name,
                phone: phone,
                email: email,
                vehicleNumber: vehicle,
                vehicleModel: model,
                status: status,
                address: address,
                createdAt: now
            };

            if (id) {
                const index = customers.findIndex(function (customer) {
                    return customer.id === id;
                });

                if (index === -1) {
                    showMessage("Customer record not found.", true);
                    return;
                }

                customerData.createdAt = customers[index].createdAt;
                customers[index] = customerData;
            } else {
                customers.unshift(customerData);
            }

            if (!saveCustomers()) {
                customers = loadCustomers();
                renderCustomers();
                return;
            }

            currentPage = 1;
            renderCustomers();
            closeCustomerForm();

            showMessage(
                id
                    ? "Customer updated successfully."
                    : "Customer added successfully."
            );
        });
    }

    // ==========================================
    // SAFE HTML OUTPUT
    // ==========================================

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, function (character) {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return entities[character];
        });
    }

    // ==========================================
    // SEARCH AND FILTER
    // ==========================================

    function getFilteredCustomers() {
        const searchText = customerSearch
            ? customerSearch.value.trim().toLowerCase()
            : "";

        const selectedStatus = customerStatusFilter
            ? customerStatusFilter.value
            : "All";

        return customers.filter(function (customer) {
            const searchableText = [
                customer.name,
                customer.phone,
                customer.email,
                customer.vehicleNumber,
                customer.vehicleModel,
                customer.address
            ].join(" ").toLowerCase();

            const matchesSearch = searchableText.includes(searchText);

            const matchesStatus =
                selectedStatus === "All" ||
                customer.status === selectedStatus;

            return matchesSearch && matchesStatus;
        });
    }

    // ==========================================
    // UPDATE SUMMARY CARDS
    // ==========================================

    function updateStatistics(filteredCustomers) {
        if (customerCount) {
            customerCount.textContent = customers.length;
        }

        if (activeCustomerCount) {
            activeCustomerCount.textContent = customers.filter(
                customer => customer.status === "Active"
            ).length;
        }

        if (inactiveCustomerCount) {
            inactiveCustomerCount.textContent = customers.filter(
                customer => customer.status === "Inactive"
            ).length;
        }

        if (filteredCustomerCount) {
            filteredCustomerCount.textContent = filteredCustomers.length;
        }
    }

    // ==========================================
    // RENDER CUSTOMER TABLE AND PAGINATION
    // ==========================================

    function renderCustomers() {
        if (!customersTableBody) return;

        const filteredCustomers = getFilteredCustomers();
        const pageSize = customerPageSize
            ? Number(customerPageSize.value) || 10
            : 10;

        const totalCustomers = filteredCustomers.length;
        const totalPages = Math.max(1, Math.ceil(totalCustomers / pageSize));

        currentPage = Math.min(currentPage, totalPages);
        currentPage = Math.max(currentPage, 1);

        const startIndex = (currentPage - 1) * pageSize;
        const pageCustomers = filteredCustomers.slice(
            startIndex,
            startIndex + pageSize
        );

        updateStatistics(filteredCustomers);

        if (pageCustomers.length === 0) {
            customersTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="payment-empty">
                        ${
                            customers.length === 0
                                ? "No customers added yet. Click Add Customer to get started."
                                : "No customers match your search or filter."
                        }
                    </td>
                </tr>
            `;
        } else {
            customersTableBody.innerHTML = pageCustomers.map(function (customer) {
                const statusClass =
                    customer.status === "Active"
                        ? "status-active"
                        : "status-expired";

                return `
                    <tr>
                        <td>
                            <div class="customer-name-cell">
                                <strong>${escapeHTML(customer.name)}</strong>
                                <small>${escapeHTML(customer.email || "No email provided")}</small>
                            </div>
                        </td>

                        <td>${escapeHTML(customer.phone)}</td>

                        <td>${escapeHTML(customer.vehicleNumber)}</td>

                        <td>${escapeHTML(customer.vehicleModel || "—")}</td>

                        <td>
                            <span class="status-badge ${statusClass}">
                                ${escapeHTML(customer.status)}
                            </span>
                        </td>

                        <td>
                            <div class="customer-actions">
                                <button
                                    type="button"
                                    class="table-action"
                                    data-action="edit"
                                    data-id="${escapeHTML(customer.id)}">
                                    Edit
                                </button>

                                <button
                                    type="button"
                                    class="table-action delete-action"
                                    data-action="delete"
                                    data-id="${escapeHTML(customer.id)}">
                                    Delete
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join("");
        }

        if (customerPageInfo) {
            const first = totalCustomers === 0 ? 0 : startIndex + 1;
            const last = Math.min(startIndex + pageSize, totalCustomers);

            customerPageInfo.textContent =
                `Showing ${first}-${last} of ${totalCustomers} customers`;
        }

        if (customerPageNumber) {
            customerPageNumber.textContent =
                `Page ${currentPage} of ${totalPages}`;
        }

        if (customerPrevBtn) {
            customerPrevBtn.disabled = currentPage <= 1;
        }

        if (customerNextBtn) {
            customerNextBtn.disabled = currentPage >= totalPages;
        }
    }

    // ==========================================
    // EDIT AND DELETE BUTTONS
    // ==========================================

    if (customersTableBody) {
        customersTableBody.addEventListener("click", function (event) {
            const button = event.target.closest("button[data-action]");

            if (!button) return;

            const id = button.dataset.id;
            const action = button.dataset.action;

            const customer = customers.find(function (item) {
                return item.id === id;
            });

            if (!customer) return;

            if (action === "edit") {
                openCustomerForm(customer);
            }

            if (action === "delete") {
                const confirmed = window.confirm(
                    `Are you sure you want to delete ${customer.name}?`
                );

                if (!confirmed) return;

                const previousCustomers = [...customers];

                customers = customers.filter(function (item) {
                    return item.id !== id;
                });

                if (!saveCustomers()) {
                    customers = previousCustomers;
                    renderCustomers();
                    return;
                }

                renderCustomers();
                showMessage("Customer deleted successfully.");
            }
        });
    }

    // ==========================================
    // FILTER AND PAGINATION EVENTS
    // ==========================================

    if (customerSearch) {
        customerSearch.addEventListener("input", function () {
            currentPage = 1;
            renderCustomers();
        });
    }

    if (customerStatusFilter) {
        customerStatusFilter.addEventListener("change", function () {
            currentPage = 1;
            renderCustomers();
        });
    }

    if (customerPageSize) {
        customerPageSize.addEventListener("change", function () {
            currentPage = 1;
            renderCustomers();
        });
    }

    if (customerPrevBtn) {
        customerPrevBtn.addEventListener("click", function () {
            if (currentPage > 1) {
                currentPage--;
                renderCustomers();
            }
        });
    }

    if (customerNextBtn) {
        customerNextBtn.addEventListener("click", function () {
            currentPage++;
            renderCustomers();
        });
    }

    // ==========================================
    // CSV IMPORT
    // Expected columns:
    // Name, Phone, Email, Vehicle Number,
    // Vehicle Model, Status, Address
    // ==========================================

    if (importCustomersBtn && importCustomersFile) {
        importCustomersBtn.addEventListener("click", function () {
            importCustomersFile.click();
        });

        importCustomersFile.addEventListener("change", function () {
            const file = importCustomersFile.files[0];

            if (!file) return;

            const reader = new FileReader();

            reader.onload = function (event) {
                try {
                    const rows = parseCSV(String(event.target.result || ""));

                    if (rows.length < 2) {
                        showMessage(
                            "The CSV file must contain a header row and at least one customer.",
                            true
                        );
                        return;
                    }

                    const headers = rows[0].map(normalizeHeader);

                    const getValue = function (row, names) {
                        const index = headers.findIndex(header =>
                            names.includes(header)
                        );

                        return index >= 0 ? String(row[index] || "").trim() : "";
                    };

                    let imported = 0;
                    let skipped = 0;

                    const existingPhones = new Set(
                        customers.map(customer => customer.phone)
                    );

                    const existingVehicles = new Set(
                        customers.map(customer =>
                            customer.vehicleNumber.toUpperCase()
                        )
                    );

                    for (const row of rows.slice(1)) {
                        if (!row.some(value => String(value).trim())) continue;

                        const name = getValue(row, ["name", "fullname", "customername"]);
                        const phone = getValue(row, ["phone", "phonenumber", "mobile", "mobilenumber"])
                            .replace(/\D/g, "");
                        const email = getValue(row, ["email", "emailaddress"]);
                        const vehicle = getValue(row, ["vehiclenumber", "vehicle", "registrationnumber", "regnumber"])
                            .toUpperCase();
                        const model = getValue(row, ["vehiclemodel", "model"]);
                        const statusValue = getValue(row, ["status", "customerstatus"]);
                        const address = getValue(row, ["address", "customeraddress"]);

                        if (!name || !/^[0-9]{10}$/.test(phone) || !vehicle) {
                            skipped++;
                            continue;
                        }

                        if (
                            existingPhones.has(phone) ||
                            existingVehicles.has(vehicle)
                        ) {
                            skipped++;
                            continue;
                        }

                        const status =
                            statusValue.toLowerCase() === "inactive"
                                ? "Inactive"
                                : "Active";

                        customers.unshift({
                            id: `CUS${Date.now()}${imported}`,
                            name,
                            phone,
                            email,
                            vehicleNumber: vehicle,
                            vehicleModel: model,
                            status,
                            address,
                            createdAt: new Date().toISOString()
                        });

                        existingPhones.add(phone);
                        existingVehicles.add(vehicle);
                        imported++;
                    }

                    if (imported > 0) {
                        if (!saveCustomers()) {
                            customers = loadCustomers();
                            renderCustomers();
                            return;
                        }

                        currentPage = 1;
                        renderCustomers();
                    }

                    showMessage(
                        `Import complete: ${imported} added, ${skipped} skipped.`,
                        imported === 0
                    );
                } catch (error) {
                    console.error("CSV import failed:", error);
                    showMessage(
                        "Unable to read this CSV file. Please check its format.",
                        true
                    );
                } finally {
                    importCustomersFile.value = "";
                }
            };

            reader.onerror = function () {
                showMessage("Unable to read the selected CSV file.", true);
                importCustomersFile.value = "";
            };

            reader.readAsText(file);
        });
    }

    function normalizeHeader(header) {
        return String(header || "")
            .replace(/^\uFEFF/, "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
    }

    function parseCSV(text) {
        const rows = [];
        let row = [];
        let value = "";
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const character = text[i];
            const nextCharacter = text[i + 1];

            if (character === '"') {
                if (inQuotes && nextCharacter === '"') {
                    value += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (character === "," && !inQuotes) {
                row.push(value.trim());
                value = "";
            } else if (
                (character === "\n" || character === "\r") &&
                !inQuotes
            ) {
                if (character === "\r" && nextCharacter === "\n") {
                    i++;
                }

                row.push(value.trim());

                if (row.some(cell => cell !== "")) {
                    rows.push(row);
                }

                row = [];
                value = "";
            } else {
                value += character;
            }
        }

        row.push(value.trim());

        if (row.some(cell => cell !== "")) {
            rows.push(row);
        }

        return rows;
    }

    // ==========================================
    // MOBILE SIDEBAR
    // ==========================================

    if (menuToggle && sidebar) {
        menuToggle.addEventListener("click", function () {
            sidebar.classList.toggle("sidebar-open");
        });

        document.addEventListener("click", function (event) {
            const clickedInsideSidebar = sidebar.contains(event.target);
            const clickedToggle = menuToggle.contains(event.target);

            if (
                window.innerWidth <= 800 &&
                !clickedInsideSidebar &&
                !clickedToggle
            ) {
                sidebar.classList.remove("sidebar-open");
            }
        });
    }

    // ==========================================
    // OPTIONAL LOGOUT HANDLER
    // ==========================================

    const logoutBtn = $("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
            const confirmed = window.confirm("Do you want to log out?");

            if (!confirmed) return;

            sessionStorage.removeItem("popoyeLoggedIn");
            window.location.href = "login.html";
        });
    }

    // ==========================================
    // INITIAL PAGE RENDER
    // ==========================================

    renderCustomers();
});
  