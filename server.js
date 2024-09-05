const express = require('express');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const databasePath = path.join(__dirname, 'customerApplication.db');
let database = null;

// Function to initialize and set up the database

const initializeDbAndServer = async () => {
  try {
    console.log('Initializing database and server...');
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    console.log('Creating tables...');
    await database.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customerId INTEGER,
        street TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        isPrimary BOOLEAN,
        FOREIGN KEY (customerId) REFERENCES customers(id)
      );
    `);

    console.log('Database initialized. Starting server...');
    app.listen(5000, () => console.log('Server Running at http://localhost:5000/'));
  } catch (error) {
    console.error(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

// Validate customer data
const validateCustomer = (customer) => {
  const { firstName, lastName, phone, email } = customer;
  const nameRegex = /^[A-Za-z]+$/;
  const phoneRegex = /^\d{10}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
    return 'Names should only contain alphabetical characters.';
  }
  if (!phoneRegex.test(phone)) {
    return 'Phone number should be exactly 10 digits.';
  }
  if (!emailRegex.test(email)) {
    return 'Invalid email format.';
  }
  return null;
};

// Create customer
app.post('/customers/', async (req, res) => {
  const { firstName, lastName, phone, email, addresses } = req.body;
  const error = validateCustomer({ firstName, lastName, phone, email });
  if (error) return res.status(400).send(error);

  try {
    const postCustomerQuery = `
      INSERT INTO customers (firstName, lastName, phone, email)
      VALUES (?, ?, ?, ?);`;

    const result = await database.run(postCustomerQuery, [firstName, lastName, phone, email]);
    const customerId = result.lastID;

    const postAddressQuery = `
      INSERT INTO addresses (customerId, street, city, state, zip, isPrimary)
      VALUES (?, ?, ?, ?, ?, ?);`;

    for (const address of addresses) {
      await database.run(postAddressQuery, [customerId, address.street, address.city, address.state, address.zip, address.isPrimary]);
    }

    res.status(201).send({ id: customerId });
  } catch (error) {
    res.status(500).send(`Server error: ${error.message}`);
  }
});

// Read all customers with filters
app.get('/customers/', async (req, res) => {
  const { name = '', city = '', state = '', zip = '' } = req.query;
  try {
    let getCustomersQuery = `
      SELECT customers.*, addresses.street, addresses.city, addresses.state, addresses.zip
      FROM customers
      LEFT JOIN addresses ON customers.id = addresses.customerId
      WHERE 1=1`;

    const queryParams = [];

    if (name) {
      getCustomersQuery += ` AND (customers.firstName LIKE ? OR customers.lastName LIKE ?)`;
      queryParams.push(`%${name}%`, `%${name}%`);
    }
    if (city) {
      getCustomersQuery += ` AND addresses.city LIKE ?`;
      queryParams.push(`%${city}%`);
    }
    if (state) {
      getCustomersQuery += ` AND addresses.state LIKE ?`;
      queryParams.push(`%${state}%`);
    }
    if (zip) {
      getCustomersQuery += ` AND addresses.zip LIKE ?`;
      queryParams.push(`%${zip}%`);
    }

    const data = await database.all(getCustomersQuery, queryParams);
    res.send(data);
  } catch (error) {
    res.status(500).send(`Server error: ${error.message}`);
  }
});

// Update customer
app.put('/customers/:customerId/', async (req, res) => {
  const { customerId } = req.params;
  const { firstName, lastName, phone, email, addresses } = req.body;
  const error = validateCustomer({ firstName, lastName, phone, email });
  if (error) return res.status(400).send(error);

  try {
    const updateCustomerQuery = `
      UPDATE customers
      SET firstName = ?, lastName = ?, phone = ?, email = ?
      WHERE id = ?;`;

    await database.run(updateCustomerQuery, [firstName, lastName, phone, email, customerId]);

    // Delete old addresses
    const deleteAddressesQuery = `DELETE FROM addresses WHERE customerId = ?;`;
    await database.run(deleteAddressesQuery, customerId);

    // Insert new addresses
    const postAddressQuery = `
      INSERT INTO addresses (customerId, street, city, state, zip, isPrimary)
      VALUES (?, ?, ?, ?, ?, ?);`;

    for (const address of addresses) {
      await database.run(postAddressQuery, [customerId, address.street, address.city, address.state, address.zip, address.isPrimary]);
    }

    res.send('Customer updated successfully');
  } catch (error) {
    res.status(500).send(`Server error: ${error.message}`);
  }
});

// Delete customer
app.delete('/customers/:customerId/', async (req, res) => {
  const { customerId } = req.params;
  try {
    // Delete addresses for the customer
    const deleteAddressesQuery = `DELETE FROM addresses WHERE customerId = ?;`;
    await database.run(deleteAddressesQuery, customerId);

    // Delete the customer
    const deleteCustomerQuery = `DELETE FROM customers WHERE id = ?;`;
    await database.run(deleteCustomerQuery, customerId);

    res.send('Customer deleted successfully');
  } catch (error) {
    res.status(500).send(`Server error: ${error.message}`);
  }
});

initializeDbAndServer();
