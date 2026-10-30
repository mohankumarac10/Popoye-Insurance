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
        return String(valueOf(item, ["id", "policyId", "policy_id"]));
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

    function localDateString() {
        const date = new Date();

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
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
    // DISPLAY POLICIES
    // ==========================================

    function renderPolicies() {
        if (!tableBody) return;

        const filtered = getFilteredPolicies();
        const pageSize = Number($("policyPageSize")?.value) || 10;

        const totalPages = Math.max(
            1,
            Math.ceil(filtered.length / pageSize)
        );

        currentPage = Math.min(currentPage, totalPages);

        const startIndex = (currentPage - 1) * pageSize;
        const visible = filtered.slice(
            startIndex,
            startIndex + pageSize
        );

        tableBody.replaceChildren();

        if (visible.length === 0) {
            const row = tableBody.insertRow();
            const cell = row.insertCell();

            cell.colSpan = 8;
            cell.textContent = policies.length === 0
                ? "No policies registered yet. Click Add Policy to begin."
                : "No policies match your search or filters.";
        } else {
            visible.forEach(function (policy) {
                const row = tableBody.insertRow();

                row.insertCell().textContent =
                    getPolicyNumber(policy);

                row.insertCell().textContent =
                    getPolicyCustomerName(policy);

                row.insertCell().textContent = valueOf(policy, [
                    "vehicleNumber",
                    "vehicle_number",
                    "registrationNumber"
                ], "—");

                row.insertCell().textContent = getType(policy);
                row.insertCell().textContent = money(getPremium(policy));
                row.insertCell().textContent = formatDate(getExpiry(policy));

                const statusCell = row.insertCell();
                const badge = document.createElement("span");
                const status = getStatus(policy);

                badge.className = "status-badge " + ({
                    Active: "status-active",
                    Pending: "status-pending",
                    Expired: "status-expired"
                }[status] || "status-pending");

                badge.textContent = status;
                statusCell.appendChild(badge);

                const actionCell = row.insertCell();
                const actions = document.createElement("div");

                actions.className = "customer-actions";

                const edit = document.createElement("button");

                edit.type = "button";
                edit.className = "table-action";
                edit.textContent = "Edit";

                edit.addEventListener("click", function () {
                    openEditForm(getId(policy));
                });

                const remove = document.createElement("button");

                remove.type = "button";
                remove.className = "table-action delete-action";
                remove.textContent = "Delete";

                remove.addEventListener("click", function () {
                    deletePolicy(getId(policy));
                });

                actions.append(edit, remove);
                actionCell.appendChild(actions);
            });
        }

        updateSummary();

        const endIndex = Math.min(
            startIndex + pageSize,
            filtered.length
        );

        if ($("policyPageInfo")) {
            $("policyPageInfo").textContent =
                `Showing ${filtered.length ? startIndex + 1 : 0}–${endIndex} of ${filtered.length} policies`;
        }

        if ($("policyPageNumber")) {
            $("policyPageNumber").textContent =
                `Page ${currentPage} of ${totalPages}`;
        }

        if ($("policyPrevBtn")) {
            $("policyPrevBtn").disabled = currentPage <= 1;
        }

        if ($("policyNextBtn")) {
            $("policyNextBtn").disabled = currentPage >= totalPages;
        }
    }

    // ==========================================
    // ADD POLICY FORM
    // ==========================================

    function openAddForm() {
        if (!form || !formCard) return;

        editingId = null;
        form.reset();

        if ($("policyId")) $("policyId").value = "";
        if ($("policyFormTitle")) {
            $("policyFormTitle").textContent = "Register New Policy";
        }
        if ($("savePolicyBtn")) {
            $("savePolicyBtn").textContent = "Save Policy";
        }
        if ($("policyStatus")) {
            $("policyStatus").value = "Active";
        }

        populateCustomers();

        formCard.hidden = false;
        formCard.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    // ==========================================
    // EDIT POLICY FORM
    // ==========================================

    function openEditForm(id) {
        const policy = policies.find(
            p => getId(p) === String(id)
        );

        if (!policy || !form || !formCard) return;

        editingId = String(id);
        form.reset();

        if ($("policyId")) $("policyId").value = editingId;

        populateCustomers(customerId(policy));

        if ($("policyNumber")) {
            $("policyNumber").value = getPolicyNumber(policy);
        }

        if ($("policyVehicle")) {
            $("policyVehicle").value = valueOf(policy, [
                "vehicleNumber",
                "vehicle_number",
                "registrationNumber"
            ]);
        }

        if ($("policyModel")) {
            $("policyModel").value = valueOf(policy, [
                "vehicleModel",
                "vehicle_model",
                "model"
            ]);
        }

        if ($("insuranceCompany")) {
            $("insuranceCompany").value = valueOf(policy, [
                "insuranceCompany",
                "insurance_company"
            ]);
        }

        if ($("policyType")) $("policyType").value = getType(policy);
        if ($("policyStartDate")) {
            $("policyStartDate").value = getStartDate(policy);
        }
        if ($("policyExpiryDate")) {
            $("policyExpiryDate").value = getExpiry(policy);
        }
        if ($("policyPremium")) {
            $("policyPremium").value = getPremium(policy);
        }
        if ($("policyStatus")) {
            $("policyStatus").value = getStatus(policy);
        }

        if ($("policyFormTitle")) {
            $("policyFormTitle").textContent = "Edit Policy";
        }
        if ($("savePolicyBtn")) {
            $("savePolicyBtn").textContent = "Update Policy";
        }

        formCard.hidden = false;
        formCard.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    // ==========================================
    // SAVE POLICY
    // IMPORTANT: API SAVE/UPDATE IS NOT YET WIRED
    // ==========================================

   
if (form) {
    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const policyNumber = $("policyNumber")?.value.trim();
        const customerId = $("policyCustomer")?.value;
        const vehicleNumber = $("policyVehicle")?.value.trim();
        const premiumAmount = $("policyPremium")?.value;
        const startDate = $("policyStartDate")?.value;
        const endDate = $("policyExpiryDate")?.value;

        if (
            !policyNumber ||
            !customerId ||
            !vehicleNumber ||
            !premiumAmount ||
            !startDate ||
            !endDate
        ) {
            showMessage("Please fill in all required policy fields.", true);
            return;
        }

        const selectedVehicle = vehicles.find(
            vehicle =>
                String(vehicle.customer_id) === String(customerId) &&
                String(vehicle.vehicle_number).toUpperCase() ===
                    vehicleNumber.toUpperCase()
        );

        if (!selectedVehicle) {
            showMessage(
                "Vehicle not found for this customer. Please check the selected vehicle.",
                true
            );
            return;
        }

        const policyData = {
            policy_number: policyNumber,
            customer_id: Number(customerId),
            vehicle_id: Number(selectedVehicle.id),
            premium_amount: Number(premiumAmount),
            start_date: startDate,
            end_date: endDate
        };

        try {
            const url = editingId
                ? `http://localhost:3000/api/policies/${editingId}`
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

            showMessage(result.message || "Policy saved successfully.", false);

            form.reset();
            editingId = null;

            await loadPoliciesFromBackend();

        } catch (error) {
            console.error("Policy save failed:", error);
            showMessage(error.message || "Could not save policy.", true);
        }
    });
}

    // ==========================================
    // DELETE POLICY
    // IMPORTANT: API DELETE IS NOT YET WIRED
    // ==========================================

    async function deletePolicy(id) {
        const policy = policies.find(
            p => getId(p) === String(id)
        );

        if (!policy) return;

        if (!confirm(
            `Delete policy "${getPolicyNumber(policy)}"? This cannot be undone.`
        )) {
            return;
        }

        showMessage(
            "Backend policy deletion is not connected yet.",
            true
        );

        // The next step is to connect this action to DELETE /api/policies/:id.
    }

    // ==========================================
    // EXPORT CSV
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
            ["Vehicle Number", p => valueOf(p, [
                "vehicleNumber",
                "vehicle_number"
            ])],
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
            columns.map(c => csvCell(c[0])).join(","),
            ...filtered.map(policy =>
                columns.map(c => csvCell(c[1](policy))).join(",")
            )
        ].join("\r\n");

        const blob = new Blob(["\uFEFF" + csv], {
            type: "text/csv;charset=utf-8;"
        });

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
        if (formCard) formCard.hidden = true;
        if (form) form.reset();

        editingId = null;
    });

    on("resetPolicyBtn", "click", function () {
        if (editingId) {
            openEditForm(editingId);
        } else {
            if (form) form.reset();

            populateCustomers();

            if ($("policyStatus")) {
                $("policyStatus").value = "Active";
            }
        }
    });

    [
        "policySearch",
        "policyStatusFilter",
        "policyTypeFilter",
        "policyPageSize"
    ].forEach(function (id) {
        const element = $(id);

        if (element) {
            element.addEventListener(
                id === "policySearch" ? "input" : "change",
                function () {
                    currentPage = 1;
                    renderPolicies();
                }
            );
        }
    });

    on("policyPrevBtn", "click", function () {
        if (currentPage > 1) {
            currentPage--;
            renderPolicies();
        }
    });

    on("policyNextBtn", "click", function () {
        const pageSize = Number($("policyPageSize")?.value) || 10;

        const totalPages = Math.max(
            1,
            Math.ceil(getFilteredPolicies().length / pageSize)
        );

        if (currentPage < totalPages) {
            currentPage++;
            renderPolicies();
        }
    });

    on("exportPoliciesBtn", "click", exportPolicies);

    const menuToggle = $("menuToggle");
    const sidebar = $("sidebar");

    if (menuToggle && sidebar) {
        menuToggle.addEventListener("click", function () {
            sidebar.classList.toggle("sidebar-open");
        });
    }

    on("logoutBtn", "click", function () {
        localStorage.removeItem(LOGIN_KEY);
        window.location.href = "login.html";
    });

    // Reload from the backend when another tab changes local state.
    window.addEventListener("storage", function (event) {
        if (
            event.key === "popoyeCustomers" ||
            event.key === "popoyePolicies"
        ) {
            loadPoliciesFromBackend();
        }
    });

    // Initial page load
    loadPoliciesFromBackend();
});