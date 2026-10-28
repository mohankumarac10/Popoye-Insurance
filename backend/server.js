
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { pool, testConnection } = require("./db");

const app = express();

app.use(cors());
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


 // Get all customers from MySQL, including their vehicle number
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

const PORT = Number(process.env.PORT || 3000);

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

  const connection = await pool.getConnection();

  try {
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
      [customerId, vehicle_number.trim().toUpperCase()]
    );

    await connection.commit();

    res.status(201).json({
      status: "success",
      message: "Customer and vehicle saved to MySQL",
      customer_id: customerId
    });
  } catch (error) {
    await connection.rollback();

    console.error("Customer save failed:", error.message);

    res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
      status: "error",
      message: error.code === "ER_DUP_ENTRY"
        ? "Customer code, phone, or vehicle number already exists"
        : "Could not save customer"
    });
  } finally {
    connection.release();
  }
});


async function startServer() {
    try {
        await testConnection();

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
            console.log(`Database test: http://localhost:${PORT}/api/db-test`);
        });
    } catch (error) {
        console.error("MySQL connection failed:", error.message);
    }
}

startServer();
