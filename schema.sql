-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL
);

-- Create addresses table
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
