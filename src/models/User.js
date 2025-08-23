const bcrypt = require("bcryptjs");

// Mock users (replace with DB queries in production)
const users = [
  {
    id: "1",
    email: "doctor@example.com",
    name: "Dr. Smith",
    role: "Doctor",
    passwordHash: bcrypt.hashSync("password123", 10),
  },
  {
    id: "2",
    email: "nurse@example.com",
    name: "Nurse Joy",
    role: "Nurse",
    passwordHash: bcrypt.hashSync("nursepass", 10),
  },
];

exports.getUserByEmail = (email) => users.find((u) => u.email === email);
