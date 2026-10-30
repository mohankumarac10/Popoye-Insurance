"use strict";

document.addEventListener("DOMContentLoaded", function () {

    // ==========================================
    // POPOYE INSURANCE - POLICIES MODULE
    // ==========================================

    const LOGIN_KEY = "popoyeLoggedIn";

    if (localStorage.getItem(LOGIN_KEY) !== "true") {
        window.location.href = "login.html";
        return;
    }

    const $ = id => document.getElementById(id);

    function on(id, eventName, handler) {
        const element = $(id);

        if (element) {
            element.addEventListener(eventName, handler);
        } else {
            console.warn("HTML element not found:", id);
        }
    }

    const form = $("policyForm");
    const formCard = $("policyFormCard");
    const tableBody = $("policiesTableBody");
    const message = $("policyMessage");

    let policies = [];
    let customers = [];
    let vehicles = [];
    let currentPage = 1;
    let editingId = null;
    let messageTimer;

    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================

    function valueOf(item, keys, fallback = "") {
        if (!item) return fallback;

        for (const key of keys) {
            if (
                item[key] !== undefined &&
                item[key] !== null &&
                item[key] !== ""
            ) {
                return item[key];
            }
        }

        return fallback;
    }

    function getId(item) {
        return String(valueOf(item, [
            "id",
            "policyId",
            "policy_id"
        ]));
    }

    function customerId(item) {
        return String(valueOf(item, [
            "customerId",
            "customer_id",
            "customer"
        ]));
    }

    function getCustomerName(customer) {
        return valueOf(customer, [
            "name",
            "customerName",
            "customer_name",
            "fullName",
            "full_name"
        ], "Unknown Customer");
    }

    function getPolicyCustomerName(policy) {
        const savedName = valueOf(policy, [
            "customerName",
            "customer_name",
            "full_name"
        ]);

        if (savedName) return savedName;

        const customer = customers.find(c =>
            String(valueOf(c, [
                "id",
                "customerId",
                "customer_id"
            ])) === customerId(policy)
        );

        return customer
            ? getCustomerName(customer)
            : "Unknown Customer";
    }

    function getPolicyNumber(policy) {
        return valueOf(policy, [
            "policyNumber",
            "policy_number",
            "number"
        ], "—");
    }

    function getExpiry(policy) {
        return valueOf(policy, [
            "expiryDate",
            "expiry_date",
            "end_date",
            "endDate"
        ]);
    }

    function getStartDate(policy) {
        return valueOf(policy, [
            "startDate",
            "start_date",
            "policyStartDate"
        ]);
    }

    function getPremium(policy) {
        return Number(valueOf(policy, [
            "premium",
            "premiumAmount",
            "premium_amount",
            "amount"
        ], 0));
    }

    function getType(policy) {
        return valueOf(policy, [
            "type",
            "policyType",
            "policy_type"
        ], "—");
    }

    function parseDate(value) {
        if (!value) return null;

        const date = new Date(value);

        return Number.isNaN(date.getTime()) ? null : date;
    }

    function startOfToday() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    }

    function getStatus(policy) {
        const savedStatus = String(valueOf(policy, [
            "status",
            "policyStatus",
            "policy_status"
        ], "Active")).toLowerCase();

        if (savedStatus === "pending") return "Pending";
        if (savedStatus === "cancelled") return "Cancelled";

        const expiry = parseDate(getExpiry(policy));

        if (expiry) {
            expiry.setHours(0, 0, 0, 0);

            if (expiry < startOfToday()) return "Expired";
        }

        if (savedStatus === "expired") return "Expired";

        return "Active";
    }

    function formatDate(value) {
        const date = parseDate(value);

        return date ? date.toLocaleDateString("en-IN") : "—";
    }

    function money(value) {
        return Number(value || 0).toLocaleString("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        });
    }

    function showMessage(text, isError = false) {
        clearTimeout(messageTimer);

        if (!message) {
            (isError ? console.error : console.log)(text);
            return;
        }

        message.textContent = text;
        message.classList.toggle("error", isError);

        messageTimer = setTimeout(() => {
            message.textContent = "";
            message.classList.remove("error");
        }, 4000);
    }

    // ==========================================
    // LOAD DATA FROM NODE.JS / MYSQL
    // ==========================================

    async function loadPoliciesFromBackend() {
        try {
            const [
                policiesResponse,
                customersResponse,
                vehiclesResponse
            ] = await Promise.all([
                fetch("http://localhost:3000/api/policies"),
                fetch("http://localhost:3000/api/customers"),
                fetch("http://localhost:3000/api/vehicles")
            ]);

            if (
                !policiesResponse.ok ||
                !customersResponse.ok ||
                !vehiclesResponse.ok
            ) {
                throw new Error("Backend request failed");
            }

            const policiesData = await policiesResponse.json();
            const customersData = await customersResponse.json();
            const vehiclesData = await vehiclesResponse.json();

            if (
                policiesData.status !== "success" ||
                customersData.status !== "success" ||
                vehiclesData.status !== "success"
            ) {
                throw new Error("Backend returned an unsuccessful response");
            }

            policies = Array.isArray(policiesData.policies)
                ? policiesData.policies
                : [];

            customers = Array.isArray(customersData.customers)
                ? customersData.customers
                : [];

            vehicles = Array.isArray(vehiclesData.vehicles)
                ? vehiclesData.vehicles
                : [];

            populateCustomers();
            renderPolicies();

            console.log("Policies loaded:", policies.length);
            console.log("Customers loaded:", customers.length);
            console.log("Vehicles loaded:", vehicles.length);

        } catch (error) {
            console.error("Backend loading failed:", error);

            showMessage(
                "Could not load policies, customers, or vehicles. Check the backend.",
                true
            );
        }
    }

    // ==========================================
    // CUSTOMER DROPDOWN
    // ==========================================

    function populateCustomers(selectedId = "") {
        const select = $("policyCustomer");

        if (!select) return;

        select.replaceChildren();

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = customers.length
            ? "Select a customer"
            : "Add a customer first";

        select.appendChild(placeholder);

        customers.forEach(function (customer) {
            const option = document.createElement("option");

            option.value = String(valueOf(customer, [
                "id",
                "customerId",
                "customer_id"
            ]));

            option.textContent =
                getCustomerName(customer) +
                (customer.phone ? " — " + customer.phone : "");

            select.appendChild(option);
        });

        select.value = String(selectedId);
    }

    function fillVehicleFromCustomer() {
        const select = $("policyCustomer");

        if (!select) return;

        const id = select.value;

        const customer = customers.find(c =>
            String(valueOf(c, [
                "id",
                "customerId",
                "customer_id"
            ])) === id
        );

        if (!customer) return;

        const vehicle = $("policyVehicle");
        const model = $("policyModel");

        if (vehicle) {
            vehicle.value = valueOf(customer, [
                "vehicleNumber",
                "vehicle_number",
                "registrationNumber"
            ]);
        }

        if (model) {
            model.value = valueOf(customer, [
                "vehicleModel",
                "vehicle_model",
                "model"
            ]);
        }
    }

    on("policyCustomer", "change", fillVehicleFromCustomer);

    // ==========================================
    // SUMMARY
    // ==========================================

    function updateSummary() {
        const today = startOfToday();
        const limit = new Date(today);

        limit.setDate(limit.getDate() + 30);

        if ($("totalPolicies")) {
            $("totalPolicies").textContent = policies.length;
        }

        if ($("activePolicies")) {
            $("activePolicies").textContent =
                policies.filter(p => getStatus(p) === "Active").length;
        }

        if ($("expiredPolicies")) {
            $("expiredPolicies").textContent =
                policies.filter(p => getStatus(p) === "Expired").length;
        }

        if ($("expiringPolicies")) {
            $("expiringPolicies").textContent =
                policies.filter(function (policy) {
                    const expiry = parseDate(getExpiry(policy));

                    if (!expiry || getStatus(policy) !== "Active") {
                        return false;
                    }

                    expiry.setHours(0, 0, 0, 0);

                    return expiry >= today && expiry <= limit;
                }).length;
        }
    }

    // ==========================================
    // SEARCH AND FILTERS
    // ==========================================

    function getFilteredPolicies() {
        const query = ($("policySearch")?.value || "")
            .trim()
            .toLowerCase();

        const status = $("policyStatusFilter")?.value || "All";
        const type = $("policyTypeFilter")?.value || "All";

        return policies.filter(function (policy) {
            const searchable = [
                getPolicyNumber(policy),
                getPolicyCustomerName(policy),
                valueOf(policy, [
                    "vehicleNumber",
                    "vehicle_number"
                ]),
                valueOf(policy, [
                    "insuranceCompany",
                    "insurance_company"
                ]),
                getType(policy)
            ].join(" ").toLowerCase();

            return searchable.includes(query) &&
                (status === "All" || getStatus(policy) === status) &&
                (type === "All" || getType(policy) === type);
        });
    }
        // ==========================================
    // RENDER POLICIES TABLE
    // ==========================================

    function renderPolicies() {
        if (!tableBody) {
            console.error("Policies table body not found.");
            return;
        }

        const filtered = getFilteredPolicies();

        const pageSize = 10;
        const totalPages = Math.max(
            1,
            Math.ceil(filtered.length / pageSize)
        );

        currentPage = Math.min(currentPage, totalPages);

        const start = (currentPage - 1) * pageSize;
        const visible = filtered.slice(start, start + pageSize);

        tableBody.replaceChildren();

        if (visible.length === 0) {
            const row = tableBody.insertRow();
            const cell = row.insertCell();

            cell.colSpan = 8;
            cell.textContent = "No policies found.";
            cell.style.textAlign = "center";

            updateSummary();
            updatePagination(filtered.length, totalPages);
            return;
        }

        visible.forEach(function (policy) {
            const row = tableBody.insertRow();

            // Policy number
            row.insertCell().textContent = getPolicyNumber(policy);

            // Customer name
            row.insertCell().textContent =
                getPolicyCustomerName(policy);

            // Vehicle number
            row.insertCell().textContent = valueOf(policy, [
                "vehicleNumber",
                "vehicle_number",
                "registrationNumber"
            ], "—");

            // Policy type
            row.insertCell().textContent = getType(policy);

            // Start date
            row.insertCell().textContent =
                formatDate(getStartDate(policy));

            // Expiry date
            row.insertCell().textContent =
                formatDate(getExpiry(policy));

            // Premium
            row.insertCell().textContent =
                money(getPremium(policy));

            // Status
            const statusCell = row.insertCell();
            const status = getStatus(policy);

            const statusBadge = document.createElement("span");
            statusBadge.textContent = status;
            statusBadge.className =
                "status-badge " + status.toLowerCase();

            statusCell.appendChild(statusBadge);

            // Actions
            const actionCell = row.insertCell();

            const actions = document.createElement("div");
            actions.className = "customer-actions";

            // PAY / CHECKOUT BUTTON
            const pay = document.createElement("button");

            pay.type = "button";
            pay.className = "table-action";
            pay.textContent = "Pay / Checkout";

            pay.addEventListener("click", function () {
                const policyId = getId(policy);

                console.log(
                    "Checkout clicked. Policy ID:",
                    policyId
                );

                if (!policyId || !/^\d+$/.test(policyId)) {
                    alert("Invalid policy ID. Please check the database.");
                    return;
                }

                window.location.href =
                    `checkout.html?policyId=${encodeURIComponent(policyId)}`;
            });

            // EDIT BUTTON
            const edit = document.createElement("button");

            edit.type = "button";
            edit.className = "table-action";
            edit.textContent = "Edit";

            edit.addEventListener("click", function () {
                editPolicy(policy);
            });

            // DELETE BUTTON
            const remove = document.createElement("button");

            remove.type = "button";
            remove.className = "table-action";
            remove.textContent = "Delete";

            remove.addEventListener("click", function () {
                deletePolicy(policy);
            });

            actions.append(pay, edit, remove);
            actionCell.appendChild(actions);
        });

        updateSummary();
        updatePagination(filtered.length, totalPages);
    }

    // ==========================================
    // PAGINATION
    // ==========================================

    function updatePagination(totalRecords, totalPages) {
        const pageInfo = $("pageInfo");

        if (pageInfo) {
            pageInfo.textContent =
                `Page ${currentPage} of ${totalPages} (${totalRecords} policies)`;
        }

        const previous = $("previousPage");
        const next = $("nextPage");

        if (previous) {
            previous.disabled = currentPage <= 1;
        }

        if (next) {
            next.disabled = currentPage >= totalPages;
        }
    }

    on("previousPage", "click", function () {
        if (currentPage > 1) {
            currentPage--;
            renderPolicies();
        }
    });

    on("nextPage", "click", function () {
        const totalPages = Math.max(
            1,
            Math.ceil(getFilteredPolicies().length / 10)
        );

        if (currentPage < totalPages) {
            currentPage++;
            renderPolicies();
        }
    });

    // ==========================================
    // EDIT POLICY
    // ==========================================
// ==========================================
// OPEN ADD POLICY FORM
// ==========================================

function openAddForm() {
    editingId = null;

    if (form) {
        form.reset();
    }

    populateCustomers();

    if (formCard) {
        formCard.style.display = "block";
    }

    const submitButton = $("savePolicy");

    if (submitButton) {
        submitButton.textContent = "Save Policy";
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}
    function editPolicy(policy) {
        editingId = getId(policy);

        if (formCard) {
            formCard.style.display = "block";
        }

        if ($("policyCustomer")) {
            $("policyCustomer").value = customerId(policy);
        }

        if ($("policyNumber")) {
            $("policyNumber").value = getPolicyNumber(policy);
        }

        if ($("policyVehicle")) {
            $("policyVehicle").value = valueOf(policy, [
                "vehicleNumber",
                "vehicle_number"
            ]);
        }

        if ($("policyType")) {
            $("policyType").value = getType(policy);
        }

        if ($("policyStartDate")) {
            $("policyStartDate").value =
                getStartDate(policy).slice(0, 10);
        }

        if ($("policyExpiryDate")) {
            $("policyExpiryDate").value =
                getExpiry(policy).slice(0, 10);
        }

        if ($("policyPremium")) {
            $("policyPremium").value = getPremium(policy);
        }

        const submitButton = $("savePolicy");

        if (submitButton) {
            submitButton.textContent = "Update Policy";
        }

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    // ==========================================
    // DELETE POLICY
    // ==========================================

    async function deletePolicy(policy) {
        const id = getId(policy);

        if (!id || !/^\d+$/.test(id)) {
            alert("Invalid policy ID.");
            return;
        }

        const confirmed = confirm(
            "Are you sure you want to delete policy " +
            getPolicyNumber(policy) + "?"
        );

        if (!confirmed) return;

        try {
            const response = await fetch(
                `http://localhost:3000/api/policies/${encodeURIComponent(id)}`,
                {
                    method: "DELETE"
                }
            );

            const result = await response.json();

            if (!response.ok || result.status !== "success") {
                throw new Error(
                    result.message || "Could not delete policy."
                );
            }

            showMessage("Policy deleted successfully.");
            await loadPoliciesFromBackend();

        } catch (error) {
            console.error("Delete policy error:", error);
            showMessage(error.message, true);
        }
    }

    // ==========================================
    // SEARCH AND FILTER EVENTS
    // ==========================================

    on("policySearch", "input", function () {
        currentPage = 1;
        renderPolicies();
    });

    on("policyStatusFilter", "change", function () {
        currentPage = 1;
        renderPolicies();
    });

    on("policyTypeFilter", "change", function () {
        currentPage = 1;
        renderPolicies();
    });
        // ==========================================
    // SAVE POLICY
    // ==========================================

    if (form) {
        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            const policyNumber =
                $("policyNumber")?.value.trim();

            const selectedCustomerId =
                $("policyCustomer")?.value;

            const vehicleNumber =
                $("policyVehicle")?.value.trim();

            const premiumAmount =
                $("policyPremium")?.value;

            const startDate =
                $("policyStartDate")?.value;

            const endDate =
                $("policyExpiryDate")?.value;

            if (
                !policyNumber ||
                !selectedCustomerId ||
                !vehicleNumber ||
                !premiumAmount ||
                !startDate ||
                !endDate
            ) {
                showMessage(
                    "Please fill in all required policy fields.",
                    true
                );
                return;
            }

            const selectedVehicle = vehicles.find(function (vehicle) {
                return (
                    String(vehicle.customer_id) ===
                        String(selectedCustomerId) &&
                    String(vehicle.vehicle_number).toUpperCase() ===
                        vehicleNumber.toUpperCase()
                );
            });

            if (!selectedVehicle) {
                showMessage(
                    "Vehicle not found for this customer.",
                    true
                );
                return;
            }

            const policyData = {
                policy_number: policyNumber,
                customer_id: Number(selectedCustomerId),
                vehicle_id: Number(selectedVehicle.id),
                premium_amount: Number(premiumAmount),
                start_date: startDate,
                end_date: endDate
            };

            try {
                const url = editingId
                    ? `http://localhost:3000/api/policies/${encodeURIComponent(editingId)}`
                    : "http://localhost:3000/api/policies";

                const response = await fetch(url, {
                    method: editingId ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(policyData)
                });

                const result = await response.json();

                if (!response.ok || result.status !== "success") {
                    throw new Error(
                        result.message || "Could not save policy."
                    );
                }

                showMessage(
                    result.message || "Policy saved successfully."
                );

                form.reset();
                editingId = null;

                if (formCard) {
                    formCard.hidden = true;
                }

                await loadPoliciesFromBackend();

            } catch (error) {
                console.error("Policy save failed:", error);

                showMessage(
                    error.message || "Could not save policy.",
                    true
                );
            }
        });
    }

    // ==========================================
    // EXPORT POLICIES TO CSV
    // ==========================================

    function exportPolicies() {
        const filtered = getFilteredPolicies();

        if (!filtered.length) {
            showMessage("No policies available to export.", true);
            return;
        }

        const columns = [
            ["Policy Number", getPolicyNumber],
            ["Customer", getPolicyCustomerName],
            ["Vehicle Number", function (policy) {
                return valueOf(policy, [
                    "vehicleNumber",
                    "vehicle_number"
                ]);
            }],
            ["Policy Type", getType],
            ["Start Date", getStartDate],
            ["Expiry Date", getExpiry],
            ["Premium", getPremium],
            ["Status", getStatus]
        ];

        function csvCell(value) {
            let text = String(value ?? "");

            if (/^[\s]*[=+\-@]/.test(text)) {
                text = "'" + text;
            }

            return '"' + text.replace(/"/g, '""') + '"';
        }

        const csv = [
            columns.map(function (column) {
                return csvCell(column[0]);
            }).join(","),

            ...filtered.map(function (policy) {
                return columns.map(function (column) {
                    return csvCell(column[1](policy));
                }).join(",");
            })
        ].join("\r\n");

        const blob = new Blob(
            ["\uFEFF" + csv],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "popoye-policies.csv";

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        showMessage("Policy CSV export started.");
    }

    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    on("addPolicyBtn", "click", openAddForm);

    on("cancelPolicyBtn", "click", function () {
        if (formCard) {
            formCard.hidden = true;
        }

        if (form) {
            form.reset();
        }

        editingId = null;
    });

    on("exportPoliciesBtn", "click", exportPolicies);

    // Sidebar menu
    const menuToggle = $("menuToggle");
    const sidebar = $("sidebar");

    if (menuToggle && sidebar) {
        menuToggle.addEventListener("click", function () {
            sidebar.classList.toggle("sidebar-open");
        });
    }

    // Logout
    on("logoutBtn", "click", function () {
        localStorage.removeItem(LOGIN_KEY);
        window.location.href = "login.html";
    });

    // Initial data load
    loadPoliciesFromBackend();

});