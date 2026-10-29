
"use strict";

const API_URL = "http://localhost:3000/api";

const params = new URLSearchParams(window.location.search);
const policyId = params.get("policyId");

const $ = id => document.getElementById(id);

const payButton = $("payButton");

let loadedPolicy = null;
let paymentInProgress = false;

function showMessage(message) {
    $("message").textContent = message;
}

function formatDate(value) {
    if (!value) return "—";

    const date = String(value).slice(0, 10);
    const parts = date.split("-");

    return parts.length === 3
        ? `${parts[2]}-${parts[1]}-${parts[0]}`
        : date;
}

function formatCurrency(value) {
    return Number(value).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR"
    });
}

async function loadPolicy() {
    if (!policyId || !/^\d+$/.test(policyId)) {
        showMessage(
            "A valid policy ID is required. Open checkout using a policy ID."
        );
        return;
    }

    try {
        const response = await fetch(`${API_URL}/policies`);
        const data = await response.json();

        if (!response.ok || data.status !== "success") {
            throw new Error(data.message || "Could not load policies.");
        }

        loadedPolicy = (data.policies || []).find(
            policy => String(policy.id) === policyId
        );

        if (!loadedPolicy) {
            showMessage("Policy not found.");
            return;
        }

        $("policyNumber").textContent =
            loadedPolicy.policy_number || "—";

        $("customerName").textContent =
            loadedPolicy.full_name || "—";

        $("vehicleNumber").textContent =
            loadedPolicy.vehicle_number || "—";

        $("expiryDate").textContent =
            formatDate(loadedPolicy.end_date);

        const premium = Number(loadedPolicy.premium_amount);

        if (!Number.isFinite(premium) || premium <= 0) {
            showMessage("The policy premium is invalid.");
            return;
        }

        $("premium").textContent = formatCurrency(premium);

        payButton.disabled = false;

        showMessage(
            "Policy loaded. You can continue to the payment gateway."
        );

    } catch (error) {
        console.error("Checkout loading failed:", error);

        showMessage(
            "Could not load policy details. Check that the backend is running."
        );
    }
}

async function startPayment() {
    if (!loadedPolicy || paymentInProgress) {
        return;
    }

    if (!window.Razorpay) {
        showMessage(
            "Razorpay Checkout did not load. Check your internet connection."
        );
        return;
    }

    paymentInProgress = true;
    payButton.disabled = true;

    try {
        showMessage("Creating a secure payment order...");

        // The backend must calculate the amount from the policy
        // stored in MySQL. Never trust an amount supplied by the browser.
        const response = await fetch(
            `${API_URL}/payments/create-order`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    policy_id: loadedPolicy.id
                })
            }
        );

        const data = await response.json();

        if (!response.ok || data.status !== "success") {
            throw new Error(
                data.message || "Could not create the payment order."
            );
        }

        if (
            !data.key_id ||
            !data.order ||
            !data.order.id ||
            !Number.isFinite(Number(data.order.amount))
        ) {
            throw new Error(
                "The backend returned incomplete payment order details."
            );
        }

        const options = {
            key: data.key_id,
            amount: data.order.amount,
            currency: data.order.currency || "INR",
            name: "Popoye Insurance",
            description: `Renewal: ${loadedPolicy.policy_number}`,
            order_id: data.order.id,

            handler: async function (paymentResponse) {
                // This callback does not prove that payment is verified.
                // The backend must verify the Razorpay signature and
                // confirm the payment with Razorpay before marking Paid.
                console.log(
                    "Razorpay returned a payment response:",
                    {
                        paymentId:
                            paymentResponse.razorpay_payment_id,
                        orderId:
                            paymentResponse.razorpay_order_id
                    }
                );

                showMessage(
                    "Payment response received. Waiting for secure server verification."
                );

                // Do not mark the payment Paid in browser code.
                // Add a server-side verification endpoint before going live.
            },

            modal: {
                ondismiss: function () {
                    showMessage(
                        "Checkout closed. Verify payment status before retrying."
                    );
                }
            },

            theme: {
                color: "#e32636"
            }
        };

        const checkout = new window.Razorpay(options);

        checkout.on("payment.failed", function (event) {
            console.error(
                "Razorpay payment failed:",
                event.error
            );

            showMessage(
                "Payment failed or was not completed. Check the payment status before retrying."
            );
        });

        checkout.open();

    } catch (error) {
        console.error("Payment initialization failed:", error);

        showMessage(
            error.message || "Could not start payment."
        );

    } finally {
        paymentInProgress = false;
        payButton.disabled = false;
    }
}

payButton.addEventListener("click", startPayment);

loadPolicy();
