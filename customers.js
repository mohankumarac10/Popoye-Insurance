
"use strict";

document.addEventListener("DOMContentLoaded", function () {
    // ==========================================
    // POPOYE INSURANCE - CUSTOMERS MODULE
    // ==========================================

    const $ = (id) => document.getElementById(id);

    // Form elements
    const addCustomerBtn = $("addCustomerBtn");
    const customerFormCard = $("customerFormCard");
    const customerForm = $("customerForm");
    const customerFormTitle = $("customerFormTitle");
    const cancelCustomerBtn = $("cancelCustomerBtn");
    const resetCustomerBtn = $("resetCustomerBtn");
    const customerId = $("customerId");

    // Inputs
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

    // Summary and messages
    const customerPageInfo = $("customerPageInfo");
    const customerPageNumber = $("customerPageNumber");
    const customerMessage = $("customerMessage");
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

    const API_URL = "http://localhost:3000/api/customers";

    let customers = [];
    let currentPage = 1;

    // ==========================================
    // HELPERS
    // ==========================================

    function escapeHTML(value) {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return String(value ?? "").replace(/[&<>"']/g, function (character) {
            return entities[character];
        });
    }

    function showMessage(message, isError = false) {
        if (!customerMessage) return;

        customerMessage.textContent = message;
        customerMessage.classList.toggle("error", isError);
        customerMessage.setAttribute("role", "status");
    }

    async function readResponse(response) {
        let result;

        try {
            result = await response.json();
        } catch {
            result = {};
        }

        if (!response.ok) {
            throw new Error(
                result.message || `Request failed (${response.status}).`
            );
        }

        return result;
    }

    function mapCustomer(customer) {
        return {
            id: String(customer.id),
            name: customer.full_name || "",
            phone: String(customer.phone || ""),
            email: customer.email || "",
            vehicleNumber: customer.vehicle_number || "",
            vehicleModel: customer.vehicle_model || "",
            status: customer.status || "Active",
            address: customer.address || "",
            createdAt: customer.created_at || ""
        };
    }

    // ==========================================
    // LOAD CUSTOMERS FROM MYSQL
    // ==========================================

    async function loadCustomersFromAPI() {
        try {
            const response = await fetch(API_URL);
            const result = await readResponse(response);

            if (!Array.isArray(result.customers)) {
                throw new Error("The server returned an invalid customer list.");
            }

            customers = result.customers.map(mapCustomer);
            renderCustomers();

        } catch (error) {
            console.error("Failed to load customers:", error);
            renderCustomers();

            showMessage(
                "Unable to load customers. Check that the backend is running.",
                true
            );
        }
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

            if (customerStatus) {
                customerStatus.value = "Active";
            }

            customerFormTitle.textContent = "Add New Customer";
        }

        showMessage("");
        customerFormCard.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        if (customerName) customerName.focus();
    }

    function closeCustomerForm() {
        if (!customerFormCard || !customerForm) return;

        customerForm.reset();
        customerId.value = "";

        if (customerStatus) {
            customerStatus.value = "Active";
        }

        if (customerFormTitle) {
            customerFormTitle.textContent = "Add New Customer";
        }

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

    if (resetCustomerBtn && customerForm) {
        resetCustomerBtn.addEventListener("click", function () {
            const editingId = customerId.value;

            customerForm.reset();
            customerId.value = editingId;

            if (customerStatus) {
                customerStatus.value = "Active";
            }
        });
    }

    // ==========================================
    // ADD OR UPDATE CUSTOMER
    // ==========================================

    if (customerForm) {
        customerForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const id = customerId.value.trim();
            const name = customerName.value.trim();
            const phone = customerPhone.value.replace(/\D/g, "");
            const email = customerEmail.value.trim();
            const vehicle = vehicleNumber.value.trim().toUpperCase();
            const address = customerAddress.value.trim();

            const isEditing = Boolean(id);

            if (!name || !phone || !vehicle) {
                showMessage(
                    "Enter customer name, phone number, and vehicle number.",
                    true
                );
                return;
            }

            if (!/^[0-9]{10}$/.test(phone)) {
                showMessage("Enter a valid 10-digit mobile number.", true);
                customerPhone.focus();
                return;
            }

            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showMessage("Enter a valid email address.", true);
                customerEmail.focus();
                return;
            }

            try {
                const response = await fetch(
                    isEditing
                        ? `${API_URL}/${encodeURIComponent(id)}`
                        : API_URL,
                    {
                        method: isEditing ? "PUT" : "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            full_name: name,
                            phone: phone,
                            email: email,
                            address: address,
                            vehicle_number: vehicle
                        })
                    }
                );

                await readResponse(response);
                await loadCustomersFromAPI();

                closeCustomerForm();

                showMessage(
                    isEditing
                        ? "Customer updated successfully in MySQL."
                        : "Customer saved successfully to MySQL."
                );

            } catch (error) {
                console.error("Customer save failed:", error);
                showMessage(error.message, true);
            }
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
    // SUMMARY CARDS
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
        const totalPages = Math.max(
            1,
            Math.ceil(totalCustomers / pageSize)
        );

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
                </tr>`;
        } else {
            customersTableBody.innerHTML = pageCustomers.map(function (customer) {
                const statusClass = customer.status === "Active"
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
                                <button type="button"
                                    class="table-action"
                                    data-action="edit"
                                    data-id="${escapeHTML(customer.id)}">
                                    Edit
                                </button>
                                <button type="button"
                                    class="table-action delete-action"
                                    data-action="delete"
                                    data-id="${escapeHTML(customer.id)}">
                                    Delete
                                </button>
                            </div>
                        </td>
                    </tr>`;
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
        customersTableBody.addEventListener("click", async function (event) {
            const button = event.target.closest("button[data-action]");

            if (!button) return;

            const id = button.dataset.id;
            const action = button.dataset.action;

            const customer = customers.find(
                item => String(item.id) === String(id)
            );

            if (!customer) return;

            if (action === "edit") {
                openCustomerForm(customer);
                return;
            }

            if (action === "delete") {
                const confirmed = window.confirm(
                    `Are you sure you want to delete ${customer.name}?`
                );

                if (!confirmed) return;

                try {
                    const response = await fetch(
                        `${API_URL}/${encodeURIComponent(id)}`,
                        { method: "DELETE" }
                    );

                    await readResponse(response);
                    await loadCustomersFromAPI();

                    showMessage("Customer deleted successfully from MySQL.");

                } catch (error) {
                    console.error("Customer delete failed:", error);
                    showMessage(
                        "Delete failed. Your backend must have a DELETE /api/customers/:id route.",
                        true
                    );
                }
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
    // Imports customers through the API
    // ==========================================

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

    function normalizeHeader(header) {
        return String(header || "")
            .replace(/^\uFEFF/, "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
    }

    if (importCustomersBtn && importCustomersFile) {
        importCustomersBtn.addEventListener("click", function () {
            importCustomersFile.click();
        });

        importCustomersFile.addEventListener("change", async function () {
            const file = importCustomersFile.files[0];

            if (!file) return;

            try {
                const rows = parseCSV(await file.text());

                if (rows.length < 2) {
                    showMessage(
                        "The CSV must contain a header and at least one customer.",
                        true
                    );
                    return;
                }

                const headers = rows[0].map(normalizeHeader);

                function getValue(row, names) {
                    const index = headers.findIndex(
                        header => names.includes(header)
                    );

                    return index >= 0
                        ? String(row[index] || "").trim()
                        : "";
                }

                let imported = 0;
                let skipped = 0;

                for (const row of rows.slice(1)) {
                    const name = getValue(
                        row,
                        ["name", "fullname", "customername"]
                    );

                    const phone = getValue(
                        row,
                        ["phone", "phonenumber", "mobile", "mobilenumber"]
                    ).replace(/\D/g, "");

                    const email = getValue(
                        row,
                        ["email", "emailaddress"]
                    );

                    const vehicle = getValue(
                        row,
                        ["vehiclenumber", "vehicle", "registrationnumber", "regnumber"]
                    ).toUpperCase();

                    const address = getValue(
                        row,
                        ["address", "customeraddress"]
                    );

                    if (!name || !/^[0-9]{10}$/.test(phone) || !vehicle) {
                        skipped++;
                        continue;
                    }

                    try {
                        const response = await fetch(API_URL, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                full_name: name,
                                phone: phone,
                                email: email,
                                address: address,
                                vehicle_number: vehicle
                            })
                        });

                        await readResponse(response);
                        imported++;
                    } catch (error) {
                        console.error("CSV row import failed:", error);
                        skipped++;
                    }
                }

                await loadCustomersFromAPI();

                showMessage(
                    `Import complete: ${imported} added, ${skipped} skipped.`,
                    imported === 0
                );

            } catch (error) {
                console.error("CSV import failed:", error);
                showMessage("Unable to read this CSV file.", true);
            } finally {
                importCustomersFile.value = "";
            }
        });
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
    // LOGOUT
    // ==========================================

    const logoutBtn = $("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
            if (!window.confirm("Do you want to log out?")) return;

            sessionStorage.removeItem("popoyeLoggedIn");
            window.location.href = "login.html";
        });
    }

    // ==========================================
    // START
    // ==========================================

    loadCustomersFromAPI();
});
