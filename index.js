import "dotenv/config.js";

import express from "express";
import cors from "cors";
import LoginController from "./src/controllers/LoginController.js";
import RegisterController from "./src/controllers/RegisterController.js";
import documentRoutes from "./routes/documentRoutes.js";
import { supabase } from "./SupabaseClient.js"; // adjust path as needed

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/auth/login", LoginController.login);
app.post("/api/auth/register", RegisterController.register);

// Document routes
app.use("/api/documents", documentRoutes);

app.get("/test-embedding-insert", async (req, res) => {
  const { data, error } = await supabase.from("document_embeddings").insert([
    {
      user_id: "test",
      document_id: "test",
      embedding: Array(1536).fill(0),
      text: "test",
    },
  ]);
  console.log("Manual insert:", { data, error });
  res.json({ data, error });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on PORT ${PORT}`));
