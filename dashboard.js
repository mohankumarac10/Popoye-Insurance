
"use strict";

document.addEventListener("DOMContentLoaded", function () {
    // ==========================================
    // POPOYE INSURANCE - DASHBOARD
    // Frontend demo using localStorage
    // ==========================================

    const CUSTOMERS_KEY = "popoyeCustomers";
    const POLICIES_KEY = "popoyePolicies";
    const PAYMENTS_KEY = "popoyePayments";
    const LOGIN_KEY = "popoyeLoggedIn";

    // Protect the dashboard from direct access in this demo.
    if (localStorage.getItem(LOGIN_KEY) !== "true") {
        window.location.href = "login.html";
        return;
    }

    const $ = (id) => document.getElementById(id);

    function readData(key) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(value) ? value : [];
        } catch (error) {
            console.error("Unable to read " + key, error);
            return [];
        }
    }

    function firstValue(object, keys, fallback = "") {
        for (const key of keys) {
            if (
                object[key] !== undefined &&
                object[key] !== null &&
                object[key] !== ""
            ) {
                return object[key];
            }
        }
        return fallback;
    }

    function normalizeStatus(value) {
        return String(value || "").trim().toLowerCase();
    }

    function isPaid(payment) {
        const status = normalizeStatus(
            firstValue(payment, ["status", "paymentStatus", "payment_status"])
        );

        return ["paid", "success", "successful", "completed"].includes(status);
    }

    function isPending(payment) {
        const status = normalizeStatus(
            firstValue(payment, ["status", "paymentStatus", "payment_status"])
        );

        return ["pending", "unpaid", "processing"].includes(status);
    }

    function money(value) {
        return Number(value || 0).toLocaleString("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0
        });
    }

    function parseDate(value) {
        if (!value) return null;

        // Support ISO dates and YYYY-MM-DD values.
        const date = new Date(value);

        return Number.isNaN(date.getTime()) ? null : date;
    }

    function getExpiry(policy) {
        return firstValue(policy, [
            "expiryDate",
            "expiry_date",
            "policyExpiry",
            "endDate",
            "end_date"
        ]);
    }

    function getCustomerName(customer) {
        return firstValue(customer, [
            "name",
            "customerName",
            "customer_name",
            "fullName",
            "full_name"
        ], "Unknown Customer");
    }

    function getVehicle(policy) {
        return firstValue(policy, [
            "vehicleNumber",
            "vehicle_number",
            "registrationNumber",
            "registration_number",
            "vehicleNo"
        ], "—");
    }

    function getPaymentCustomer(payment, customers) {
        const name = firstValue(payment, [
            "customerName",
            "customer_name",
            "name"
        ]);

        if (name) return name;

        const customerId = firstValue(payment, [
            "customerId",
            "customer_id"
        ]);

        const customer = customers.find(function (item) {
            return String(firstValue(item, ["id", "customerId", "customer_id"])) ===
                String(customerId);
        });

        return customer ? getCustomerName(customer) : "Unknown Customer";
    }

    const customers = readData(CUSTOMERS_KEY);
    const policies = readData(POLICIES_KEY);
    const payments = readData(PAYMENTS_KEY);

    // ==========================================
    // HEADER
    // ==========================================

    $("currentDate").textContent = new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });

    // ==========================================
    // SUMMARY CARDS
    // ==========================================

    const activePolicies = policies.filter(function (policy) {
        const status = normalizeStatus(
            firstValue(policy, ["status", "policyStatus", "policy_status"])
        );

        return status === "active";
    });

    const expiredPolicies = policies.filter(function (policy) {
        const status = normalizeStatus(
            firstValue(policy, ["status", "policyStatus", "policy_status"])
        );

        const expiry = parseDate(getExpiry(policy));

        return status === "expired" ||
            (expiry && expiry < startOfToday());
    });

    const pendingPolicies = policies.filter(function (policy) {
        const status = normalizeStatus(
            firstValue(policy, ["status", "policyStatus", "policy_status"])
        );

        return ["pending", "upcoming"].includes(status);
    });

    const paidPayments = payments.filter(isPaid);
    const pendingPayments = payments.filter(isPending);

    const collected = paidPayments.reduce(function (total, payment) {
        return total + Number(firstValue(payment, [
            "amount",
            "premiumAmount",
            "premium_amount",
            "paidAmount"
        ], 0));
    }, 0);

    $("totalCustomers").textContent = customers.length;
    $("activePolicies").textContent = activePolicies.length;
    $("premiumCollected").textContent = money(collected);
    $("pendingPayments").textContent = pendingPayments.length;

    // ==========================================
    // POLICY DONUT CHART
    // ==========================================

    const totalPolicies = policies.length;

    $("policyTotal").textContent = totalPolicies;
    $("legendActive").textContent = activePolicies.length;
    $("legendExpired").textContent = expiredPolicies.length;
    $("legendPending").textContent = pendingPolicies.length;

    const activeCount = activePolicies.length;
    const expiredCount = expiredPolicies.length;
    const pendingCount = pendingPolicies.length;
    const otherCount = Math.max(
        0,
        totalPolicies - activeCount - expiredCount - pendingCount
    );

    if (totalPolicies > 0) {
        const activeDegrees = activeCount / totalPolicies * 360;
        const expiredDegrees = expiredCount / totalPolicies * 360;
        const pendingDegrees = pendingCount / totalPolicies * 360;

        $("policyDonut").style.background = `conic-gradient(
            #0D9488 0deg ${activeDegrees}deg,
            #F59E0B ${activeDegrees}deg ${activeDegrees + expiredDegrees}deg,
            #8B9AAF ${activeDegrees + expiredDegrees}deg ${activeDegrees + expiredDegrees + pendingDegrees}deg,
            #DDE5EF ${activeDegrees + expiredDegrees + pendingDegrees}deg 360deg
        )`;
    } else {
        $("policyDonut").style.background =
            "conic-gradient(#DDE5EF 0deg 360deg)";
    }

    // ==========================================
    // PREMIUM COLLECTION BAR CHART
    // ==========================================

    function drawPremiumChart() {
        const canvas = $("premiumChart");
        const context = canvas.getContext("2d");

        const rect = canvas.getBoundingClientRect();
        const width = Math.max(280, rect.width);
        const height = Math.max(220, rect.height);
        const pixelRatio = window.devicePixelRatio || 1;

        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, width, height);

        const today = new Date();
        const months = [];

        for (let i = 5; i >= 0; i--) {
            const date = new Date(
                today.getFullYear(),
                today.getMonth() - i,
                1
            );

            months.push({
                year: date.getFullYear(),
                month: date.getMonth(),
                label: date.toLocaleDateString("en-IN", {
                    month: "short"
                }),
                total: 0
            });
        }

        paidPayments.forEach(function (payment) {
            const dateValue = firstValue(payment, [
                "paymentDate",
                "payment_date",
                "createdAt",
                "created_at",
                "date"
            ]);

            const paymentDate = parseDate(dateValue);

            if (!paymentDate) return;

            const month = months.find(function (item) {
                return item.year === paymentDate.getFullYear() &&
                    item.month === paymentDate.getMonth();
            });

            if (month) {
                month.total += Number(firstValue(payment, [
                    "amount",
                    "premiumAmount",
                    "premium_amount",
                    "paidAmount"
                ], 0));
            }
        });

        const padding = { top: 20, right: 12, bottom: 35, left: 52 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        const maxValue = Math.max(
            1000,
            ...months.map((month) => month.total)
        );
        const step = Math.pow(10, Math.floor(Math.log10(maxValue)));
        const maxAxis = Math.ceil(maxValue / step) * step;

        context.font = "11px Arial";
        context.textBaseline = "middle";

        // Horizontal grid lines and y-axis labels.
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + chartHeight - chartHeight * i / 4;
            const value = maxAxis * i / 4;

            context.beginPath();
            context.strokeStyle = "#E8EEF5";
            context.lineWidth = 1;
            context.moveTo(padding.left, y);
            context.lineTo(width - padding.right, y);
            context.stroke();

            context.fillStyle = "#718096";
            context.textAlign = "right";
            context.fillText(
                value >= 1000
                    ? "₹" + (value / 1000).toLocaleString("en-IN") + "k"
                    : "₹" + value,
                padding.left - 8,
                y
            );
        }

        const slotWidth = chartWidth / months.length;
        const barWidth = Math.min(34, slotWidth * 0.52);

        months.forEach(function (month, index) {
            const barHeight = month.total / maxAxis * chartHeight;
            const x = padding.left + index * slotWidth +
                (slotWidth - barWidth) / 2;
            const y = padding.top + chartHeight - barHeight;

            context.fillStyle = "#0D9488";

            // Rounded bar top.
            const radius = Math.min(5, barWidth / 2, barHeight / 2);

            if (barHeight > 0) {
                context.beginPath();
                context.moveTo(x, y + radius);
                context.arcTo(x, y, x + radius, y, radius);
                context.arcTo(
                    x + barWidth, y,
                    x + barWidth, y + radius, radius
                );
                context.lineTo(x + barWidth, y + barHeight);
                context.lineTo(x, y + barHeight);
                context.closePath();
                context.fill();
            }

            context.fillStyle = "#718096";
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(
                month.label,
                padding.left + index * slotWidth + slotWidth / 2,
                height - padding.bottom + 12
            );
        });

        if (paidPayments.length === 0) {
            context.fillStyle = "#718096";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(
                "Add successful payments to see your collection",
                width / 2,
                padding.top + chartHeight / 2
            );
        }
    }

    drawPremiumChart();

    window.addEventListener("resize", drawPremiumChart);

    // ==========================================
    // UPCOMING RENEWALS
    // ==========================================

    function startOfToday() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    }

    function renderRenewals() {
        const tbody = $("renewalsTable");
        tbody.replaceChildren();

        const today = startOfToday();
        const limit = new Date(today);
        limit.setDate(limit.getDate() + 30);

        const upcoming = policies
            .filter(function (policy) {
                const expiry = parseDate(getExpiry(policy));

                if (!expiry) return false;

                expiry.setHours(0, 0, 0, 0);

                const status = normalizeStatus(
                    firstValue(policy, [
                        "status",
                        "policyStatus",
                        "policy_status"
                    ])
                );

                return expiry >= today &&
                    expiry <= limit &&
                    status !== "expired";
            })
            .sort(function (a, b) {
                return parseDate(getExpiry(a)) - parseDate(getExpiry(b));
            })
            .slice(0, 5);

        if (upcoming.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 3;
            cell.textContent = "No upcoming renewals found.";
            return;
        }

        upcoming.forEach(function (policy) {
            const row = tbody.insertRow();
            const customerName = firstValue(policy, [
                "customerName",
                "customer_name",
                "name"
            ], "Customer");

            const expiry = parseDate(getExpiry(policy));

            [
                customerName,
                getVehicle(policy),
                expiry.toLocaleDateString("en-IN")
            ].forEach(function (value) {
                row.insertCell().textContent = value;
            });
        });
    }

    // ==========================================
    // RECENT PAYMENTS
    // ==========================================

    function renderPayments() {
        const tbody = $("paymentsTable");
        tbody.replaceChildren();

        const recent = [...payments]
            .sort(function (a, b) {
                const dateA = parseDate(firstValue(a, [
                    "paymentDate", "payment_date",
                    "createdAt", "created_at", "date"
                ])) || new Date(0);

                const dateB = parseDate(firstValue(b, [
                    "paymentDate", "payment_date",
                    "createdAt", "created_at", "date"
                ])) || new Date(0);

                return dateB - dateA;
            })
            .slice(0, 5);

        if (recent.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 3;
            cell.textContent = "No payment records found.";
            return;
        }

        recent.forEach(function (payment) {
            const row = tbody.insertRow();
            const name = getPaymentCustomer(payment, customers);
            const amount = money(firstValue(payment, [
                "amount",
                "premiumAmount",
                "premium_amount",
                "paidAmount"
            ], 0));

            const rawStatus = normalizeStatus(
                firstValue(payment, [
                    "status", "paymentStatus", "payment_status"
                ], "pending")
            );

            let label = "Pending";
            let className = "status-pending";

            if (isPaid(payment)) {
                label = "Paid";
                className = "status-paid";
            } else if (["failed", "failure", "cancelled"].includes(rawStatus)) {
                label = "Failed";
                className = "status-failed";
            }

            row.insertCell().textContent = name;
            row.insertCell().textContent = amount;

            const statusCell = row.insertCell();
            const badge = document.createElement("span");
            badge.className = "status-badge " + className;
            badge.textContent = label;
            statusCell.appendChild(badge);
        });
    }

    renderRenewals();
    renderPayments();

    // ==========================================
    // SIDEBAR FOR MOBILE
    // ==========================================

    $("menuToggle").addEventListener("click", function () {
        $("sidebar").classList.toggle("sidebar-open");
    });

    // ==========================================
    // LOGOUT
    // ==========================================

    $("logoutBtn").addEventListener("click", function () {
        localStorage.removeItem(LOGIN_KEY);
        window.location.href = "login.html";
    });
});
