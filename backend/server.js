
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { pool, testConnection } = require("./db");

const app = express();

app.use(cors());

app.use(
    "/api/payments/razorpay-webhook",
    express.raw({ type: "application/json" })
);

app.use(express.json());

// Test whether the API is running
app.get("/api/health", (req, res) => {
    res.json({
        status: "success",
        message: "Popoye Insurance API is running"
    });
});

// Test the MySQL connection
app.get("/api/db-test", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT DATABASE() AS database_name"
        );

        res.json({
            status: "success",
            message: "MySQL connected successfully",
            database: rows[0].database_name
        });
    } catch (error) {
        console.error("Database error:", error.message);

        res.status(500).json({
            status: "error",
            message: "Database connection failed"
        });
    }
});

// Get all customers, including their vehicle number
app.get("/api/customers", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                c.id,
                c.customer_code,
                c.full_name,
                c.phone,
                c.email,
                c.address,
                c.created_at,
                (
                    SELECT v.vehicle_number
                    FROM vehicles v
                    WHERE v.customer_id = c.id
                    ORDER BY v.id DESC
                    LIMIT 1
                ) AS vehicle_number
            FROM customers c
            ORDER BY c.id DESC
        `);

        res.json({
            status: "success",
            count: rows.length,
            customers: rows
        });
    } catch (error) {
        console.error("Customer query failed:", error.message);

        res.status(500).json({
            status: "error",
            message: "Could not retrieve customers"
        });
    }
});

// Add a customer and their vehicle
app.post("/api/customers", async (req, res) => {
    const {
        customer_code,
        full_name,
        phone,
        email,
        address,
        vehicle_number
    } = req.body;

    if (
        !customer_code?.trim() ||
        !full_name?.trim() ||
        !phone?.trim() ||
        !vehicle_number?.trim()
    ) {
        return res.status(400).json({
            status: "error",
            message: "Customer code, name, phone, and vehicle number are required"
        });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [customerResult] = await connection.execute(
            `INSERT INTO customers
                (customer_code, full_name, phone, email, address)
             VALUES (?, ?, ?, ?, ?)`,
            [
                customer_code.trim(),
                full_name.trim(),
                phone.trim(),
                email?.trim() || null,
                address?.trim() || null
            ]
        );

        const customerId = customerResult.insertId;

        await connection.execute(
            `INSERT INTO vehicles (customer_id, vehicle_number)
             VALUES (?, ?)`,
            [
                customerId,
                vehicle_number.trim().toUpperCase()
            ]
        );

        await connection.commit();

        res.status(201).json({
            status: "success",
            message: "Customer and vehicle saved to MySQL",
            customer_id: customerId
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Customer save failed:", error.message);

        res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
            status: "error",
            message: error.code === "ER_DUP_ENTRY"
                ? "Customer code, phone, or vehicle number already exists"
                : "Could not save customer"
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Get all insurance policies with customer and vehicle details
app.get("/api/policies", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                p.id,
                p.policy_number,
                p.customer_id,
                c.full_name,
                p.vehicle_id,
                v.vehicle_number,
                p.policy_type,
                p.insurance_type,
                p.premium_amount,
                p.start_date,
                p.end_date,
                p.notes,
                p.created_at
            FROM policies p
            LEFT JOIN customers c
                ON p.customer_id = c.id
            LEFT JOIN vehicles v
                ON p.vehicle_id = v.id
            ORDER BY p.id DESC
        `);

        res.json({
            status: "success",
            count: rows.length,
            policies: rows
        });
    } catch (error) {
        console.error("Policies query failed:", error.message);

        res.status(500).json({
            status: "error",
            message: "Could not retrieve policies"
        });
    }
});
// Get vehicles for the policy form
app.get("/api/vehicles", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id,
                customer_id,
                vehicle_number
            FROM vehicles
            ORDER BY id DESC
        `);

        res.json({
            status: "success",
            count: rows.length,
            vehicles: rows
        });
    } catch (error) {
        console.error("Vehicle query failed:", error.message);

        res.status(500).json({
            status: "error",
            message: "Could not retrieve vehicles"
        });
    }
});
// Create a new insurance policy
app.post("/api/policies", async (req, res) => {
    const {
        policy_number,
        customer_id,
        vehicle_id,
        policy_type,
        insurance_type,
        premium_amount,
        start_date,
        end_date,
        notes
    } = req.body;

    if (
        !policy_number ||
        !customer_id ||
        !vehicle_id ||
        !premium_amount ||
        !start_date ||
        !end_date
    ) {
        return res.status(400).json({
            status: "error",
            message: "Please provide all required policy fields"
        });
    }

    if (new Date(end_date) < new Date(start_date)) {
        return res.status(400).json({
            status: "error",
            message: "Expiry date cannot be before the start date"
        });
    }

    try {
        // Confirm that the selected vehicle belongs to the customer
        const [vehicles] = await pool.execute(
            `SELECT id FROM vehicles
             WHERE id = ? AND customer_id = ?`,
            [vehicle_id, customer_id]
        );

        if (vehicles.length === 0) {
            return res.status(400).json({
                status: "error",
                message: "The selected vehicle does not belong to this customer"
            });
        }

        const [result] = await pool.execute(
            `INSERT INTO policies (
                policy_number,
                customer_id,
                vehicle_id,
                policy_type,
                insurance_type,
                premium_amount,
                start_date,
                end_date,
                notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                policy_number.trim(),
                customer_id,
                vehicle_id,
                policy_type || null,
                insurance_type || null,
                premium_amount,
                start_date,
                end_date,
                notes || null
            ]
        );

        res.status(201).json({
            status: "success",
            message: "Policy saved successfully",
            policy_id: result.insertId
        });
    } catch (error) {
        console.error("Policy creation failed:", error.message);

        res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
            status: "error",
            message: error.code === "ER_DUP_ENTRY"
                ? "This policy number already exists"
                : "Could not save policy"
        });
    }
});
// Update an existing insurance policy
app.put("/api/policies/:id", async (req, res) => {
    const policyId = req.params.id;

    const {
        policy_number,
        customer_id,
        vehicle_id,
        policy_type,
        insurance_type,
        premium_amount,
        start_date,
        end_date,
        notes
    } = req.body;

    if (
        !policy_number ||
        !customer_id ||
        !vehicle_id ||
        !premium_amount ||
        !start_date ||
        !end_date
    ) {
        return res.status(400).json({
            status: "error",
            message: "Please provide all required policy fields"
        });
    }

    if (new Date(end_date) < new Date(start_date)) {
        return res.status(400).json({
            status: "error",
            message: "Expiry date cannot be before the start date"
        });
    }

    try {
        const [vehicles] = await pool.execute(
            `SELECT id FROM vehicles
             WHERE id = ? AND customer_id = ?`,
            [vehicle_id, customer_id]
        );

        if (vehicles.length === 0) {
            return res.status(400).json({
                status: "error",
                message: "The selected vehicle does not belong to this customer"
            });
        }

        const [result] = await pool.execute(
            `UPDATE policies
             SET policy_number = ?,
                 customer_id = ?,
                 vehicle_id = ?,
                 policy_type = ?,
                 insurance_type = ?,
                 premium_amount = ?,
                 start_date = ?,
                 end_date = ?,
                 notes = ?
             WHERE id = ?`,
            [
                policy_number.trim(),
                customer_id,
                vehicle_id,
                policy_type || null,
                insurance_type || null,
                premium_amount,
                start_date,
                end_date,
                notes || null,
                policyId
            ]
        );

        if (result.affectedRows === 0) {
            const [existing] = await pool.execute(
                "SELECT id FROM policies WHERE id = ?",
                [policyId]
            );

            if (existing.length === 0) {
                return res.status(404).json({
                    status: "error",
                    message: "Policy not found"
                });
            }
        }

        res.json({
            status: "success",
            message: "Policy updated successfully"
        });
    } catch (error) {
        console.error("Policy update failed:", error.message);

        res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
            status: "error",
            message: error.code === "ER_DUP_ENTRY"
                ? "This policy number already exists"
                : "Could not update policy"
        });
    }
});
// Delete an insurance policy
app.delete("/api/policies/:id", async (req, res) => {
    const policyId = req.params.id;

    if (!/^\d+$/.test(policyId)) {
        return res.status(400).json({
            status: "error",
            message: "Invalid policy ID"
        });
    }

    try {
        const [result] = await pool.execute(
            "DELETE FROM policies WHERE id = ?",
            [policyId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: "error",
                message: "Policy not found"
            });
        }

        res.json({
            status: "success",
            message: "Policy deleted successfully"
        });
    } catch (error) {
        console.error("Policy deletion failed:", error.message);

        res.status(500).json({
            status: "error",
            message: "Could not delete policy"
        });
    }
});

/* =========================================
   PAYMENT API — Popoye Insurance
========================================= */

// Get payments for a policy
app.get("/api/payments", async (req, res) => {
    try {
        const policyId = req.query.policyId;

        let sql = `
            SELECT
                p.id,
                p.payment_number,
                p.policy_id,
                p.amount,
                p.payment_method,
                p.transaction_id,
                p.status,
                p.paid_at,
                p.created_at,
                pol.policy_number
            FROM payments p
            JOIN policies pol ON pol.id = p.policy_id
        `;

        const params = [];

        if (policyId) {
            if (!/^\d+$/.test(policyId)) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid policy ID"
                });
            }

            sql += " WHERE p.policy_id = ?";
            params.push(policyId);
        }

        sql += " ORDER BY p.created_at DESC";

        const [payments] = await pool.execute(sql, params);

        res.json({
            status: "success",
            count: payments.length,
            payments
        });
    } catch (error) {
        console.error("Payment retrieval failed:", error.message);

        res.status(500).json({
            status: "error",
            message: "Could not retrieve payments"
        });
    }
});

// Create a pending payment record
app.post("/api/payments", async (req, res) => {
    try {
        const { policy_id, payment_method } = req.body;

        if (!policy_id || !/^\d+$/.test(String(policy_id))) {
            return res.status(400).json({
                status: "error",
                message: "A valid policy ID is required"
            });
        }

        const [policies] = await pool.execute(
            `SELECT id, premium_amount
             FROM policies
             WHERE id = ?`,
            [policy_id]
        );

        if (policies.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Policy not found"
            });
        }

        const amount = Number(policies[0].premium_amount);

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Invalid policy premium"
            });
        }

        const paymentNumber =
            "PAY-" + Date.now() + "-" +
            Math.random().toString(36).slice(2, 8).toUpperCase();

        await pool.execute(
            `INSERT INTO payments
                (payment_number, policy_id, amount, payment_method, status)
             VALUES (?, ?, ?, ?, 'Pending')`,
            [
                paymentNumber,
                policy_id,
                amount,
                payment_method || null
            ]
        );

        res.status(201).json({
            status: "success",
            message: "Pending payment record created",
            payment: {
                payment_number: paymentNumber,
                policy_id: Number(policy_id),
                amount,
                payment_status: "Pending"
            }
        });
    } catch (error) {
        console.error("Payment creation failed:", error.message);

        res.status(500).json({
            status: "error",
            message: "Could not create payment record"
        });
    }
});

/* =========================================
   RAZORPAY ORDER CREATION
========================================= */

const Razorpay = require("razorpay");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

app.post(
  "/api/payments/create-order",async (req, res) => {
    try {
        const { policy_id } = req.body;

        if (!policy_id || !/^\d+$/.test(String(policy_id))) {
            return res.status(400).json({
                status: "error",
                message: "A valid policy ID is required"
            });
        }

        if (
            !process.env.RAZORPAY_KEY_ID ||
            !process.env.RAZORPAY_KEY_SECRET
        ) {
            return res.status(500).json({
                status: "error",
                message: "Razorpay test keys are not configured"
            });
        }

        // Get the amount from MySQL, not from the browser.
        const [policies] = await pool.execute(
            `SELECT id, policy_number, premium_amount
             FROM policies
             WHERE id = ?`,
            [policy_id]
        );

        if (policies.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Policy not found"
            });
        }

        const policy = policies[0];
        const amountPaise = Math.round(
            Number(policy.premium_amount) * 100
        );

        if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Invalid policy premium"
            });
        }

        const paymentNumber =
            "PAY-" + Date.now() + "-" +
            Math.random().toString(36).slice(2, 8).toUpperCase();

        const order = await razorpay.orders.create({
            amount: amountPaise,
            currency: "INR",
            receipt: paymentNumber,
            notes: {
                policy_id: String(policy.id),
                policy_number: policy.policy_number
            }
        });

        // Store the pending payment and Razorpay order ID.
        await pool.execute(
            `INSERT INTO payments
                (payment_number, policy_id, amount,
                 payment_method, transaction_id, status)
             VALUES (?, ?, ?, ?, ?, 'Pending')`,
            [
                paymentNumber,
                policy.id,
                Number(policy.premium_amount),
                "Razorpay",
                order.id
            ]
        );

        res.status(201).json({
            status: "success",
            key_id: process.env.RAZORPAY_KEY_ID,
            payment_number: paymentNumber,
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency
            },
            policy: {
                policy_number: policy.policy_number,
                amount: Number(policy.premium_amount)
            }
        });
    } catch (error) {
        console.error("Razorpay order creation failed:", error.message);

        res.status(500).json({
            status: "error",
            message: "Could not create Razorpay order"
        });
    }
});
const crypto = require("crypto");

app.post(
  "/api/payments/create-order",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const signature = req.headers["x-razorpay-signature"];
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

      if (!signature || !secret || !Buffer.isBuffer(req.body)) {
        return res.status(400).send("Invalid webhook request");
      }

      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(req.body)
        .digest("hex");

      const signaturesMatch =
        signature.length === expectedSignature.length &&
        crypto.timingSafeEqual(
          Buffer.from(signature, "hex"),
          Buffer.from(expectedSignature, "hex")
        );

      if (!signaturesMatch) {
        return res.status(400).send("Invalid webhook signature");
      }

      const event = JSON.parse(req.body.toString("utf8"));

      if (event.event === "payment_link.paid") {
        const paymentLinkId = event.payload?.payment_link?.entity?.id;
        const paymentId = event.payload?.payment?.entity?.id;

        if (paymentLinkId && paymentId) {
          // We'll connect these IDs to the correct database record next.
          console.log("Verified paid Payment Link:", paymentLinkId, paymentId);
        }
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("Webhook processing failed:", error.message);
      return res.status(500).send("Webhook processing failed");
    }
  }
);
// Start the server
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
    try {
        await testConnection();

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
            console.log(`Customers API: http://localhost:${PORT}/api/customers`);
            console.log(`Policies API: http://localhost:${PORT}/api/policies`);
            console.log(`Database test: http://localhost:${PORT}/api/db-test`);
        });
    } catch (error) {
        console.error("MySQL connection failed:", error.message);
    }
}

startServer();
