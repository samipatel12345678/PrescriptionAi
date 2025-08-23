import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase configuration. Please check your environment variables.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Export for backward compatibility
export { supabase as default }; 