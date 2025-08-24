// RegisterController.js
import { supabase } from "../../SupabaseClient.js";
import bcrypt from "bcryptjs";

const RegisterController = {
  register: async (req, res) => {
    const { email, password, role } = req.body;

    // Check if user already exists
    const { data: existingUsers, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .limit(1);

    if (fetchError) {
      return res.status(500).json({ error: "Database error" });
    }
    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const { error } = await supabase
      .from("users")
      .insert([{ email, password: hashedPassword, role }]);

    if (error) {
      return res.status(500).json({ error: "Registration failed" });
    }

    res.json({ message: "Registration successful" });
  },
};

export default RegisterController;
