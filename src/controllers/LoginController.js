//LoginController.js
import { supabase } from "../../SupabaseClient.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const LoginController = {
  login: async (req, res) => {
    const { email, password } = req.body;

    // Fetch user by email from Supabase
    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .limit(1);

    if (error || !users || users.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = users[0];

    // Compare password (assuming user.password is hashed)
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create JWT payload
    const payload = {
      id: user.id,
      email: user.email,
      // add other fields as needed
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "2h",
    });

    res.json({
      user: payload,
      session: {
        access_token: token,
        expires_in: 2 * 60 * 60,
        token_type: "Bearer",
      },
    });
  },
};

export default LoginController;
