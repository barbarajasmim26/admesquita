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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          contract_id: string | null
          created_at: string
          due_date: string | null
          id: string
          is_read: boolean
          message: string | null
          owner_id: string | null
          tenant_id: string | null
          title: string
          type: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          owner_id?: string | null
          tenant_id?: string | null
          title: string
          type: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          owner_id?: string | null
          tenant_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          auto_renew: boolean | null
          created_at: string
          due_day: number
          duration_months: number | null
          end_date: string | null
          guarantor_cpf: string | null
          guarantor_name: string | null
          guarantor_phone: string | null
          id: string
          owner_id: string | null
          property_id: string
          readjustment_index: string | null
          rent_amount: number
          start_date: string
          status: string
          tenant_id: string
          terms: string | null
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean | null
          created_at?: string
          due_day: number
          duration_months?: number | null
          end_date?: string | null
          guarantor_cpf?: string | null
          guarantor_name?: string | null
          guarantor_phone?: string | null
          id?: string
          owner_id?: string | null
          property_id: string
          readjustment_index?: string | null
          rent_amount: number
          start_date: string
          status?: string
          tenant_id: string
          terms?: string | null
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean | null
          created_at?: string
          due_day?: number
          duration_months?: number | null
          end_date?: string | null
          guarantor_cpf?: string | null
          guarantor_name?: string | null
          guarantor_phone?: string | null
          id?: string
          owner_id?: string | null
          property_id?: string
          readjustment_index?: string | null
          rent_amount?: number
          start_date?: string
          status?: string
          tenant_id?: string
          terms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          expense_date: string
          id: string
          notes: string | null
          owner_id: string | null
          property_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          property_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      former_tenants: {
        Row: {
          cpf: string | null
          created_at: string
          deposit: number | null
          due_day: number | null
          email: string | null
          exit_date: string | null
          final_balance: number | null
          house_number: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          property_id: string
          rent_amount: number | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          deposit?: number | null
          due_day?: number | null
          email?: string | null
          exit_date?: string | null
          final_balance?: number | null
          house_number?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          property_id: string
          rent_amount?: number | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          deposit?: number | null
          due_day?: number | null
          email?: string | null
          exit_date?: string | null
          final_balance?: number | null
          house_number?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          property_id?: string
          rent_amount?: number | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "former_tenants_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_date: string
          created_at: string
          description: string | null
          id: string
          lead_id: string
          type: string
        }
        Insert: {
          activity_date?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          type: string
        }
        Update: {
          activity_date?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          budget: number | null
          created_at: string
          email: string | null
          id: string
          interest: string | null
          name: string
          next_followup: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          property_id: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          created_at?: string
          email?: string | null
          id?: string
          interest?: string | null
          name: string
          next_followup?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          property_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          created_at?: string
          email?: string | null
          id?: string
          interest?: string | null
          name?: string
          next_followup?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          property_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          due_date: string
          id: string
          interest: number | null
          late_fee: number | null
          notes: string | null
          owner_id: string | null
          paid_amount: number | null
          paid_date: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          due_date: string
          id?: string
          interest?: number | null
          late_fee?: number | null
          notes?: string | null
          owner_id?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          due_date?: string
          id?: string
          interest?: number | null
          late_fee?: number | null
          notes?: string | null
          owner_id?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          category: string | null
          created_at: string
          id: string
          iptu: number | null
          name: string
          notes: string | null
          owner_id: string | null
          owner_name: string | null
          owner_phone: string | null
          photos: Json | null
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          created_at?: string
          id?: string
          iptu?: number | null
          name: string
          notes?: string | null
          owner_id?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          photos?: Json | null
          type?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string | null
          created_at?: string
          id?: string
          iptu?: number | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          photos?: Json | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          id: string
          issued_date: string
          owner_id: string | null
          payment_id: string
          pdf_url: string | null
          receipt_number: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          id?: string
          issued_date?: string
          owner_id?: string | null
          payment_id: string
          pdf_url?: string | null
          receipt_number?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          id?: string
          issued_date?: string
          owner_id?: string | null
          payment_id?: string
          pdf_url?: string | null
          receipt_number?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts_history: {
        Row: {
          amount: number
          id: string
          issued_at: string
          notes: string | null
          payment_id: string | null
          receipt_number: string
          reference_month: string | null
          tenant_id: string | null
        }
        Insert: {
          amount: number
          id?: string
          issued_at?: string
          notes?: string | null
          payment_id?: string | null
          receipt_number: string
          reference_month?: string | null
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          id?: string
          issued_at?: string
          notes?: string | null
          payment_id?: string | null
          receipt_number?: string
          reference_month?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_history_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string
          due_time: string | null
          id: string
          lead_id: string | null
          owner_id: string | null
          priority: string | null
          property_id: string | null
          status: string
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          due_time?: string | null
          id?: string
          lead_id?: string | null
          owner_id?: string | null
          priority?: string | null
          property_id?: string | null
          status?: string
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          due_time?: string | null
          id?: string
          lead_id?: string | null
          owner_id?: string | null
          priority?: string | null
          property_id?: string | null
          status?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          birth_date: string | null
          cpf: string | null
          created_at: string
          deposit: number | null
          documents: Json | null
          due_day: number
          email: string | null
          emergency_contact: string | null
          exit_date: string | null
          house_number: string | null
          id: string
          interest_percent: number | null
          late_fee_percent: number | null
          name: string
          notes: string | null
          owner_id: string | null
          payment_cycle: string
          phone: string | null
          pix_payer: string | null
          profession: string | null
          property_id: string
          rent_amount: number
          rg: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          deposit?: number | null
          documents?: Json | null
          due_day: number
          email?: string | null
          emergency_contact?: string | null
          exit_date?: string | null
          house_number?: string | null
          id?: string
          interest_percent?: number | null
          late_fee_percent?: number | null
          name: string
          notes?: string | null
          owner_id?: string | null
          payment_cycle?: string
          phone?: string | null
          pix_payer?: string | null
          profession?: string | null
          property_id: string
          rent_amount: number
          rg?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          deposit?: number | null
          documents?: Json | null
          due_day?: number
          email?: string | null
          emergency_contact?: string | null
          exit_date?: string | null
          house_number?: string | null
          id?: string
          interest_percent?: number | null
          late_fee_percent?: number | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          payment_cycle?: string
          phone?: string | null
          pix_payer?: string | null
          profession?: string | null
          property_id?: string
          rent_amount?: number
          rg?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
