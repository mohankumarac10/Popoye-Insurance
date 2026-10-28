
"use strict";

document.addEventListener("DOMContentLoaded", function () {
    // ==================================================
    // POPOYE INSURANCE - RENEWAL REMINDERS
    // Frontend demo using LocalStorage
    // ==================================================

    const CUSTOMERS_KEY = "popoyeCustomers";
    const POLICIES_KEY = "popoyePolicies";
    const REMINDERS_KEY = "popoyeReminders";
    const SETTINGS_KEY = "popoyeInsuranceSettings";
    const PAGE_SIZE = 10;

    const $ = (id) => document.getElementById(id);

    let allReminders = [];
    let filteredReminders = [];
    let currentPage = 1;

    // ==================================================
    // STORAGE HELPERS
    // ==================================================

    function readArray(key) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(value) ? value : [];
        } catch (error) {
            console.error("Unable to read storage:", key, error);
            return [];
        }
    }

    function saveReminders() {
        localStorage.setItem(REMINDERS_KEY, JSON.stringify(allReminders));
    }

    function readSettings() {
        try {
            return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
        } catch {
            return {};
        }
    }

    function setText(id, value) {
        const element = $(id);
        if (element) element.textContent = value;
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function firstValue(object, keys, fallback = "") {
        for (const key of keys) {
            if (
                object &&
                object[key] !== undefined &&
                object[key] !== null &&
                object[key] !== ""
            ) {
                return object[key];
            }
        }

        return fallback;
    }

    function normalize(value) {
        return String(value ?? "").trim().toLowerCase();
    }

    // ==================================================
    // DATE HELPERS
    // ==================================================

    function parseDate(value) {
        if (!value) return null;

        if (typeof value === "string") {
            const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

            if (match) {
                const date = new Date(
                    Number(match[1]),
                    Number(match[2]) - 1,
                    Number(match[3])
                );

                return Number.isNaN(date.getTime()) ? null : date;
            }
        }

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function todayStart() {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function daysUntil(expiryValue) {
        const expiry = parseDate(expiryValue);
        if (!expiry) return null;

        expiry.setHours(0, 0, 0, 0);

        return Math.round(
            (expiry.getTime() - todayStart().getTime()) / 86400000
        );
    }

    function formatDate(value) {
        const date = parseDate(value);
        if (!date) return "Not available";

        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    // ==================================================
    // CUSTOMER AND POLICY HELPERS
    // ==================================================

    function customerId(customer) {
        return String(firstValue(customer, [
            "id", "customerId", "customer_id"
        ]));
    }

    function customerName(customer) {
        return firstValue(customer, [
            "name", "customerName", "fullName"
        ], "Unknown Customer");
    }

    function customerPhone(customer) {
        return String(firstValue(customer, [
            "phone", "mobile", "phoneNumber", "mobileNumber"
        ]));
    }

    function vehicleNumber(item) {
        return String(firstValue(item, [
            "vehicleNumber", "vehicleNo", "vehicle_number",
            "registrationNumber", "registrationNo"
        ]));
    }

    function policyNumber(policy) {
        return String(firstValue(policy, [
            "policyNumber", "policyNo", "policyId", "id"
        ]));
    }

    function expiryDate(policy) {
        return firstValue(policy, [
            "expiryDate", "endDate", "expiry_date", "policyExpiryDate"
        ]);
    }

    function premiumAmount(policy) {
        const amount = Number(firstValue(policy, [
            "premium", "premiumAmount", "amount", "totalPremium"
        ], 0));

        return Number.isFinite(amount) ? amount : 0;
    }

    function customerForPolicy(policy, customers) {
        const id = String(firstValue(policy, [
            "customerId", "customer_id"
        ]));

        if (id) {
            const match = customers.find(
                customer => customerId(customer) === id
            );

            if (match) return match;
        }

        const directName = firstValue(policy, [
            "customerName", "customer_name"
        ]);

        return {
            id,
            name: directName || "Unknown Customer",
            phone: firstValue(policy, ["phone", "mobile"])
        };
    }

    function policyStatus(policy) {
        const status = normalize(policy.status);

        if (["expired", "lapsed"].includes(status)) return "Expired";
        if (["cancelled", "canceled", "inactive"].includes(status)) {
            return "Inactive";
        }

        const days = daysUntil(expiryDate(policy));

        if (days !== null && days < 0) return "Expired";

        return "Active";
    }

    // ==================================================
    // REMINDER STATUS STORAGE
    // ==================================================

    function loadExistingReminders() {
        return readArray(REMINDERS_KEY);
    }

    function reminderKey(item) {
        return String(item.policyNumber || item.policyNo || item.policyId || "");
    }

    function createReminderFromPolicy(policy, customers, existing) {
        const customer = customerForPolicy(policy, customers);
        const number = policyNumber(policy);
        const saved = existing.find((item) =>
            reminderKey(item) === number
        );

        return {
            id: saved?.id || number,
            policyNumber: number,
            customerId: customerId(customer),
            customerName: customerName(customer),
            phone: customerPhone(customer) || customerPhone(policy),
            vehicleNumber: vehicleNumber(policy),
            expiryDate: expiryDate(policy),
            premium: premiumAmount(policy),
            status: saved?.status || "Pending",
            contactedAt: saved?.contactedAt || "",
            renewedAt: saved?.renewedAt || ""
        };
    }

    function loadReminders() {
        const customers = readArray(CUSTOMERS_KEY);
        const policies = readArray(POLICIES_KEY);
        const existing = loadExistingReminders();

        const policyReminders = policies
            .filter(policy => expiryDate(policy))
            .filter(policy => policyStatus(policy) !== "Inactive")
            .map(policy =>
                createReminderFromPolicy(policy, customers, existing)
            );

        // Keep previously saved reminders if their policy is no longer
        // in the policy list, so the user's follow-up status is preserved.
        const policyNumbers = new Set(
            policyReminders.map(reminderKey)
        );

        const standaloneReminders = existing.filter(reminder =>
            !policyNumbers.has(reminderKey(reminder))
        );

        allReminders = [...policyReminders, ...standaloneReminders];

        saveReminders();
    }

    // ==================================================
    // FILTERING
    // ==================================================

    function getExpiryLimit() {
        const value = $("reminderDays")?.value || "30";

        if (value === "all") return Infinity;

        const days = Number(value);
        return Number.isFinite(days) ? days : 30;
    }

    function matchesExpiryLimit(reminder) {
        const days = daysUntil(reminder.expiryDate);
        const limit = getExpiryLimit();

        // Include expired policies even when the user selects 7/15/30 days.
        if (days !== null && days < 0) return true;

        return days !== null && days <= limit;
    }

    function matchesSearch(reminder) {
        const search = normalize($("reminderSearch")?.value);

        if (!search) return true;

        return [
            reminder.customerName,
            reminder.phone,
            reminder.vehicleNumber,
            reminder.policyNumber
        ].some(value => normalize(value).includes(search));
    }

    function matchesStatus(reminder) {
        const selected = $("reminderStatusFilter")?.value || "";

        if (!selected) return true;

        return normalize(reminder.status) === normalize(selected);
    }

    function applyFilters() {
        filteredReminders = allReminders
            .filter(matchesExpiryLimit)
            .filter(matchesSearch)
            .filter(matchesStatus)
            .sort((a, b) => {
                const aDays = daysUntil(a.expiryDate) ?? Infinity;
                const bDays = daysUntil(b.expiryDate) ?? Infinity;
                return aDays - bDays;
            });

        const totalPages = Math.max(
            1,
            Math.ceil(filteredReminders.length / PAGE_SIZE)
        );

        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        renderTable();
        updatePagination();
    }

    // ==================================================
    // SUMMARY CARDS
    // ==================================================

    function updateStats() {
        const dueSoon = allReminders.filter(reminder => {
            const days = daysUntil(reminder.expiryDate);
            return days !== null && days >= 0 && days <= 30 &&
                reminder.status !== "Renewed";
        }).length;

        const expired = allReminders.filter(reminder => {
            const days = daysUntil(reminder.expiryDate);
            return days !== null && days < 0 &&
                reminder.status !== "Renewed";
        }).length;

        const contacted = allReminders.filter(reminder =>
            reminder.status === "Contacted"
        ).length;

        const followup = allReminders.filter(reminder =>
            reminder.status === "Pending" &&
            reminder.status !== "Renewed"
        ).length;

        setText("dueSoonCount", dueSoon);
        setText("expiredCount", expired);
        setText("contactedCount", contacted);
        setText("followupCount", followup);
    }

    // ==================================================
    // TABLE RENDERING
    // ==================================================

    function statusBadge(status) {
        const safeStatus = escapeHTML(status || "Pending");
        const cssStatus = normalize(status).replace(/[^a-z]/g, "");

        return `<span class="status-badge status-${cssStatus}">${safeStatus}</span>`;
    }

    function daysLabel(days) {
        if (days === null) return "Unknown";
        if (days < 0) return `${Math.abs(days)} days overdue`;
        if (days === 0) return "Expires today";
        return `${days} days`;
    }

    function renderTable() {
        const tbody = $("remindersTableBody");
        if (!tbody) return;

        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = filteredReminders.slice(start, start + PAGE_SIZE);

        if (pageItems.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">
                        No renewal reminders found.
                    </td>
                </tr>
            `;

            setText("reminderMessage", "No reminders match the selected filters.");
            return;
        }

        tbody.innerHTML = pageItems.map((reminder) => {
            const days = daysUntil(reminder.expiryDate);
            const phone = String(reminder.phone || "").replace(/\D/g, "");

            const whatsappUrl = phone
                ? `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(
                    buildWhatsAppMessage(reminder)
                )}`
                : "";

            const canContact = Boolean(whatsappUrl);
            const isRenewed = reminder.status === "Renewed";

            return `
                <tr>
                    <td>
                        <strong>${escapeHTML(reminder.customerName)}</strong>
                    </td>
                    <td>${escapeHTML(reminder.phone || "Not available")}</td>
                    <td>${escapeHTML(reminder.vehicleNumber || "—")}</td>
                    <td>${escapeHTML(reminder.policyNumber || "—")}</td>
                    <td>${escapeHTML(formatDate(reminder.expiryDate))}</td>
                    <td>${escapeHTML(daysLabel(days))}</td>
                    <td>${statusBadge(reminder.status)}</td>
                    <td>
                        <div class="table-actions">
                            ${
                                canContact && !isRenewed
                                    ? `<a class="secondary-btn"
                                          href="${whatsappUrl}"
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          data-action="whatsapp"
                                          data-policy="${escapeHTML(reminder.policyNumber)}">
                                          WhatsApp
                                       </a>`
                                    : ""
                            }

                            ${
                                reminder.status === "Pending"
                                    ? `<button class="secondary-btn"
                                          type="button"
                                          data-action="contacted"
                                          data-policy="${escapeHTML(reminder.policyNumber)}">
                                          Mark Contacted
                                       </button>`
                                    : ""
                            }

                            ${
                                !isRenewed
                                    ? `<button class="secondary-btn"
                                          type="button"
                                          data-action="renewed"
                                          data-policy="${escapeHTML(reminder.policyNumber)}">
                                          Mark Renewed
                                       </button>`
                                    : ""
                            }
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        setText(
            "reminderMessage",
            `${filteredReminders.length} reminder(s) found. WhatsApp messages are prepared for review, not sent automatically.`
        );
    }

    // ==================================================
    // WHATSAPP MESSAGE
    // ==================================================

    function buildWhatsAppMessage(reminder) {
        const settings = readSettings();
        const businessName = settings.businessName || "Popoye Insurance";
        const expiry = formatDate(reminder.expiryDate);
        const premium = new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }).format(Number(reminder.premium) || 0);

        return [
            `Hello ${reminder.customerName},`,
            "",
            `Greetings from ${businessName}.`,
            "",
            "This is a reminder about your two-wheeler insurance renewal.",
            `Vehicle Number: ${reminder.vehicleNumber || "Not available"}`,
            `Policy Number: ${reminder.policyNumber || "Not available"}`,
            `Policy Expiry Date: ${expiry}`,
            `Premium Amount: ${premium}`,
            "",
            "Please contact us to renew your policy and avoid a lapse in coverage.",
            "",
            "Thank you,",
            businessName
        ].join("\n");
    }

    // ==================================================
    // REMINDER ACTIONS
    // ==================================================

    function updateReminderStatus(policyNumberValue, status) {
        const reminder = allReminders.find(item =>
            String(item.policyNumber) === String(policyNumberValue)
        );

        if (!reminder) {
            setText("reminderMessage", "Reminder record not found.");
            return;
        }

        reminder.status = status;

        if (status === "Contacted") {
            reminder.contactedAt = new Date().toISOString();
        }

        if (status === "Renewed") {
            reminder.renewedAt = new Date().toISOString();
        }

        saveReminders();
        updateStats();
        applyFilters();

        setText(
            "reminderMessage",
            `${reminder.customerName}: reminder marked as ${status.toLowerCase()}.`
        );
    }

    const remindersTableBody = $("remindersTableBody");

    if (remindersTableBody) {
        remindersTableBody.addEventListener("click", function (event) {
            const button = event.target.closest("[data-action]");
            if (!button) return;

            const action = button.dataset.action;
            const policy = button.dataset.policy;

            if (action === "contacted") {
                updateReminderStatus(policy, "Contacted");
            }

            if (action === "renewed") {
                const confirmed = window.confirm(
                    "Mark this policy as renewed in the reminder list?"
                );

                if (confirmed) {
                    updateReminderStatus(policy, "Renewed");
                }
            }

            // Clicking WhatsApp opens the prepared message. This only marks
            // the reminder contacted after the user confirms they contacted
            // the customer, rather than pretending a message was sent.
            if (action === "whatsapp") {
                const reminder = allReminders.find(item =>
                    String(item.policyNumber) === String(policy)
                );

                if (reminder) {
                    const confirmed = window.confirm(
                        "After reviewing the WhatsApp message, mark this reminder as contacted?"
                    );

                    if (confirmed) {
                        updateReminderStatus(policy, "Contacted");
                    }
                }
            }
        });
    }

    // ==================================================
    // PAGINATION
    // ==================================================

    function updatePagination() {
        const total = filteredReminders.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
        const end = Math.min(currentPage * PAGE_SIZE, total);

        setText("reminderPageInfo", `Showing ${start}-${end} of ${total} records`);
        setText("reminderPageNumber", `Page ${currentPage} of ${totalPages}`);

        if ($("reminderPrevPage")) {
            $("reminderPrevPage").disabled = currentPage <= 1;
        }

        if ($("reminderNextPage")) {
            $("reminderNextPage").disabled = currentPage >= totalPages;
        }
    }

    if ($("reminderPrevPage")) {
        $("reminderPrevPage").addEventListener("click", function () {
            if (currentPage > 1) {
                currentPage--;
                applyFilters();
            }
        });
    }

    if ($("reminderNextPage")) {
        $("reminderNextPage").addEventListener("click", function () {
            const totalPages = Math.max(
                1,
                Math.ceil(filteredReminders.length / PAGE_SIZE)
            );

            if (currentPage < totalPages) {
                currentPage++;
                applyFilters();
            }
        });
    }

    // ==================================================
    // FILTER EVENTS
    // ==================================================

    if ($("reminderDays")) {
        $("reminderDays").addEventListener("change", function () {
            currentPage = 1;
            applyFilters();
        });
    }

    if ($("reminderSearch")) {
        $("reminderSearch").addEventListener("input", function () {
            currentPage = 1;
            applyFilters();
        });
    }

    if ($("reminderStatusFilter")) {
        $("reminderStatusFilter").addEventListener("change", function () {
            currentPage = 1;
            applyFilters();
        });
    }

    // ==================================================
    // REFRESH BUTTON
    // ==================================================

    if ($("refreshReminders")) {
        $("refreshReminders").addEventListener("click", function () {
            loadReminders();
            updateStats();
            currentPage = 1;
            applyFilters();

            setText("reminderMessage", "Renewal reminders refreshed.");
        });
    }

    // ==================================================
    // SIDEBAR MENU
    // ==================================================

    if ($("menuToggle")) {
        $("menuToggle").addEventListener("click", function () {
            const sidebar = $("sidebar");

            if (sidebar) {
                sidebar.classList.toggle("active");
            }

            document.body.classList.toggle("sidebar-open");
        });
    }

    document.querySelectorAll(".sidebar-nav a").forEach((link) => {
        link.addEventListener("click", function () {
            $("sidebar")?.classList.remove("active");
            document.body.classList.remove("sidebar-open");
        });
    });

    // ==================================================
    // INITIALIZE
    // ==================================================

    loadReminders();
    updateStats();
    applyFilters();
});
