
"use strict";

document.addEventListener("DOMContentLoaded", function () {

    // ================================================
    // POPOYE INSURANCE - REPORTS & ANALYTICS
    // ================================================

    const KEYS = {
        customers: "popoyeCustomers",
        policies: "popoyePolicies",
        payments: "popoyePayments",
        transactions: "popoyeTransactions",
        reminders: "popoyeReminders"
    };

    const $ = id => document.getElementById(id);

    // ================================================
    // LOCAL STORAGE
    // ================================================

    function readData(key) {
        try {
            const data = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error("Unable to read " + key, error);
            return [];
        }
    }

    function getAllData() {
        return {
            customers: readData(KEYS.customers),
            policies: readData(KEYS.policies),
            payments: readData(KEYS.payments),
            transactions: readData(KEYS.transactions),
            reminders: readData(KEYS.reminders)
        };
    }

    // ================================================
    // HELPERS
    // ================================================

    function value(object, fields, fallback = "") {
        for (const field of fields) {
            if (
                object &&
                object[field] !== undefined &&
                object[field] !== null &&
                object[field] !== ""
            ) {
                return object[field];
            }
        }
        return fallback;
    }

    function clean(input) {
        return String(input ?? "").trim();
    }

    function amount(input) {
        const number = Number(String(input ?? 0).replace(/[₹,\s]/g, ""));
        return Number.isFinite(number) ? number : 0;
    }

    function formatDate(input) {
        if (!input) return "";

        const date = new Date(input);

        return Number.isNaN(date.getTime())
            ? String(input)
            : date.toLocaleDateString("en-GB");
    }

    function formatCurrency(input) {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }).format(input);
    }

    function customerId(customer) {
        return clean(value(customer, ["id", "customerId", "customer_id"]));
    }

    function customerName(customer) {
        return clean(value(customer, [
            "name", "customerName", "fullName"
        ], "Unknown Customer"));
    }

    function findCustomer(item, customers) {
        const id = clean(value(item, ["customerId", "customer_id"]));

        if (id) {
            const found = customers.find(c => customerId(c) === id);
            if (found) return found;
        }

        if (item.customer && typeof item.customer === "object") {
            return item.customer;
        }

        return null;
    }

    function getCustomerName(item, customers) {
        const direct = value(item, ["customerName", "customer_name"]);

        if (direct) return clean(direct);

        if (typeof item.customer === "string" && item.customer.trim()) {
            return item.customer.trim();
        }

        const customer = findCustomer(item, customers);

        return customer ? customerName(customer) : "Unknown Customer";
    }

    function getVehicle(item) {
        return clean(value(item, [
            "vehicleNumber",
            "vehicleNo",
            "vehicle_number",
            "registrationNumber"
        ]));
    }

    function getPolicyNumber(item) {
        return clean(value(item, [
            "policyNumber", "policyNo", "policyId", "id"
        ]));
    }

    function getPremium(item) {
        return amount(value(item, [
            "premium", "premiumAmount", "amount", "totalPremium"
        ], 0));
    }

    function getPaymentAmount(item) {
        return amount(value(item, [
            "amount",
            "premiumAmount",
            "premium",
            "paidAmount",
            "totalAmount"
        ], 0));
    }

    function getPaymentStatus(item) {
        return clean(value(item, ["status", "paymentStatus"], "Pending"))
            .toLowerCase();
    }

    function isPaid(item) {
        return [
            "paid", "success", "successful", "completed", "captured"
        ].includes(getPaymentStatus(item));
    }

    function isFailed(item) {
        return [
            "failed", "failure", "cancelled", "canceled", "rejected"
        ].includes(getPaymentStatus(item));
    }

    function isPending(item) {
        return !isPaid(item) && !isFailed(item);
    }

    function getPolicyStatus(policy) {
        const status = clean(policy.status).toLowerCase();

        if (status) {
            return status.charAt(0).toUpperCase() + status.slice(1);
        }

        const rawExpiry = value(policy, ["expiryDate", "endDate"]);

        if (rawExpiry) {
            const expiry = new Date(rawExpiry);

            if (!Number.isNaN(expiry.getTime())) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                expiry.setHours(0, 0, 0, 0);

                if (expiry < today) return "Expired";
            }
        }

        return "Active";
    }

    function escapeHTML(input) {
        return String(input ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    // ================================================
    // REPORT PERIOD FILTER
    // ================================================

    function getPeriod() {
        return $("reportPeriod")?.value || "all";
    }

    function getRecordDate(item) {
        return value(item, [
            "date",
            "createdAt",
            "createdDate",
            "paymentDate",
            "transactionDate",
            "startDate",
            "issuedDate"
        ]);
    }

    function matchesPeriod(item) {
        const period = getPeriod();

        if (period === "all") return true;

        const rawDate = getRecordDate(item);
        if (!rawDate) return false;

        const date = new Date(rawDate);
        if (Number.isNaN(date.getTime())) return false;

        const now = new Date();

        if (period === "month") {
            return date.getMonth() === now.getMonth() &&
                date.getFullYear() === now.getFullYear() &&
                date <= now;
        }

        if (period === "last30") {
            const start = new Date(now);
            start.setDate(start.getDate() - 30);
            start.setHours(0, 0, 0, 0);

            return date >= start && date <= now;
        }

        if (period === "year") {
            return date.getFullYear() === now.getFullYear() &&
                date <= now;
        }

        return true;
    }

    function getFilteredData() {
        const data = getAllData();

        return {
            ...data,
            customers: data.customers.filter(matchesPeriod),
            policies: data.policies.filter(matchesPeriod),
            payments: data.payments.filter(matchesPeriod),
            transactions: data.transactions.filter(matchesPeriod),
            reminders: data.reminders.filter(matchesPeriod)
        };
    }

    // ================================================
    // BUILD REPORT TABLE
    // ================================================

    function buildReport(data) {
        const type = $("reportType")?.value || "overview";

        let headers = [];
        let rows = [];
        let filename = "popoye-business-report.csv";

        if (type === "customers") {
            headers = [
                "Customer ID", "Customer Name", "Phone", "Email",
                "Vehicle Number", "Address", "Created Date"
            ];

            rows = data.customers.map(customer => [
                customerId(customer),
                customerName(customer),
                value(customer, ["phone", "mobile", "phoneNumber"]),
                value(customer, ["email"]),
                getVehicle(customer),
                value(customer, ["address"]),
                formatDate(getRecordDate(customer))
            ]);

            filename = "popoye-customer-report.csv";

        } else if (type === "policies") {
            headers = [
                "Policy Number", "Customer Name", "Vehicle Number",
                "Policy Type", "Start Date", "Expiry Date",
                "Premium (INR)", "Status"
            ];

            rows = data.policies.map(policy => [
                getPolicyNumber(policy),
                getCustomerName(policy, data.customers),
                getVehicle(policy),
                value(policy, ["policyType", "insuranceType", "type"]),
                formatDate(value(policy, ["startDate", "issuedDate"])),
                formatDate(value(policy, ["expiryDate", "endDate"])),
                getPremium(policy),
                getPolicyStatus(policy)
            ]);

            filename = "popoye-policy-report.csv";

        } else if (type === "payments") {
            headers = [
                "Payment Reference", "Customer Name", "Vehicle Number",
                "Payment Method", "Payment Date", "Amount (INR)", "Status"
            ];

            rows = data.payments.map(payment => [
                value(payment, ["referenceId", "transactionId", "paymentId", "id"]),
                getCustomerName(payment, data.customers),
                getVehicle(payment),
                value(payment, ["method", "paymentMethod", "mode"]),
                formatDate(getRecordDate(payment)),
                getPaymentAmount(payment),
                value(payment, ["status", "paymentStatus"], "Pending")
            ]);

            filename = "popoye-payment-report.csv";

        } else if (type === "transactions") {
            headers = [
                "Transaction ID", "Customer Name", "Payment Method",
                "Transaction Date", "Amount (INR)", "Status"
            ];

            const transactions = data.transactions.length
                ? data.transactions
                : data.payments;

            rows = transactions.map(transaction => [
                value(transaction, ["transactionId", "referenceId", "paymentId", "id"]),
                getCustomerName(transaction, data.customers),
                value(transaction, ["method", "paymentMethod", "mode"]),
                formatDate(getRecordDate(transaction)),
                getPaymentAmount(transaction),
                value(transaction, ["status", "paymentStatus"], "Pending")
            ]);

            filename = "popoye-transaction-report.csv";

        } else if (type === "reminders") {
            headers = [
                "Customer Name", "Phone", "Vehicle Number", "Policy Number",
                "Expiry Date", "Premium (INR)", "Reminder Status"
            ];

            rows = data.reminders.map(reminder => [
                getCustomerName(reminder, data.customers),
                value(reminder, ["phone", "mobile"]),
                getVehicle(reminder),
                value(reminder, ["policyNumber", "policyNo"]),
                formatDate(value(reminder, ["expiryDate", "policyExpiryDate"])),
                amount(value(reminder, ["premium", "premiumAmount"], 0)),
                value(reminder, ["status", "reminderStatus"], "Scheduled")
            ]);

            filename = "popoye-reminder-report.csv";

        } else {
            headers = ["Category", "Record Count", "Amount (INR)", "Details"];

            const collected = data.payments
                .filter(isPaid)
                .reduce((sum, payment) => sum + getPaymentAmount(payment), 0);

            const pendingAmount = data.payments
                .filter(isPending)
                .reduce((sum, payment) => sum + getPaymentAmount(payment), 0);

            const failedAmount = data.payments
                .filter(isFailed)
                .reduce((sum, payment) => sum + getPaymentAmount(payment), 0);

            rows = [
                ["Customers", data.customers.length, 0, "Customer records"],
                ["Policies", data.policies.length, 0, "Policy records"],
                [
                    "Active Policies",
                    data.policies.filter(p =>
                        getPolicyStatus(p).toLowerCase() === "active"
                    ).length,
                    0,
                    "Policies currently active"
                ],
                [
                    "Expired Policies",
                    data.policies.filter(p =>
                        getPolicyStatus(p).toLowerCase() === "expired"
                    ).length,
                    0,
                    "Policies that have expired"
                ],
                [
                    "Paid Payments",
                    data.payments.filter(isPaid).length,
                    collected,
                    "Successfully recorded payments"
                ],
                [
                    "Pending Payments",
                    data.payments.filter(isPending).length,
                    pendingAmount,
                    "Awaiting payment confirmation"
                ],
                [
                    "Failed Payments",
                    data.payments.filter(isFailed).length,
                    failedAmount,
                    "Failed or cancelled payments"
                ]
            ];
        }

        return { headers, rows, filename, type };
    }

    // ================================================
    // CSV EXPORT - EXCEL FRIENDLY
    // ================================================

    function exportReport() {
        const data = getFilteredData();
        const report = buildReport(data);

        function csvCell(input) {
            let result = String(input ?? "");

            // Prevent spreadsheet formula injection.
            if (/^[\t\r\n ]*[=+\-@]/.test(result)) {
                result = "'" + result;
            }

            return '"' + result.replace(/"/g, '""') + '"';
        }

        const csvContent = [
            report.headers,
            ...report.rows
        ].map(row =>
            report.headers.map((_, index) =>
                csvCell(row[index])
            ).join(",")
        ).join("\r\n");

        const blob = new Blob(
            ["\uFEFF" + csvContent],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = report.filename;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);

        if ($("reportMessage")) {
            $("reportMessage").textContent =
                "CSV downloaded successfully: " + report.filename;
        }
    }

    // ================================================
    // SUMMARY CARDS
    // ================================================

    function updateSummary(data) {
        const collected = data.payments
            .filter(isPaid)
            .reduce((sum, payment) => sum + getPaymentAmount(payment), 0);

        const pending = data.payments
            .filter(isPending)
            .reduce((sum, payment) => sum + getPaymentAmount(payment), 0);

        if ($("reportCustomers")) {
            $("reportCustomers").textContent = data.customers.length;
        }

        if ($("reportPolicies")) {
            $("reportPolicies").textContent = data.policies.length;
        }

        if ($("reportCollected")) {
            $("reportCollected").textContent = formatCurrency(collected);
        }

        if ($("reportPendingAmount")) {
            $("reportPendingAmount").textContent = formatCurrency(pending);
        }
    }

    // ================================================
    // REPORT TABLE
    // ================================================

    function updateTable(data) {
        const report = buildReport(data);
        const head = $("reportTableHead");
        const body = $("reportTableBody");

        if (!head || !body) return;

        head.innerHTML = "<tr>" + report.headers
            .map(header => "<th>" + escapeHTML(header) + "</th>")
            .join("") + "</tr>";

        if (!report.rows.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="${report.headers.length}">
                        No records found for the selected report period.
                    </td>
                </tr>
            `;
        } else {
            body.innerHTML = report.rows.map(row =>
                "<tr>" + report.headers.map((_, index) =>
                    "<td>" + escapeHTML(row[index] ?? "") + "</td>"
                ).join("") + "</tr>"
            ).join("");
        }

        if ($("reportTableTitle")) {
            const title = report.type.charAt(0).toUpperCase() +
                report.type.slice(1);

            $("reportTableTitle").textContent =
                title === "Overview" ? "Business Overview" : title + " Report";
        }

        if ($("reportTableDescription")) {
            $("reportTableDescription").textContent =
                report.rows.length + " record(s) in the selected report.";
        }

        if ($("reportMessage")) {
            $("reportMessage").textContent =
                report.rows.length + " record(s) displayed.";
        }
    }

    // ================================================
    // CANVAS CHARTS
    // ================================================

    function updateCharts(data) {
        const active = data.policies.filter(
            p => getPolicyStatus(p).toLowerCase() === "active"
        ).length;

        const expired = data.policies.filter(
            p => getPolicyStatus(p).toLowerCase() === "expired"
        ).length;

        const pendingPolicies = data.policies.filter(
            p => getPolicyStatus(p).toLowerCase() === "pending"
        ).length;

        const paid = data.payments.filter(isPaid).length;
        const pending = data.payments.filter(isPending).length;
        const failed = data.payments.filter(isFailed).length;

        drawCanvasChart("policyChart", [
            { label: "Active", count: active, color: "#0D9488" },
            { label: "Expired", count: expired, color: "#E05252" },
            { label: "Pending", count: pendingPolicies, color: "#E5A000" }
        ]);

        drawCanvasChart("paymentChart", [
            { label: "Paid", count: paid, color: "#0D9488" },
            { label: "Pending", count: pending, color: "#E5A000" },
            { label: "Failed", count: failed, color: "#E05252" }
        ]);

        if ($("policyLegend")) {
            $("policyLegend").textContent =
                `Active: ${active} | Expired: ${expired} | Pending: ${pendingPolicies}`;
        }

        if ($("paymentLegend")) {
            $("paymentLegend").textContent =
                `Paid: ${paid} | Pending: ${pending} | Failed: ${failed}`;
        }
    }

    function drawCanvasChart(canvasId, items) {
        const canvas = $(canvasId);
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        const rect = canvas.getBoundingClientRect();
        const cssWidth = Math.max(rect.width, 280);
        const cssHeight = Math.max(rect.height, 220);
        const pixelRatio = window.devicePixelRatio || 1;

        canvas.width = Math.round(cssWidth * pixelRatio);
        canvas.height = Math.round(cssHeight * pixelRatio);

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, cssWidth, cssHeight);

        const width = cssWidth;
        const height = cssHeight;

        const padding = {
            top: 24,
            right: 18,
            bottom: 42,
            left: 36
        };

        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        const maxValue = Math.max(1, ...items.map(item => item.count));
        const gridLines = 4;

        context.font = "11px Arial";
        context.textAlign = "right";
        context.textBaseline = "middle";

        // Background and horizontal grid lines.
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + chartHeight * i / gridLines;
            const label = Math.round(
                maxValue * (gridLines - i) / gridLines
            );

            context.beginPath();
            context.strokeStyle = "#E3EAF2";
            context.lineWidth = 1;
            context.moveTo(padding.left, y);
            context.lineTo(width - padding.right, y);
            context.stroke();

            context.fillStyle = "#718096";
            context.fillText(String(label), padding.left - 8, y);
        }

        const slotWidth = chartWidth / items.length;
        const barWidth = Math.min(48, slotWidth * 0.52);

        items.forEach((item, index) => {
            const centerX = padding.left + slotWidth * (index + 0.5);
            const barHeight = item.count === 0
                ? 0
                : Math.max(3, chartHeight * item.count / maxValue);

            const x = centerX - barWidth / 2;
            const y = padding.top + chartHeight - barHeight;

            // Rounded bars.
            if (barHeight > 0) {
                const radius = Math.min(7, barWidth / 2, barHeight / 2);

                context.beginPath();
                context.moveTo(x, y + radius);
                context.arcTo(x, y, x + radius, y, radius);
                context.lineTo(x + barWidth - radius, y);
                context.arcTo(
                    x + barWidth, y,
                    x + barWidth, y + radius,
                    radius
                );
                context.lineTo(x + barWidth, y + barHeight);
                context.lineTo(x, y + barHeight);
                context.closePath();

                context.fillStyle = item.color;
                context.fill();
            }

            // Numeric value above each bar.
            context.fillStyle = "#142B4A";
            context.font = "bold 12px Arial";
            context.textAlign = "center";
            context.textBaseline = "bottom";

            context.fillText(
                String(item.count),
                centerX,
                Math.max(padding.top + 12, y - 7)
            );

            // Category label below each bar.
            context.fillStyle = "#526579";
            context.font = "11px Arial";
            context.textAlign = "center";
            context.textBaseline = "top";

            context.fillText(
                item.label,
                centerX,
                padding.top + chartHeight + 12,
                Math.max(slotWidth - 4, 40)
            );
        });

        // Show an empty-state message when no records exist.
        if (items.every(item => item.count === 0)) {
            context.fillStyle = "#718096";
            context.font = "12px Arial";
            context.textAlign = "center";
            context.textBaseline = "middle";

            context.fillText(
                "No data available",
                width / 2,
                height / 2
            );
        }
    }

    // ================================================
    // REFRESH REPORT
    // ================================================

    function refreshReport() {
        const data = getFilteredData();

        updateSummary(data);
        updateCharts(data);
        updateTable(data);
    }

    // ================================================
    // SIDEBAR
    // ================================================

    if ($("menuToggle")) {
        $("menuToggle").addEventListener("click", function () {
            document.body.classList.toggle("sidebar-open");

            const sidebar = $("sidebar") ||
                document.querySelector(".sidebar");

            if (sidebar) {
                sidebar.classList.toggle("active");
            }

            // Recalculate chart dimensions after the layout changes.
            setTimeout(() => {
                updateCharts(getFilteredData());
            }, 250);
        });
    }

    // ================================================
    // EVENT LISTENERS
    // ================================================

    if ($("refreshReport")) {
        $("refreshReport").addEventListener("click", refreshReport);
    }

    if ($("reportPeriod")) {
        $("reportPeriod").addEventListener("change", refreshReport);
    }

    if ($("reportType")) {
        $("reportType").addEventListener("change", refreshReport);
    }

    if ($("exportReport")) {
        $("exportReport").addEventListener("click", exportReport);
    }

    // Redraw charts when the browser window changes size.
    let resizeTimer;

    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);

        resizeTimer = setTimeout(function () {
            updateCharts(getFilteredData());
        }, 150);
    });

    // ================================================
    // INITIALIZE
    // ================================================

    refreshReport();

});
