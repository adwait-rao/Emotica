import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ppzpffrsltcavatmozzd.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwenBmZnJzbHRjYXZhdG1venpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3MTIwMzcsImV4cCI6MjA2NTI4ODAzN30.NKDC8J2yZ5b3ojR3P3d1IZyWHJdPz5femn-rn2fc1Ok"
);

const { data, error } = await supabase.auth.signInWithPassword({
  email: "jayashah8983@gmail.com",
  password: "Emotica123",
});

if (error) {
  console.error("❌ Login failed:", error.message);
  process.exit(1);
}

if (!data.session) {
  console.error(
    "❌ No session returned. Are you using the correct credentials?"
  );
  process.exit(1);
}

console.log("✅ Access token:", data.session.access_token);
