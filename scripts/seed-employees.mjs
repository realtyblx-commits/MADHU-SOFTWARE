import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, "");
      if (key === "SUPABASE_URL" || key === "VITE_SUPABASE_URL") supabaseUrl = supabaseUrl || val;
      if (key === "SUPABASE_SERVICE_ROLE_KEY") supabaseServiceKey = val;
    }
  }
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const employees = [
  {
    employee_code: "BLX26-001",
    full_name: "Devesh Vats",
    designation: "Realtor",
    department: "Sales",
    employment_status: "Active",
    email: "devesh@theblxrealty.com",
    payment_mode: "Bank Transfer",
    gross_salary: 30000,
  },
  {
    employee_code: "BLX26-002",
    full_name: "Vishal M Raju",
    designation: "Senior Realtor",
    department: "Sales",
    employment_status: "Active",
    email: "vishal@theblxrealty.com",
    payment_mode: "Bank Transfer",
    gross_salary: 50000,
  },
  {
    employee_code: "BLX26-003",
    full_name: "Balindar",
    designation: "Digital Marketing Executive",
    department: "Digital Marketing",
    employment_status: "Active",
    email: "balindar@theblxrealty.com",
    payment_mode: "Bank Transfer",
    gross_salary: 23000,
  },
  {
    employee_code: "BLX26-004",
    full_name: "Chandrika",
    designation: "Presales Executive",
    department: "Presales",
    employment_status: "Active",
    email: "chandrika@theblxrealty.com",
    payment_mode: "Bank Transfer",
    gross_salary: 23000,
  },
  {
    employee_code: "BLX26-005",
    full_name: "Siddarth",
    designation: "Realtor",
    department: "Sales",
    employment_status: "Active",
    email: "siddarth@theblxrealty.com",
    payment_mode: "Bank Transfer",
    gross_salary: 25000,
  },
  {
    employee_code: "BLX26-006",
    full_name: "Jigyasa Dhiman",
    designation: "Content & Marketing Specialist",
    department: "Marketing",
    employment_status: "Active",
    email: "jigyasa@theblxrealty.com",
    payment_mode: "Bank Transfer",
    gross_salary: 30000,
  },
];

async function seed() {
  console.log(`Seeding ${employees.length} employees to Supabase...`);
  const { data, error } = await supabase
    .from("employees")
    .upsert(employees, { onConflict: "employee_code" })
    .select();

  if (error) {
    console.error("Failed to seed employees:", error);
    process.exit(1);
  }

  console.log("Successfully inserted/updated employees:");
  data.forEach((e) => console.log(` - [${e.employee_code}] ${e.full_name} (${e.designation}) - ₹${e.gross_salary}`));
}

seed();
