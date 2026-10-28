
"use strict";

document.addEventListener("DOMContentLoaded", function () {
    // ==========================================
    // POPOYE INSURANCE - CUSTOMERS MODULE
    // ==========================================

    const STORAGE_KEY = "popoyeCustomers";
    const LOGIN_KEY = "popoyeLoggedIn";

    if (localStorage.getItem(LOGIN_KEY) !== "true") {
        window.location.href = "login.html";
        return;
    }

    const $ = (id) => document.getElementById(id);

    const form = $("customerForm");
    const formCard = $("customerFormCard");
    const tableBody = $("customersTableBody");
    const message = $("customerMessage");
    const searchInput = $("customerSearch");
    const statusFilter = $("customerStatusFilter");
    const pageSizeInput = $("customerPageSize");

    let customers = readCustomers();
    let currentPage = 1;
    let editingId = null;
    let messageTimer;

    // Read saved records safely.
    function readCustomers() {
        try {
            const data = JSON.parse(
                localStorage.getItem(STORAGE_KEY) || "[]"
            );

            return Array.isArray(data) ? data : [];
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
            showMessage("Unable to save data. Check browser storage.", true);
            return false;
        }
    }

    function makeId() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            return window.crypto.randomUUID();
        }

        return "CUS-" + Date.now() + "-" +
            Math.random().toString(36).slice(2, 8);
    }

    function getId(customer) {
        return String(customer.id ?? customer.customerId ?? customer.customer_id ?? "");
    }

    function getName(customer) {
        return customer.name || customer.customerName ||
            customer.customer_name || customer.fullName || "";
    }

    function getPhone(customer) {
        return String(customer.phone || customer.phoneNumber ||
            customer.phone_number || customer.mobile || "");
    }

    function getVehicle(customer) {
        return customer.vehicleNumber || customer.vehicle_number ||
            customer.registrationNumber || customer.vehicleNo || "";
    }

    function getModel(customer) {
        return customer.vehicleModel || customer.vehicle_model ||
            customer.model || "";
    }

    function getEmail(customer) {
        return customer.email || customer.emailAddress || "";
    }

    function getStatus(customer) {
        const status = String(customer.status || "Active").toLowerCase();

        return status === "inactive" ? "Inactive" : "Active";
    }

    function showMessage(text, isError = false) {
        clearTimeout(messageTimer);

        message.textContent = text;
        message.classList.toggle("error", isError);

        messageTimer = setTimeout(function () {
            message.textContent = "";
            message.classList.remove("error");
        }, 4000);
    }

    // ==========================================
    // SUMMARY CARDS
    // ==========================================

    function updateSummary(filteredCount) {
        $("customerCount").textContent = customers.length;

        $("activeCustomerCount").textContent =
            customers.filter(c => getStatus(c) === "Active").length;

        $("inactiveCustomerCount").textContent =
            customers.filter(c => getStatus(c) === "Inactive").length;

        $("filteredCustomerCount").textContent = filteredCount;
    }

    // ==========================================
    // SEARCH AND FILTER
    // ==========================================

    function getFilteredCustomers() {
        const query = searchInput.value.trim().toLowerCase();
        const selectedStatus = statusFilter.value;

        return customers.filter(function (customer) {
            const searchableText = [
                getName(customer),
                getPhone(customer),
                getEmail(customer),
                getVehicle(customer),
                getModel(customer),
                customer.address || ""
            ].join(" ").toLowerCase();

            const matchesSearch = searchableText.includes(query);

            const matchesStatus = selectedStatus === "All" ||
                getStatus(customer) === selectedStatus;

            return matchesSearch && matchesStatus;
        });
    }

    // ==========================================
    // RENDER CUSTOMER TABLE AND PAGINATION
    // ==========================================

    function renderCustomers() {
        const filtered = getFilteredCustomers();
        const pageSize = Number(pageSizeInput.value) || 10;
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

        currentPage = Math.min(currentPage, totalPages);

        const startIndex = (currentPage - 1) * pageSize;
        const pageCustomers = filtered.slice(
            startIndex,
            startIndex + pageSize
        );

        tableBody.replaceChildren();

        if (pageCustomers.length === 0) {
            const row = tableBody.insertRow();
            const cell = row.insertCell();

            cell.colSpan = 6;
            cell.textContent = customers.length === 0
                ? "No customers added yet. Click Add Customer to begin."
                : "No customers match your search or filter.";

            updateSummary(filtered.length);
            updatePagination(filtered.length, totalPages, startIndex);
            return;
        }

        pageCustomers.forEach(function (customer) {
            const row = tableBody.insertRow();

            // Customer name and email.
            const nameCell = row.insertCell();
            nameCell.className = "customer-name-cell";

            const name = document.createElement("strong");
            name.textContent = getName(customer) || "Unnamed Customer";

            const email = document.createElement("small");
            email.textContent = getEmail(customer) || "No email provided";

            nameCell.append(name, email);

            row.insertCell().textContent = getPhone(customer) || "—";
            row.insertCell().textContent = getVehicle(customer) || "—";
            row.insertCell().textContent = getModel(customer) || "—";

            const statusCell = row.insertCell();
            const badge = document.createElement("span");

            badge.className = "status-badge " +
                (getStatus(customer) === "Active"
                    ? "status-active"
                    : "status-expired");

            badge.textContent = getStatus(customer);
            statusCell.appendChild(badge);

            const actionCell = row.insertCell();
            const actions = document.createElement("div");
            actions.className = "customer-actions";

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.className = "table-action";
            editButton.textContent = "Edit";
            editButton.setAttribute(
                "aria-label", "Edit " + getName(customer)
            );

            editButton.addEventListener("click", function () {
                openEditForm(getId(customer));
            });

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "table-action delete-action";
            deleteButton.textContent = "Delete";
            deleteButton.setAttribute(
                "aria-label", "Delete " + getName(customer)
            );

            deleteButton.addEventListener("click", function () {
                deleteCustomer(getId(customer));
            });

            actions.append(editButton, deleteButton);
            actionCell.appendChild(actions);
        });

        updateSummary(filtered.length);
        updatePagination(filtered.length, totalPages, startIndex);
    }

    function updatePagination(total, totalPages, startIndex) {
        const pageSize = Number(pageSizeInput.value) || 10;
        const start = total === 0 ? 0 : startIndex + 1;
        const end = Math.min(startIndex + pageSize, total);

        $("customerPageInfo").textContent =
            `Showing ${start}–${end} of ${total} customers`;

        $("customerPageNumber").textContent =
            `Page ${currentPage} of ${totalPages}`;

        $("customerPrevBtn").disabled = currentPage <= 1;
        $("customerNextBtn").disabled = currentPage >= totalPages;
    }

    // ==========================================
    // ADD CUSTOMER
    // ==========================================

    function openAddForm() {
        editingId = null;
        form.reset();

        $("customerId").value = "";
        $("customerStatus").value = "Active";
        $("customerFormTitle").textContent = "Add New Customer";
        $("saveCustomerBtn").textContent = "Save Customer";

        formCard.hidden = false;
        formCard.scrollIntoView({ behavior: "smooth", block: "start" });
        $("customerName").focus();
    }

    // ==========================================
    // EDIT CUSTOMER
    // ==========================================

    function openEditForm(id) {
        const customer = customers.find(c => getId(c) === String(id));

        if (!customer) {
            showMessage("Customer record not found.", true);
            return;
        }

        editingId = String(id);

        $("customerId").value = editingId;
        $("customerName").value = getName(customer);
        $("customerPhone").value = getPhone(customer);
        $("customerEmail").value = getEmail(customer);
        $("vehicleNumber").value = getVehicle(customer);
        $("vehicleModel").value = getModel(customer);
        $("customerStatus").value = getStatus(customer);
        $("customerAddress").value = customer.address || "";

        $("customerFormTitle").textContent = "Edit Customer";
        $("saveCustomerBtn").textContent = "Update Customer";

        formCard.hidden = false;
        formCard.scrollIntoView({ behavior: "smooth", block: "start" });
        $("customerName").focus();
    }

    // ==========================================
    // SAVE CUSTOMER
    // ==========================================

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const name = $("customerName").value.trim();
        const phone = $("customerPhone").value.trim();
        const email = $("customerEmail").value.trim();
        const vehicleNumber = $("vehicleNumber").value.trim().toUpperCase();

        if (!name || !phone || !vehicleNumber) {
            showMessage("Please complete all required fields.", true);
            return;
        }

        if (!/^[0-9]{10}$/.test(phone)) {
            showMessage("Enter a valid 10-digit phone number.", true);
            $("customerPhone").focus();
            return;
        }

        const duplicatePhone = customers.some(function (customer) {
            return getPhone(customer) === phone &&
                getId(customer) !== editingId;
        });

        if (duplicatePhone) {
            showMessage("This phone number already exists.", true);
            $("customerPhone").focus();
            return;
        }

        const duplicateVehicle = customers.some(function (customer) {
            return getVehicle(customer).toUpperCase() === vehicleNumber &&
                getId(customer) !== editingId;
        });

        if (duplicateVehicle) {
            showMessage("This vehicle number already exists.", true);
            $("vehicleNumber").focus();
            return;
        }

        const existing = customers.find(
            customer => getId(customer) === editingId
        );

        const customerData = {
            ...(existing || {}),
            id: editingId || makeId(),
            name: name,
            phone: phone,
            email: email,
            vehicleNumber: vehicleNumber,
            vehicleModel: $("vehicleModel").value.trim(),
            status: $("customerStatus").value,
            address: $("customerAddress").value.trim(),
            updatedAt: new Date().toISOString()
        };

        if (existing) {
            customers = customers.map(function (customer) {
                return getId(customer) === editingId
                    ? customerData
                    : customer;
            });
        } else {
            customerData.createdAt = new Date().toISOString();
            customers.unshift(customerData);
        }

        if (!saveCustomers()) return;

        formCard.hidden = true;
        form.reset();
        editingId = null;
        currentPage = 1;

        renderCustomers();
        showMessage(
            existing
                ? "Customer updated successfully."
                : "Customer added successfully."
        );
    });

    // ==========================================
    // DELETE CUSTOMER
    // ==========================================

    function deleteCustomer(id) {
        const customer = customers.find(c => getId(c) === String(id));

        if (!customer) return;

        const confirmed = window.confirm(
            `Delete customer "${getName(customer)}"? This cannot be undone.`
        );

        if (!confirmed) return;

        const previousCustomers = customers;
        customers = customers.filter(c => getId(c) !== String(id));

        if (!saveCustomers()) {
            customers = previousCustomers;
            return;
        }

        renderCustomers();
        showMessage("Customer deleted successfully.");
    }

    // ==========================================
    // CSV EXPORT
    // ==========================================

    function exportCustomers() {
        const filtered = getFilteredCustomers();

        if (filtered.length === 0) {
            showMessage("There are no customer records to export.", true);
            return;
        }

        const columns = [
            ["Customer ID", getId],
            ["Name", getName],
            ["Phone", getPhone],
            ["Email", getEmail],
            ["Vehicle Number", getVehicle],
            ["Vehicle Model", getModel],
            ["Status", getStatus],
            ["Address", customer => customer.address || ""]
        ];

        function escapeCSV(value) {
            let text = String(value ?? "");

            // Prevent spreadsheet formula injection in exported text.
            if (/^[\s]*[=+\-@]/.test(text)) {
                text = "'" + text;
            }

            return '"' + text.replace(/"/g, '""') + '"';
        }

        const csvRows = [
            columns.map(column => escapeCSV(column[0])).join(","),
            ...filtered.map(customer =>
                columns.map(column => escapeCSV(column[1](customer))).join(",")
            )
        ];

        const blob = new Blob(
            ["\uFEFF" + csvRows.join("\r\n")],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "popoye-customers.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
        showMessage("Customer CSV export started.");
    }

    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    $("addCustomerBtn").addEventListener("click", openAddForm);

    $("cancelCustomerBtn").addEventListener("click", function () {
        formCard.hidden = true;
        form.reset();
        editingId = null;
    });

    $("resetCustomerBtn").addEventListener("click", function () {
        form.reset();

        if (editingId) {
            openEditForm(editingId);
        } else {
            $("customerStatus").value = "Active";
        }
    });

    searchInput.addEventListener("input", function () {
        currentPage = 1;
        renderCustomers();
    });

    statusFilter.addEventListener("change", function () {
        currentPage = 1;
        renderCustomers();
    });

    pageSizeInput.addEventListener("change", function () {
        currentPage = 1;
        renderCustomers();
    });

    $("customerPrevBtn").addEventListener("click", function () {
        if (currentPage > 1) {
            currentPage--;
            renderCustomers();
        }
    });

    $("customerNextBtn").addEventListener("click", function () {
        const totalPages = Math.max(
            1,
            Math.ceil(
                getFilteredCustomers().length /
                (Number(pageSizeInput.value) || 10)
            )
        );

        if (currentPage < totalPages) {
            currentPage++;
            renderCustomers();
        }
    });

    $("exportCustomersBtn").addEventListener("click", exportCustomers);

    $("menuToggle").addEventListener("click", function () {
        $("sidebar").classList.toggle("sidebar-open");
    });

    $("logoutBtn").addEventListener("click", function () {
        localStorage.removeItem(LOGIN_KEY);
        window.location.href = "login.html";
    });

    // Refresh the table if another browser tab updates customers.
    window.addEventListener("storage", function (event) {
        if (event.key === STORAGE_KEY) {
            customers = readCustomers();
            renderCustomers();
        }
    });

    renderCustomers();
});
