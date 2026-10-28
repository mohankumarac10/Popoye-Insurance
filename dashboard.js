
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

    const $ = (id) => document.getElementById(id);

    // ==========================================
    // LOGIN PROTECTION
    // ==========================================

    if (localStorage.getItem(LOGIN_KEY) !== "true") {
        window.location.href = "login.html";
        return;
    }

    // ==========================================
    // READ LOCALSTORAGE DATA SAFELY
    // ==========================================

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
        if (!object) return fallback;

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

    function getStatus(object, keys) {
        return normalizeStatus(firstValue(object, keys, ""));
    }

    function money(value) {
        const amount = Number(value || 0);

        return amount.toLocaleString("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0
        });
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

    function formatDate(value) {
        const date = parseDate(value);

        if (!date) return "—";

        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    function getAmount(payment) {
        return Number(firstValue(payment, [
            "amount",
            "premiumAmount",
            "premium_amount",
            "paidAmount"
        ], 0)) || 0;
    }

    // ==========================================
    // DATA FIELD HELPERS
    // ==========================================

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

    function getCustomerId(object) {
        return firstValue(object, [
            "customerId",
            "customer_id"
        ], "");
    }

    function getRecordId(object) {
        return firstValue(object, [
            "id",
            "customerId",
            "customer_id"
        ], "");
    }

    function getVehicle(policy) {
        return firstValue(policy, [
            "vehicleNumber",
            "vehicle_number",
            "registrationNumber",
            "registration_number",
            "vehicleNo",
            "vehicle_no"
        ], "—");
    }

    function findCustomer(customerId, customers) {
        if (customerId === "") return null;

        return customers.find(function (customer) {
            return String(getRecordId(customer)) === String(customerId);
        }) || null;
    }

    function getPolicyCustomerName(policy, customers) {
        const directName = firstValue(policy, [
            "customerName",
            "customer_name",
            "name"
        ]);

        if (directName) return directName;

        const customer = findCustomer(getCustomerId(policy), customers);

        return customer ? getCustomerName(customer) : "Unknown Customer";
    }

    function getPaymentCustomer(payment, customers) {
        const directName = firstValue(payment, [
            "customerName",
            "customer_name",
            "name"
        ]);

        if (directName) return directName;

        const customer = findCustomer(getCustomerId(payment), customers);

        return customer ? getCustomerName(customer) : "Unknown Customer";
    }

    function getPaymentDate(payment) {
        return firstValue(payment, [
            "paymentDate",
            "payment_date",
            "createdAt",
            "created_at",
            "date"
        ]);
    }

    function isPaid(payment) {
        const status = getStatus(payment, [
            "status",
            "paymentStatus",
            "payment_status"
        ]);

        return ["paid", "success", "successful", "completed"].includes(status);
    }

    function isPending(payment) {
        const status = getStatus(payment, [
            "status",
            "paymentStatus",
            "payment_status"
        ]);

        return ["pending", "unpaid", "processing"].includes(status);
    }

    // ==========================================
    // LOAD DATA
    // ==========================================

    const customers = readData(CUSTOMERS_KEY);
    const policies = readData(POLICIES_KEY);
    const payments = readData(PAYMENTS_KEY);

    // ==========================================
    // HEADER AND CURRENT DATE
    // ==========================================

    const dateElement = $("currentDate");

    if (dateElement) {
        dateElement.textContent = new Date().toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    // ==========================================
    // POLICY STATUS CALCULATIONS
    // ==========================================

    const today = startOfToday();

    const activePolicies = policies.filter(function (policy) {
        const status = getStatus(policy, [
            "status",
            "policyStatus",
            "policy_status"
        ]);

        const expiry = parseDate(getExpiry(policy));

        if (status === "expired") return false;
        if (expiry && expiry < today) return false;

        return status === "active";
    });

    const expiredPolicies = policies.filter(function (policy) {
        const status = getStatus(policy, [
            "status",
            "policyStatus",
            "policy_status"
        ]);

        const expiry = parseDate(getExpiry(policy));

        return status === "expired" ||
            Boolean(expiry && expiry < today);
    });

    const pendingPolicies = policies.filter(function (policy) {
        const status = getStatus(policy, [
            "status",
            "policyStatus",
            "policy_status"
        ]);

        return ["pending", "upcoming"].includes(status);
    });

    const paidPayments = payments.filter(isPaid);
    const pendingPayments = payments.filter(isPending);

    const collected = paidPayments.reduce(function (total, payment) {
        return total + getAmount(payment);
    }, 0);

    // ==========================================
    // SUMMARY CARDS
    // ==========================================

    if ($("totalCustomers")) {
        $("totalCustomers").textContent = customers.length;
    }

    if ($("activePolicies")) {
        $("activePolicies").textContent = activePolicies.length;
    }

    if ($("premiumCollected")) {
        $("premiumCollected").textContent = money(collected);
    }

    if ($("pendingPayments")) {
        $("pendingPayments").textContent = pendingPayments.length;
    }

    // ==========================================
    // POLICY DONUT CHART
    // ==========================================

    function drawPolicyDonut() {
        const donut = $("policyDonut");

        if (!donut) return;

        const totalPolicies = policies.length;

        if ($("policyTotal")) {
            $("policyTotal").textContent = totalPolicies;
        }

        if ($("legendActive")) {
            $("legendActive").textContent = activePolicies.length;
        }

        if ($("legendExpired")) {
            $("legendExpired").textContent = expiredPolicies.length;
        }

        if ($("legendPending")) {
            $("legendPending").textContent = pendingPolicies.length;
        }

        if (totalPolicies === 0) {
            donut.style.background =
                "conic-gradient(#DDE5EF 0deg 360deg)";
            return;
        }

        const activeDegrees =
            activePolicies.length / totalPolicies * 360;

        const expiredDegrees =
            expiredPolicies.length / totalPolicies * 360;

        const pendingDegrees =
            pendingPolicies.length / totalPolicies * 360;

        const activeEnd = activeDegrees;
        const expiredEnd = activeEnd + expiredDegrees;
        const pendingEnd = Math.min(
            360,
            expiredEnd + pendingDegrees
        );

        donut.style.background = `conic-gradient(
            #0D9488 0deg ${activeEnd}deg,
            #F59E0B ${activeEnd}deg ${expiredEnd}deg,
            #8B9AAF ${expiredEnd}deg ${pendingEnd}deg,
            #DDE5EF ${pendingEnd}deg 360deg
        )`;
    }

    drawPolicyDonut();

    // ==========================================
    // PREMIUM COLLECTION BAR CHART
    // ==========================================

    function drawPremiumChart() {
        const canvas = $("premiumChart");

        if (!canvas) return;

        const context = canvas.getContext("2d");

        if (!context) return;

        const rect = canvas.getBoundingClientRect();
        const width = Math.max(280, rect.width || 280);
        const height = Math.max(220, rect.height || 220);
        const pixelRatio = window.devicePixelRatio || 1;

        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, width, height);

        // Build the last six calendar months.
        const currentDate = new Date();
        const months = [];

        for (let i = 5; i >= 0; i--) {
            const date = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth() - i,
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

        // Add successful payments to their respective months.
        paidPayments.forEach(function (payment) {
            const paymentDate = parseDate(getPaymentDate(payment));

            if (!paymentDate) return;

            const month = months.find(function (item) {
                return item.year === paymentDate.getFullYear() &&
                    item.month === paymentDate.getMonth();
            });

            if (month) {
                month.total += getAmount(payment);
            }
        });

        const padding = {
            top: 20,
            right: 12,
            bottom: 35,
            left: 52
        };

        const chartWidth = Math.max(
            1,
            width - padding.left - padding.right
        );

        const chartHeight = Math.max(
            1,
            height - padding.top - padding.bottom
        );

        const maxValue = Math.max(
            1000,
            ...months.map(function (month) {
                return month.total;
            })
        );

        const step = Math.pow(
            10,
            Math.floor(Math.log10(maxValue))
        );

        const maxAxis = Math.ceil(maxValue / step) * step;

        context.font = "11px Arial";
        context.textBaseline = "middle";

        // Horizontal grid lines and y-axis labels.
        for (let i = 0; i <= 4; i++) {
            const y = padding.top +
                chartHeight -
                chartHeight * i / 4;

            const value = maxAxis * i / 4;

            context.beginPath();
            context.strokeStyle = "#E8EEF5";
            context.lineWidth = 1;
            context.moveTo(padding.left, y);
            context.lineTo(width - padding.right, y);
            context.stroke();

            context.fillStyle = "#718096";
            context.textAlign = "right";

            const label = value >= 1000
                ? "₹" + (value / 1000).toLocaleString("en-IN") + "k"
                : "₹" + value;

            context.fillText(
                label,
                padding.left - 8,
                y
            );
        }

        const slotWidth = chartWidth / months.length;
        const barWidth = Math.min(34, slotWidth * 0.52);

        months.forEach(function (month, index) {
            const barHeight =
                month.total / maxAxis * chartHeight;

            const x = padding.left +
                index * slotWidth +
                (slotWidth - barWidth) / 2;

            const y = padding.top + chartHeight - barHeight;

            context.fillStyle = "#0D9488";

            // Rounded bar tops.
            const radius = Math.min(
                5,
                barWidth / 2,
                barHeight / 2
            );

            if (barHeight > 0) {
                context.beginPath();
                context.moveTo(x, y + radius);
                context.arcTo(x, y, x + radius, y, radius);
                context.arcTo(
                    x + barWidth,
                    y,
                    x + barWidth,
                    y + radius,
                    radius
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
                padding.left +
                    index * slotWidth +
                    slotWidth / 2,
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

    // Redraw the chart when the browser size changes.
    let resizeTimer;

    window.addEventListener("resize", function () {
        window.clearTimeout(resizeTimer);

        resizeTimer = window.setTimeout(function () {
            drawPremiumChart();
        }, 100);
    });

    // ==========================================
    // UPCOMING RENEWALS TABLE
    // ==========================================

    function renderRenewals() {
        const tbody = $("renewalsTable");

        if (!tbody) return;

        tbody.replaceChildren();

        const today = startOfToday();
        const limit = new Date(today);

        limit.setDate(limit.getDate() + 30);

        const upcoming = policies
            .filter(function (policy) {
                const expiry = parseDate(getExpiry(policy));

                if (!expiry) return false;

                expiry.setHours(0, 0, 0, 0);

                const status = getStatus(policy, [
                    "status",
                    "policyStatus",
                    "policy_status"
                ]);

                return expiry >= today &&
                    expiry <= limit &&
                    status !== "expired";
            })
            .sort(function (a, b) {
                return parseDate(getExpiry(a)) -
                    parseDate(getExpiry(b));
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

            const customerName = getPolicyCustomerName(
                policy,
                customers
            );

            const expiry = getExpiry(policy);

            row.insertCell().textContent = customerName;
            row.insertCell().textContent = getVehicle(policy);
            row.insertCell().textContent = formatDate(expiry);
        });
    }

    // ==========================================
    // RECENT PAYMENTS TABLE
    // ==========================================

    function renderPayments() {
        const tbody = $("paymentsTable");

        if (!tbody) return;

        tbody.replaceChildren();

        const recent = [...payments]
            .sort(function (a, b) {
                const dateA = parseDate(getPaymentDate(a));
                const dateB = parseDate(getPaymentDate(b));

                return (dateB ? dateB.getTime() : 0) -
                    (dateA ? dateA.getTime() : 0);
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

            const name = getPaymentCustomer(
                payment,
                customers
            );

            const amount = money(getAmount(payment));

            const rawStatus = getStatus(payment, [
                "status",
                "paymentStatus",
                "payment_status"
            ]);

            let label = "Pending";
            let className = "status-pending";

            if (isPaid(payment)) {
                label = "Paid";
                className = "status-paid";
            } else if (
                ["failed", "failure", "cancelled", "canceled"]
                    .includes(rawStatus)
            ) {
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
    // MOBILE SIDEBAR
    // ==========================================

    const menuToggle = $("menuToggle");
    const sidebar = $("sidebar");

    if (menuToggle && sidebar) {
        menuToggle.addEventListener("click", function () {
            const isOpen = sidebar.classList.toggle("sidebar-open");

            menuToggle.setAttribute(
                "aria-expanded",
                String(isOpen)
            );
        });

        // Close the mobile sidebar after selecting a page.
        sidebar.querySelectorAll(".sidebar-nav .nav-link")
            .forEach(function (link) {
                link.addEventListener("click", function () {
                    sidebar.classList.remove("sidebar-open");
                    menuToggle.setAttribute("aria-expanded", "false");
                });
            });

        // Close the sidebar when clicking outside it on mobile.
        document.addEventListener("click", function (event) {
            if (
                !sidebar.contains(event.target) &&
                !menuToggle.contains(event.target) &&
                sidebar.classList.contains("sidebar-open")
            ) {
                sidebar.classList.remove("sidebar-open");
                menuToggle.setAttribute("aria-expanded", "false");
            }
        });
    }

    // ==========================================
    // LOGOUT
    // ==========================================

    const logoutBtn = $("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
            localStorage.removeItem(LOGIN_KEY);
            window.location.href = "login.html";
        });
    }

});
