
"use strict";

document.addEventListener("DOMContentLoaded", function () {
    // ==========================================
    // POPOYE INSURANCE - POLICIES MODULE
    // ==========================================

    const POLICIES_KEY = "popoyePolicies";
    const CUSTOMERS_KEY = "popoyeCustomers";
    const LOGIN_KEY = "popoyeLoggedIn";

    if (localStorage.getItem(LOGIN_KEY) !== "true") {
        window.location.href = "login.html";
        return;
    }

    const $ = id => document.getElementById(id);

    const form = $("policyForm");
    const formCard = $("policyFormCard");
    const tableBody = $("policiesTableBody");
    const message = $("policyMessage");

    let policies = readArray(POLICIES_KEY);
    let customers = readArray(CUSTOMERS_KEY);
    let currentPage = 1;
    let editingId = null;
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

    function savePolicies() {
        try {
            localStorage.setItem(POLICIES_KEY, JSON.stringify(policies));
            return true;
        } catch (error) {
            console.error("Unable to save policies", error);
            showMessage("Unable to save policies. Check browser storage.", true);
            return false;
        }
    }

    function makeId() {
        if (window.crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }

        return "POL-" + Date.now() + "-" +
            Math.random().toString(36).slice(2, 8);
    }

    function valueOf(item, keys, fallback = "") {
        for (const key of keys) {
            if (item[key] !== undefined && item[key] !== null &&
                item[key] !== "") {
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
            "customerId", "customer_id", "customer"
        ]));
    }

    function getCustomerName(customer) {
        return valueOf(customer, [
            "name", "customerName", "customer_name", "fullName"
        ], "Unknown Customer");
    }

    function getPolicyCustomerName(policy) {
        const savedName = valueOf(policy, [
            "customerName", "customer_name"
        ]);

        if (savedName) return savedName;

        const customer = customers.find(c =>
            String(valueOf(c, ["id", "customerId", "customer_id"])) ===
            customerId(policy)
        );

        return customer ? getCustomerName(customer) : "Unknown Customer";
    }

    function getPolicyNumber(policy) {
        return valueOf(policy, [
            "policyNumber", "policy_number", "number"
        ], "—");
    }

    function getExpiry(policy) {
        return valueOf(policy, [
            "expiryDate", "expiry_date", "policyExpiry", "endDate"
        ]);
    }

    function getStartDate(policy) {
        return valueOf(policy, [
            "startDate", "start_date", "policyStartDate"
        ]);
    }

    function getPremium(policy) {
        return Number(valueOf(policy, [
            "premium", "premiumAmount", "premium_amount", "amount"
        ], 0));
    }

    function getType(policy) {
        return valueOf(policy, ["type", "policyType", "policy_type"], "—");
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
            "status", "policyStatus", "policy_status"
        ], "Active")).toLowerCase();

        if (savedStatus === "pending") return "Pending";

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

        message.textContent = text;
        message.classList.toggle("error", isError);

        messageTimer = setTimeout(() => {
            message.textContent = "";
            message.classList.remove("error");
        }, 4000);
    }

    // ==========================================
    // CUSTOMER DROPDOWN
    // ==========================================

    function populateCustomers(selectedId = "") {
        const select = $("policyCustomer");
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
                "id", "customerId", "customer_id"
            ]));

            option.textContent = getCustomerName(customer) +
                (customer.phone ? " — " + customer.phone : "");

            select.appendChild(option);
        });

        select.value = selectedId;
    }

    function fillVehicleFromCustomer() {
        const id = $("policyCustomer").value;

        const customer = customers.find(c =>
            String(valueOf(c, ["id", "customerId", "customer_id"])) === id
        );

        if (!customer) return;

        $("policyVehicle").value = valueOf(customer, [
            "vehicleNumber", "vehicle_number", "registrationNumber"
        ]);

        $("policyModel").value = valueOf(customer, [
            "vehicleModel", "vehicle_model", "model"
        ]);
    }

    $("policyCustomer").addEventListener("change", fillVehicleFromCustomer);

    // ==========================================
    // STATUS SUMMARY
    // ==========================================

    function updateSummary() {
        const today = startOfToday();
        const limit = new Date(today);
        limit.setDate(limit.getDate() + 30);

        $("totalPolicies").textContent = policies.length;

        $("activePolicies").textContent = policies.filter(
            p => getStatus(p) === "Active"
        ).length;

        $("expiredPolicies").textContent = policies.filter(
            p => getStatus(p) === "Expired"
        ).length;

        $("expiringPolicies").textContent = policies.filter(function (p) {
            const expiry = parseDate(getExpiry(p));

            if (!expiry || getStatus(p) !== "Active") return false;

            expiry.setHours(0, 0, 0, 0);

            return expiry >= today && expiry <= limit;
        }).length;
    }

    // ==========================================
    // FILTERING AND SEARCH
    // ==========================================

    function getFilteredPolicies() {
        const query = $("policySearch").value.trim().toLowerCase();
        const status = $("policyStatusFilter").value;
        const type = $("policyTypeFilter").value;

        return policies.filter(function (policy) {
            const searchable = [
                getPolicyNumber(policy),
                getPolicyCustomerName(policy),
                valueOf(policy, ["vehicleNumber", "vehicle_number"]),
                valueOf(policy, ["insuranceCompany", "insurance_company"]),
                getType(policy)
            ].join(" ").toLowerCase();

            return searchable.includes(query) &&
                (status === "All" || getStatus(policy) === status) &&
                (type === "All" || getType(policy) === type);
        });
    }

    // ==========================================
    // TABLE RENDERING AND PAGINATION
    // ==========================================

    function renderPolicies() {
        const filtered = getFilteredPolicies();
        const pageSize = Number($("policyPageSize").value) || 10;
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

        currentPage = Math.min(currentPage, totalPages);

        const startIndex = (currentPage - 1) * pageSize;
        const visible = filtered.slice(startIndex, startIndex + pageSize);

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

                row.insertCell().textContent = getPolicyNumber(policy);
                row.insertCell().textContent = getPolicyCustomerName(policy);

                row.insertCell().textContent = valueOf(policy, [
                    "vehicleNumber", "vehicle_number", "registrationNumber"
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
                edit.addEventListener("click", () => openEditForm(getId(policy)));

                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "table-action delete-action";
                remove.textContent = "Delete";
                remove.addEventListener("click", () => deletePolicy(getId(policy)));

                actions.append(edit, remove);
                actionCell.appendChild(actions);
            });
        }

        updateSummary();

        const endIndex = Math.min(startIndex + pageSize, filtered.length);

        $("policyPageInfo").textContent =
            `Showing ${filtered.length ? startIndex + 1 : 0}–${endIndex} of ${filtered.length} policies`;

        $("policyPageNumber").textContent =
            `Page ${currentPage} of ${totalPages}`;

        $("policyPrevBtn").disabled = currentPage <= 1;
        $("policyNextBtn").disabled = currentPage >= totalPages;
    }

    // ==========================================
    // ADD POLICY FORM
    // ==========================================

    function openAddForm() {
        editingId = null;
        form.reset();

        $("policyId").value = "";
        $("policyFormTitle").textContent = "Register New Policy";
        $("savePolicyBtn").textContent = "Save Policy";
        $("policyStatus").value = "Active";

        populateCustomers();

        formCard.hidden = false;
        formCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // ==========================================
    // EDIT POLICY FORM
    // ==========================================

    function openEditForm(id) {
        const policy = policies.find(p => getId(p) === String(id));

        if (!policy) return;

        editingId = String(id);
        form.reset();

        $("policyId").value = editingId;

        populateCustomers(customerId(policy));

        $("policyNumber").value = getPolicyNumber(policy);
        $("policyVehicle").value = valueOf(policy, [
            "vehicleNumber", "vehicle_number", "registrationNumber"
        ]);

        $("policyModel").value = valueOf(policy, [
            "vehicleModel", "vehicle_model", "model"
        ]);

        $("insuranceCompany").value = valueOf(policy, [
            "insuranceCompany", "insurance_company"
        ]);

        $("policyType").value = getType(policy);
        $("policyStartDate").value = getStartDate(policy);
        $("policyExpiryDate").value = getExpiry(policy);
        $("policyPremium").value = getPremium(policy);
        $("policyStatus").value = getStatus(policy);

        $("policyFormTitle").textContent = "Edit Policy";
        $("savePolicyBtn").textContent = "Update Policy";

        formCard.hidden = false;
        formCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // ==========================================
    // SAVE POLICY
    // ==========================================

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        customers = readArray(CUSTOMERS_KEY);
        populateCustomers($("policyCustomer").value);

        const selectedCustomerId = $("policyCustomer").value;

        const customer = customers.find(c =>
            String(valueOf(c, ["id", "customerId", "customer_id"])) ===
            selectedCustomerId
        );

        if (!customer) {
            showMessage("Please select an existing customer first.", true);
            return;
        }

        const policyNumber = $("policyNumber").value.trim();
        const startDate = $("policyStartDate").value;
        const expiryDate = $("policyExpiryDate").value;
        const premium = Number($("policyPremium").value);

        if (!policyNumber || !startDate || !expiryDate ||
            !$("policyVehicle").value.trim()) {
            showMessage("Please complete all required fields.", true);
            return;
        }

        if (expiryDate < startDate) {
            showMessage("Expiry date cannot be before the start date.", true);
            return;
        }

        if (!Number.isFinite(premium) || premium <= 0) {
            showMessage("Enter a valid premium amount greater than zero.", true);
            return;
        }

        const duplicate = policies.some(function (policy) {
            return getPolicyNumber(policy).toLowerCase() ===
                policyNumber.toLowerCase() &&
                getId(policy) !== editingId;
        });

        if (duplicate) {
            showMessage("This policy number already exists.", true);
            $("policyNumber").focus();
            return;
        }

        const existing = policies.find(p => getId(p) === editingId);

        let chosenStatus = $("policyStatus").value;

        // Keep expiry-based status accurate unless the policy is pending.
        if (chosenStatus !== "Pending" && expiryDate < localDateString()) {
            chosenStatus = "Expired";
        } else if (chosenStatus === "Expired" && expiryDate >= localDateString()) {
            chosenStatus = "Active";
        }

        const policyData = {
            ...(existing || {}),
            id: editingId || makeId(),
            customerId: selectedCustomerId,
            customerName: getCustomerName(customer),
            policyNumber: policyNumber,
            vehicleNumber: $("policyVehicle").value.trim().toUpperCase(),
            vehicleModel: $("policyModel").value.trim(),
            insuranceCompany: $("insuranceCompany").value.trim(),
            type: $("policyType").value,
            startDate: startDate,
            expiryDate: expiryDate,
            premium: premium,
            status: chosenStatus,
            updatedAt: new Date().toISOString()
        };

        if (existing) {
            policies = policies.map(p =>
                getId(p) === editingId ? policyData : p
            );
        } else {
            policyData.createdAt = new Date().toISOString();
            policies.unshift(policyData);
        }

        if (!savePolicies()) return;

        formCard.hidden = true;
        form.reset();
        editingId = null;
        currentPage = 1;

        renderPolicies();
        showMessage(existing
            ? "Policy updated successfully."
            : "Policy registered successfully.");
    });

    function localDateString() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    // ==========================================
    // DELETE POLICY
    // ==========================================

    function deletePolicy(id) {
        const policy = policies.find(p => getId(p) === String(id));

        if (!policy) return;

        if (!confirm(
            `Delete policy "${getPolicyNumber(policy)}"? This cannot be undone.`
        )) {
            return;
        }

        const previous = policies;
        policies = policies.filter(p => getId(p) !== String(id));

        if (!savePolicies()) {
            policies = previous;
            return;
        }

        renderPolicies();
        showMessage("Policy deleted successfully.");
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
            ["Vehicle Number", p => valueOf(p, ["vehicleNumber", "vehicle_number"])],
            ["Vehicle Model", p => valueOf(p, ["vehicleModel", "vehicle_model"])],
            ["Insurance Company", p => valueOf(p, ["insuranceCompany", "insurance_company"])],
            ["Policy Type", getType],
            ["Start Date", getStartDate],
            ["Expiry Date", getExpiry],
            ["Premium", getPremium],
            ["Status", getStatus]
        ];

        function csvCell(value) {
            let text = String(value ?? "");

            if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;

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

    $("addPolicyBtn").addEventListener("click", openAddForm);

    $("cancelPolicyBtn").addEventListener("click", function () {
        formCard.hidden = true;
        form.reset();
        editingId = null;
    });

    $("resetPolicyBtn").addEventListener("click", function () {
        if (editingId) {
            openEditForm(editingId);
        } else {
            form.reset();
            populateCustomers();
            $("policyStatus").value = "Active";
        }
    });

    ["policySearch", "policyStatusFilter", "policyTypeFilter",
        "policyPageSize"].forEach(function (id) {
        $(id).addEventListener(
            id === "policySearch" ? "input" : "change",
            function () {
                currentPage = 1;
                renderPolicies();
            }
        );
    });

    $("policyPrevBtn").addEventListener("click", function () {
        if (currentPage > 1) {
            currentPage--;
            renderPolicies();
        }
    });

    $("policyNextBtn").addEventListener("click", function () {
        const totalPages = Math.max(1, Math.ceil(
            getFilteredPolicies().length /
            (Number($("policyPageSize").value) || 10)
        ));

        if (currentPage < totalPages) {
            currentPage++;
            renderPolicies();
        }
    });

    $("exportPoliciesBtn").addEventListener("click", exportPolicies);

    $("menuToggle").addEventListener("click", function () {
        $("sidebar").classList.toggle("sidebar-open");
    });

    $("logoutBtn").addEventListener("click", function () {
        localStorage.removeItem(LOGIN_KEY);
        window.location.href = "login.html";
    });

    window.addEventListener("storage", function (event) {
        if (event.key === CUSTOMERS_KEY) {
            customers = readArray(CUSTOMERS_KEY);
            populateCustomers();
        }

        if (event.key === POLICIES_KEY) {
            policies = readArray(POLICIES_KEY);
            renderPolicies();
        }
    });

    populateCustomers();
    renderPolicies();
});
