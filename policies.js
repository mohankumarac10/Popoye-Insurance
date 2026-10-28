"use strict";

document.addEventListener("DOMContentLoaded", function () {
    const API_URL = "http://localhost:3000/api";
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

    let policies = [];
    let customers = [];
    let currentPage = 1;
    let editingId = null;
    let messageTimer;

    function valueOf(item, keys, fallback = "") {
        for (const key of keys) {
            if (item[key] !== undefined &&
                item[key] !== null &&
                item[key] !== "") {
                return item[key];
            }
        }
        return fallback;
    }

    function getId(policy) {
        return String(valueOf(policy, ["id", "policy_id"], ""));
    }

    function customerId(policy) {
        return String(valueOf(policy, ["customer_id", "customerId"], ""));
    }

    function getCustomerName(customer) {
        return valueOf(customer, [
            "full_name", "fullName", "name", "customerName"
        ], "Unknown Customer");
    }

    function getPolicyCustomerName(policy) {
        const savedName = valueOf(policy, [
            "full_name", "customer_name", "customerName"
        ]);

        if (savedName) return savedName;

        const customer = customers.find(c =>
            String(valueOf(c, ["id", "customer_id"])) ===
            customerId(policy)
        );

        return customer ? getCustomerName(customer) : "Unknown Customer";
    }

    function getPolicyNumber(policy) {
        return valueOf(policy, ["policy_number", "policyNumber"], "—");
    }

    function getExpiry(policy) {
        return valueOf(policy, [
            "end_date", "expiryDate", "expiry_date"
        ]);
    }

    function getStartDate(policy) {
        return valueOf(policy, ["start_date", "startDate"]);
    }

    function getPremium(policy) {
        return Number(valueOf(policy, [
            "premium_amount", "premium", "premiumAmount"
        ], 0));
    }

    function getType(policy) {
        return valueOf(policy, [
            "insurance_type", "policy_type", "policyType", "type"
        ], "—");
    }

    function parseDate(value) {
        if (!value) return null;

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatDate(value) {
        if (!value) return "—";

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

    function getStatus(policy) {
        const expiry = parseDate(getExpiry(policy));

        if (!expiry) return "Pending";

        expiry.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return expiry < today ? "Expired" : "Active";
    }

    async function loadPoliciesFromAPI() {
        try {
            const [policyResponse, customerResponse] =
                await Promise.all([
                    fetch(`${API_URL}/policies`),
                    fetch(`${API_URL}/customers`)
                ]);

            if (!policyResponse.ok || !customerResponse.ok) {
                throw new Error("API request failed");
            }

            const policyData = await policyResponse.json();
            const customerData = await customerResponse.json();

            policies = policyData.policies || [];
            customers = customerData.customers || [];

            populateCustomers();
            renderPolicies();
        } catch (error) {
            console.error("Policies loading error:", error);
            showMessage(
                "Could not load policies. Check the backend server.",
                true
            );
        }
    }
        // Populate customer dropdown from MySQL API data
    function populateCustomers(selectedId = "") {
        const select = $("policyCustomer");
        select.replaceChildren();

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = customers.length
            ? "Select a customer"
            : "Add a customer first";

        select.appendChild(placeholder);

        customers.forEach(customer => {
            const option = document.createElement("option");
            option.value = String(customer.id);
            option.textContent =
                getCustomerName(customer) +
                (customer.phone ? " — " + customer.phone : "");

            select.appendChild(option);
        });

        select.value = String(selectedId);
    }

    // Fill vehicle details when a customer is selected
    function fillVehicleFromCustomer() {
        const selectedId = $("policyCustomer").value;

        const customer = customers.find(c =>
            String(c.id) === selectedId
        );

        if (!customer) return;

        $("policyVehicle").value =
            customer.vehicle_number || customer.vehicleNumber || "";

        if ($("policyModel")) {
            $("policyModel").value =
                customer.vehicle_model || customer.vehicleModel || "";
        }
    }

    $("policyCustomer").addEventListener(
        "change",
        fillVehicleFromCustomer
    );

    // Update policy summary cards
    function updateSummary() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const limit = new Date(today);
        limit.setDate(limit.getDate() + 30);

        $("totalPolicies").textContent = policies.length;

        $("activePolicies").textContent =
            policies.filter(p => getStatus(p) === "Active").length;

        $("expiredPolicies").textContent =
            policies.filter(p => getStatus(p) === "Expired").length;

        $("expiringPolicies").textContent = policies.filter(p => {
            const expiry = parseDate(getExpiry(p));

            if (!expiry || getStatus(p) !== "Active") return false;

            expiry.setHours(0, 0, 0, 0);
            return expiry >= today && expiry <= limit;
        }).length;
    }

    // Search and filter policies
    function getFilteredPolicies() {
        const query = $("policySearch").value.trim().toLowerCase();
        const status = $("policyStatusFilter").value;
        const type = $("policyTypeFilter").value;

        return policies.filter(policy => {
            const searchable = [
                getPolicyNumber(policy),
                getPolicyCustomerName(policy),
                policy.vehicle_number || "",
                policy.insurance_type || "",
                policy.policy_type || ""
            ].join(" ").toLowerCase();

            const matchesSearch = searchable.includes(query);
            const matchesStatus =
                status === "All" || getStatus(policy) === status;
            const matchesType =
                type === "All" || getType(policy) === type;

            return matchesSearch && matchesStatus && matchesType;
        });
    }

    // Render policies in the table
    function renderPolicies() {
        const filtered = getFilteredPolicies();
        const pageSize = Number($("policyPageSize").value) || 10;
        const totalPages = Math.max(
            1,
            Math.ceil(filtered.length / pageSize)
        );

        currentPage = Math.min(currentPage, totalPages);

        const startIndex = (currentPage - 1) * pageSize;
        const visible = filtered.slice(startIndex, startIndex + pageSize);

        tableBody.replaceChildren();

        if (visible.length === 0) {
            const row = tableBody.insertRow();
            const cell = row.insertCell();

            cell.colSpan = 8;
            cell.textContent = policies.length === 0
                ? "No policies found in the database."
                : "No policies match your search or filters.";
        } else {
            visible.forEach(policy => {
                const row = tableBody.insertRow();

                row.insertCell().textContent = getPolicyNumber(policy);
                row.insertCell().textContent =
                    getPolicyCustomerName(policy);
                row.insertCell().textContent =
                    policy.vehicle_number || "—";
                row.insertCell().textContent = getType(policy);
                row.insertCell().textContent =
                    money(getPremium(policy));
                row.insertCell().textContent =
                    formatDate(getExpiry(policy));

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
                edit.addEventListener("click", () => {
                    openEditForm(policy.id);
                });

                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "table-action delete-action";
                remove.textContent = "Delete";
                remove.addEventListener("click", () => {
                    deletePolicy(policy.id);
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

        $("policyPageInfo").textContent =
            `Showing ${filtered.length ? startIndex + 1 : 0}–${endIndex} of ${filtered.length} policies`;

        $("policyPageNumber").textContent =
            `Page ${currentPage} of ${totalPages}`;

        $("policyPrevBtn").disabled = currentPage <= 1;
        $("policyNextBtn").disabled = currentPage >= totalPages;
    }
        // Open the form to add a new policy
    function openAddForm() {
        editingId = null;
        form.reset();

        $("policyId").value = "";
        $("policyFormTitle").textContent = "Register New Policy";
        $("savePolicyBtn").textContent = "Save Policy";
        $("policyStatus").value = "Active";

        populateCustomers();
        formCard.hidden = false;

        formCard.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    // Open the form to edit an existing policy
    function openEditForm(id) {
        const policy = policies.find(
            p => String(p.id) === String(id)
        );

        if (!policy) return;

        editingId = String(id);
        form.reset();

        $("policyId").value = editingId;
        populateCustomers(policy.customer_id);

        $("policyNumber").value = policy.policy_number || "";
        $("policyVehicle").value = policy.vehicle_number || "";

        if ($("policyModel")) {
            $("policyModel").value = policy.vehicle_model || "";
        }

        $("insuranceCompany").value =
            policy.insurance_company || "";

        $("policyType").value =
            policy.insurance_type || policy.policy_type || "";

        $("policyStartDate").value =
            String(policy.start_date || "").slice(0, 10);

        $("policyExpiryDate").value =
            String(policy.end_date || "").slice(0, 10);

        $("policyPremium").value = policy.premium_amount || "";
        $("policyStatus").value = getStatus(policy);

        $("policyFormTitle").textContent = "Edit Policy";
        $("savePolicyBtn").textContent = "Update Policy";

        formCard.hidden = false;
        formCard.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    // Save a new policy or update an existing one
    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const selectedCustomerId = $("policyCustomer").value;
        const customer = customers.find(
            c => String(c.id) === selectedCustomerId
        );

        if (!customer) {
            showMessage("Please select a customer first.", true);
            return;
        }

        const policyNumber = $("policyNumber").value.trim();
        const startDate = $("policyStartDate").value;
        const endDate = $("policyExpiryDate").value;
        const premium = Number($("policyPremium").value);
        const vehicleNumber = $("policyVehicle").value.trim();

        if (
            !policyNumber ||
            !startDate ||
            !endDate ||
            !vehicleNumber
        ) {
            showMessage("Complete all required fields.", true);
            return;
        }

        if (endDate < startDate) {
            showMessage(
                "Expiry date cannot be before the start date.",
                true
            );
            return;
        }

        if (!Number.isFinite(premium) || premium <= 0) {
            showMessage("Enter a valid premium amount.", true);
            return;
        }

        const selectedVehicle = vehicleNumber.toUpperCase();

       const vehicleId = await policyVehicleId(selectedVehicle, customer.id);

        if (!vehicleId) {
            showMessage(
                "Could not identify this vehicle in the database.",
                true
            );
            return;
        }

        const payload = {
            policy_number: policyNumber,
            customer_id: Number(customer.id),
            vehicle_id: Number(vehicleId),
            policy_type: $("policyType").value,
            insurance_type: $("policyType").value,
            premium_amount: premium,
            start_date: startDate,
            end_date: endDate,
            notes: ""
        };

        try {
            const url = editingId
                ? `${API_URL}/policies/${editingId}`
                : `${API_URL}/policies`;

            const response = await fetch(url, {
                method: editingId ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error("Please provide all required policy fields");
            }

            formCard.hidden = true;
            form.reset();
            editingId = null;
            currentPage = 1;

            await loadPoliciesFromAPI();
            showMessage("Policy saved successfully.");
        } catch (error) {
            console.error("Policy save failed:", error);
            showMessage(error.message, true);
        }
    });

    // Find the selected vehicle's database ID
    async function policyVehicleId(vehicleNumber, customerId) {
        try {
            const response = await fetch(`${API_URL}/vehicles`);

            if (!response.ok) return null;

            const data = await response.json();
            const vehicles = data.vehicles || [];

            const vehicle = vehicles.find(v =>
                String(v.customer_id) === String(customerId) &&
                String(v.vehicle_number).toUpperCase() === vehicleNumber
            );

            return vehicle ? vehicle.id : null;
        } catch (error) {
            console.error("Vehicle lookup failed:", error);
            return null;
        }
    }
        // Delete a policy from MySQL
    async function deletePolicy(id) {
        const policy = policies.find(
            p => String(p.id) === String(id)
        );

        if (!policy) return;

        const confirmed = confirm(
            `Delete policy "${getPolicyNumber(policy)}"? This cannot be undone.`
        );

        if (!confirmed) return;

        try {
            const response = await fetch(
                `${API_URL}/policies/${id}`,
                { method: "DELETE" }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Could not delete policy."
                );
            }

            await loadPoliciesFromAPI();
            showMessage("Policy deleted successfully.");
        } catch (error) {
            console.error("Policy deletion failed:", error);
            showMessage(error.message, true);
        }
    }

    // Export filtered policies to CSV
    function exportPolicies() {
        const filtered = getFilteredPolicies();

        if (!filtered.length) {
            showMessage("No policies available to export.", true);
            return;
        }

        const columns = [
            ["Policy Number", getPolicyNumber],
            ["Customer", getPolicyCustomerName],
            ["Vehicle Number", p => p.vehicle_number || ""],
            ["Insurance Type", getType],
            ["Premium", getPremium],
            ["Start Date", getStartDate],
            ["Expiry Date", getExpiry],
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
            columns.map(column => csvCell(column[0])).join(","),
            ...filtered.map(policy =>
                columns
                    .map(column => csvCell(column[1](policy)))
                    .join(",")
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
        // Cancel the policy form
    $("cancelPolicyBtn").addEventListener("click", function () {
        formCard.hidden = true;
        form.reset();
        editingId = null;
    });

    // Open the Add Policy form
    $("addPolicyBtn").addEventListener("click", openAddForm);

    // Reset the policy form
    $("resetPolicyBtn").addEventListener("click", function () {
        if (editingId) {
            openEditForm(editingId);
        } else {
            form.reset();
            populateCustomers();
            $("policyStatus").value = "Active";
        }
    });

    // Search and filter
    ["policySearch", "policyStatusFilter",
        "policyTypeFilter", "policyPageSize"].forEach(function (id) {
        $(id).addEventListener(
            id === "policySearch" ? "input" : "change",
            function () {
                currentPage = 1;
                renderPolicies();
            }
        );
    });

    // Previous page
    $("policyPrevBtn").addEventListener("click", function () {
        if (currentPage > 1) {
            currentPage--;
            renderPolicies();
        }
    });

    // Next page
    $("policyNextBtn").addEventListener("click", function () {
        const pageSize = Number($("policyPageSize").value) || 10;
        const totalPages = Math.max(
            1,
            Math.ceil(getFilteredPolicies().length / pageSize)
        );

        if (currentPage < totalPages) {
            currentPage++;
            renderPolicies();
        }
    });

    // Export CSV
    $("exportPoliciesBtn").addEventListener("click", exportPolicies);

    // Mobile sidebar
    $("menuToggle").addEventListener("click", function () {
        $("sidebar").classList.toggle("sidebar-open");
    });

    // Logout
    $("logoutBtn").addEventListener("click", function () {
        localStorage.removeItem("popoyeLoggedIn");
        window.location.href = "login.html";
    });

    // Load policy data from the API when the page opens
    loadPoliciesFromAPI();
});