export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          attendance_date: string
          check_in: string | null
          check_out: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          late_minutes: number
          remarks: string | null
          status: string
          updated_at: string
          updated_by: string | null
          working_hours: number
        }
        Insert: {
          attendance_date: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          late_minutes?: number
          remarks?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          working_hours?: number
        }
        Update: {
          attendance_date?: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          late_minutes?: number
          remarks?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          working_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          details: Json | null
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          authorized_signatory: string
          company_name: string
          created_at: string
          created_by: string | null
          default_payment_mode: string
          fixed_days_per_month: number
          grace_minutes: number
          id: string
          late_block_amount: number
          late_block_minutes: number
          logo_url: string | null
          office_end: string
          office_start: string
          payslip_footer: string
          salary_day_basis: string
          updated_at: string
          updated_by: string | null
          website: string
        }
        Insert: {
          authorized_signatory?: string
          company_name?: string
          created_at?: string
          created_by?: string | null
          default_payment_mode?: string
          fixed_days_per_month?: number
          grace_minutes?: number
          id?: string
          late_block_amount?: number
          late_block_minutes?: number
          logo_url?: string | null
          office_end?: string
          office_start?: string
          payslip_footer?: string
          salary_day_basis?: string
          updated_at?: string
          updated_by?: string | null
          website?: string
        }
        Update: {
          authorized_signatory?: string
          company_name?: string
          created_at?: string
          created_by?: string | null
          default_payment_mode?: string
          fixed_days_per_month?: number
          grace_minutes?: number
          id?: string
          late_block_amount?: number
          late_block_minutes?: number
          logo_url?: string | null
          office_end?: string
          office_start?: string
          payslip_footer?: string
          salary_day_basis?: string
          updated_at?: string
          updated_by?: string | null
          website?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          aadhaar: string | null
          account_number: string | null
          address: string | null
          bank_name: string | null
          created_at: string
          created_by: string | null
          department: string | null
          designation: string | null
          email: string | null
          employee_code: string
          employment_status: string
          full_name: string
          gross_salary: number
          id: string
          ifsc_code: string | null
          joining_date: string | null
          mobile: string | null
          pan: string | null
          payment_mode: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          aadhaar?: string | null
          account_number?: string | null
          address?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          designation?: string | null
          email?: string | null
          employee_code: string
          employment_status?: string
          full_name: string
          gross_salary?: number
          id?: string
          ifsc_code?: string | null
          joining_date?: string | null
          mobile?: string | null
          pan?: string | null
          payment_mode?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          aadhaar?: string | null
          account_number?: string | null
          address?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          designation?: string | null
          email?: string | null
          employee_code?: string
          employment_status?: string
          full_name?: string
          gross_salary?: number
          id?: string
          ifsc_code?: string | null
          joining_date?: string | null
          mobile?: string | null
          pan?: string | null
          payment_mode?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string
          created_by: string | null
          holiday_date: string
          id: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          holiday_date: string
          id?: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          holiday_date?: string
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          end_date: string
          hr_approved_at: string | null
          id: string
          leave_type: string
          manager_approved_at: string | null
          reason: string | null
          start_date: string
          status: string
          total_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          end_date: string
          hr_approved_at?: string | null
          id?: string
          leave_type?: string
          manager_approved_at?: string | null
          reason?: string | null
          start_date: string
          status?: string
          total_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          end_date?: string
          hr_approved_at?: string | null
          id?: string
          leave_type?: string
          manager_approved_at?: string | null
          reason?: string | null
          start_date?: string
          status?: string
          total_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll: {
        Row: {
          absent_days: number
          absent_deduction: number
          additional_deductions: number
          additional_earnings: number
          created_at: string
          created_by: string | null
          employee_id: string
          gross_salary: number
          id: string
          late_deduction: number
          late_minutes: number
          locked: boolean
          net_salary: number
          notes: string | null
          payable_days: number
          payment_mode: string
          payment_status: string
          payslip_number: string
          per_day_salary: number
          period_month: number
          period_year: number
          present_days: number
          status: string
          total_days: number
          total_deduction: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          absent_days?: number
          absent_deduction?: number
          additional_deductions?: number
          additional_earnings?: number
          created_at?: string
          created_by?: string | null
          employee_id: string
          gross_salary?: number
          id?: string
          late_deduction?: number
          late_minutes?: number
          locked?: boolean
          net_salary?: number
          notes?: string | null
          payable_days?: number
          payment_mode?: string
          payment_status?: string
          payslip_number: string
          per_day_salary?: number
          period_month: number
          period_year: number
          present_days?: number
          status?: string
          total_days?: number
          total_deduction?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          absent_days?: number
          absent_deduction?: number
          additional_deductions?: number
          additional_earnings?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string
          gross_salary?: number
          id?: string
          late_deduction?: number
          late_minutes?: number
          locked?: boolean
          net_salary?: number
          notes?: string | null
          payable_days?: number
          payment_mode?: string
          payment_status?: string
          payslip_number?: string
          per_day_salary?: number
          period_month?: number
          period_year?: number
          present_days?: number
          status?: string
          total_days?: number
          total_deduction?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_adjustments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          kind: string
          label: string
          payroll_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          label: string
          payroll_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          label?: string
          payroll_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_adjustments_payroll_id_fkey"
            columns: ["payroll_id"]
            isOneToOne: false
            referencedRelation: "payroll"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      salary_structure: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          employee_id: string
          gross_salary: number
          id: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from: string
          employee_id: string
          gross_salary: number
          id?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          employee_id?: string
          gross_salary?: number
          id?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_structure_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_payroll_manager: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "hr" | "employee"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "hr", "employee"],
    },
  },
} as const
