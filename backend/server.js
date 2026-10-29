
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

const customerCode = customer_code?.trim() || `CUS${Date.now()}`;

if (
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
                 customerCode,
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

 // Update an existing customer
app.put("/api/customers/:id", async (req, res) => {
    const { id } = req.params;
    const { full_name, phone, email, address } = req.body;

    if (!full_name?.trim() || !phone?.trim()) {
        return res.status(400).json({
            status: "error",
            message: "Customer name and phone are required"
        });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [result] = await connection.execute(
            `UPDATE customers
             SET full_name = ?,
                 phone = ?,
                 email = ?,
                 address = ?
             WHERE id = ?`,
            [
                full_name.trim(),
                phone.trim(),
                email?.trim() || null,
                address?.trim() || null,
                id
            ]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();

            return res.status(404).json({
                status: "error",
                message: "Customer not found"
            });
        }

        await connection.commit();

        return res.json({
            status: "success",
            message: "Customer updated successfully"
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Update customer error:", error);

        return res.status(500).json({
            status: "error",
            message: "Unable to update customer"
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

 // Get all vehicles
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

// Get all insurance policies
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
                p.premium_amount,
                p.start_date,
                p.end_date,
                p.policy_status,
                p.created_at
            FROM policies p
            LEFT JOIN customers c ON p.customer_id = c.id
            LEFT JOIN vehicles v ON p.vehicle_id = v.id
            ORDER BY p.id DESC
        `);

        res.json({
            status: "success",
            count: rows.length,
            policies: rows
        });
    } catch (error) {
        console.error("Policies query failed:", error);

        res.status(500).json({
            status: "error",
            message: "Could not retrieve policies"
        });
    }
});
// Create a new insurance policy
app.post("/api/policies", async (req, res) => {
    const {
        policy_number,
        customer_id,
        vehicle_id,
        premium_amount,
        start_date,
        end_date
    } = req.body;

    if (
        !policy_number?.trim() ||
        !/^\d+$/.test(String(customer_id || "")) ||
        !/^\d+$/.test(String(vehicle_id || "")) ||
        premium_amount === undefined ||
        !Number.isFinite(Number(premium_amount)) ||
        Number(premium_amount) <= 0 ||
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
            `INSERT INTO policies (
                policy_number,
                customer_id,
                vehicle_id,
                premium_amount,
                start_date,
                end_date
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                policy_number.trim(),
                customer_id,
                vehicle_id,
                Number(premium_amount),
                start_date,
                end_date
            ]
        );

        res.status(201).json({
            status: "success",
            message: "Policy saved successfully",
            policy_id: result.insertId
        });
    } catch (error) {
        console.error("Policy creation failed:", error);

        res.status(
            error.code === "ER_DUP_ENTRY" ? 409 : 500
        ).json({
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
        premium_amount,
        start_date,
        end_date
    } = req.body;

    if (!/^\d+$/.test(policyId)) {
        return res.status(400).json({
            status: "error",
            message: "Invalid policy ID"
        });
    }

    if (
        !policy_number?.trim() ||
        !/^\d+$/.test(String(customer_id || "")) ||
        !/^\d+$/.test(String(vehicle_id || "")) ||
        premium_amount === undefined ||
        !Number.isFinite(Number(premium_amount)) ||
        Number(premium_amount) <= 0 ||
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

        await pool.execute(
            `UPDATE policies
             SET policy_number = ?,
                 customer_id = ?,
                 vehicle_id = ?,
                 premium_amount = ?,
                 start_date = ?,
                 end_date = ?
             WHERE id = ?`,
            [
                policy_number.trim(),
                customer_id,
                vehicle_id,
                Number(premium_amount),
                start_date,
                end_date,
                policyId
            ]
        );

        res.json({
            status: "success",
            message: "Policy updated successfully"
        });
    } catch (error) {
        console.error("Policy update failed:", error);

        res.status(
            error.code === "ER_DUP_ENTRY" ? 409 : 500
        ).json({
            status: "error",
            message: error.code === "ER_DUP_ENTRY"
                ? "This policy number already exists"
                : "Could not update policy"
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
        premium_amount,
        start_date,
        end_date
    } = req.body;

    if (!/^\d+$/.test(policyId)) {
        return res.status(400).json({
            status: "error",
            message: "Invalid policy ID"
        });
    }

    if (
        !policy_number?.trim() ||
        !/^\d+$/.test(String(customer_id || "")) ||
        !/^\d+$/.test(String(vehicle_id || "")) ||
        premium_amount === undefined ||
        !Number.isFinite(Number(premium_amount)) ||
        Number(premium_amount) <= 0 ||
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

        await pool.execute(
            `UPDATE policies
             SET policy_number = ?,
                 customer_id = ?,
                 vehicle_id = ?,
                 premium_amount = ?,
                 start_date = ?,
                 end_date = ?
             WHERE id = ?`,
            [
                policy_number.trim(),
                customer_id,
                vehicle_id,
                Number(premium_amount),
                start_date,
                end_date,
                policyId
            ]
        );

        res.json({
            status: "success",
            message: "Policy updated successfully"
        });
    } catch (error) {
        console.error("Policy update failed:", error);

        res.status(
            error.code === "ER_DUP_ENTRY" ? 409 : 500
        ).json({
            status: "error",
            message: error.code === "ER_DUP_ENTRY"
                ? "This policy number already exists"
                : "Could not update policy"
        });
    }
});
// Get payments, optionally filtered by policy ID
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
            INNER JOIN policies pol
                ON pol.id = p.policy_id
        `;

        const params = [];

        if (policyId !== undefined) {
            if (!/^\d+$/.test(String(policyId))) {
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
        console.error("Payment retrieval failed:", error);

        res.status(500).json({
            status: "error",
            message: "Could not retrieve payments"
        });
    }
});
// Start the server
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
    try {
        await testConnection();

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
            console.log(`Health API: http://localhost:${PORT}/api/health`);
            console.log(`Policies API: http://localhost:${PORT}/api/policies`);
        });
    } catch (error) {
        console.error("MySQL connection failed:", error);
    }
}

startServer();