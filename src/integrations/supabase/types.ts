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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean | null
          message: string
          severity: string
          type: string
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          severity?: string
          type: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          severity?: string
          type?: string
        }
        Relationships: []
      }
      dsrs: {
        Row: {
          created_at: string | null
          id: string
          region_id: string | null
          team_id: string | null
          tl_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          region_id?: string | null
          team_id?: string | null
          tl_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          region_id?: string | null
          team_id?: string | null
          tl_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dsrs_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dsrs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dsrs_tl_id_fkey"
            columns: ["tl_id"]
            isOneToOne: false
            referencedRelation: "team_leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          region_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id: string
          phone?: string | null
          region_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          region_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      regions: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          admin_approved: boolean | null
          admin_approved_at: string | null
          created_at: string | null
          dsr_id: string | null
          dstv_package: string | null
          id: string
          package_option: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          region_id: string | null
          sale_id: string
          sale_type: Database["public"]["Enums"]["sale_type"]
          smart_card_number: string
          sn_number: string
          stock_id: string | null
          team_id: string | null
          tl_id: string | null
          tl_verified: boolean | null
          tl_verified_at: string | null
        }
        Insert: {
          admin_approved?: boolean | null
          admin_approved_at?: string | null
          created_at?: string | null
          dsr_id?: string | null
          dstv_package?: string | null
          id?: string
          package_option?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          region_id?: string | null
          sale_id: string
          sale_type: Database["public"]["Enums"]["sale_type"]
          smart_card_number: string
          sn_number: string
          stock_id?: string | null
          team_id?: string | null
          tl_id?: string | null
          tl_verified?: boolean | null
          tl_verified_at?: string | null
        }
        Update: {
          admin_approved?: boolean | null
          admin_approved_at?: string | null
          created_at?: string | null
          dsr_id?: string | null
          dstv_package?: string | null
          id?: string
          package_option?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          region_id?: string | null
          sale_id?: string
          sale_type?: Database["public"]["Enums"]["sale_type"]
          smart_card_number?: string
          sn_number?: string
          stock_id?: string | null
          team_id?: string | null
          tl_id?: string | null
          tl_verified?: boolean | null
          tl_verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_dsr_id_fkey"
            columns: ["dsr_id"]
            isOneToOne: false
            referencedRelation: "dsrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tl_id_fkey"
            columns: ["tl_id"]
            isOneToOne: false
            referencedRelation: "team_leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      stock: {
        Row: {
          assigned_by: string | null
          assigned_to_dsr: string | null
          assigned_to_team: string | null
          assigned_to_tl: string | null
          batch_id: string | null
          created_at: string | null
          date_assigned: string | null
          id: string
          region_id: string | null
          status: Database["public"]["Enums"]["stock_status"] | null
          stock_id: string
          type: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to_dsr?: string | null
          assigned_to_team?: string | null
          assigned_to_tl?: string | null
          batch_id?: string | null
          created_at?: string | null
          date_assigned?: string | null
          id?: string
          region_id?: string | null
          status?: Database["public"]["Enums"]["stock_status"] | null
          stock_id: string
          type: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to_dsr?: string | null
          assigned_to_team?: string | null
          assigned_to_tl?: string | null
          batch_id?: string | null
          created_at?: string | null
          date_assigned?: string | null
          id?: string
          region_id?: string | null
          status?: Database["public"]["Enums"]["stock_status"] | null
          stock_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_assigned_to_dsr_fkey"
            columns: ["assigned_to_dsr"]
            isOneToOne: false
            referencedRelation: "dsrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_assigned_to_team_fkey"
            columns: ["assigned_to_team"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_assigned_to_tl_fkey"
            columns: ["assigned_to_tl"]
            isOneToOne: false
            referencedRelation: "team_leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_batches: {
        Row: {
          batch_number: string
          created_at: string | null
          created_by: string | null
          id: string
        }
        Insert: {
          batch_number: string
          created_at?: string | null
          created_by?: string | null
          id?: string
        }
        Update: {
          batch_number?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
        }
        Relationships: []
      }
      team_leaders: {
        Row: {
          created_at: string | null
          id: string
          monthly_target: number | null
          region_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          monthly_target?: number | null
          region_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          monthly_target?: number | null
          region_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_leaders_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          captain_name: string | null
          created_at: string | null
          id: string
          name: string
          region_id: string | null
          tl_id: string | null
        }
        Insert: {
          captain_name?: string | null
          created_at?: string | null
          id?: string
          name: string
          region_id?: string | null
          tl_id?: string | null
        }
        Update: {
          captain_name?: string | null
          created_at?: string | null
          id?: string
          name?: string
          region_id?: string | null
          tl_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_tl_id_fkey"
            columns: ["tl_id"]
            isOneToOne: false
            referencedRelation: "team_leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "tl" | "dsr"
      payment_status: "paid" | "unpaid"
      sale_type: "FS" | "DO"
      stock_status:
        | "unassigned"
        | "assigned-tl"
        | "assigned-team"
        | "assigned-dsr"
        | "sold-paid"
        | "sold-unpaid"
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
      app_role: ["admin", "tl", "dsr"],
      payment_status: ["paid", "unpaid"],
      sale_type: ["FS", "DO"],
      stock_status: [
        "unassigned",
        "assigned-tl",
        "assigned-team",
        "assigned-dsr",
        "sold-paid",
        "sold-unpaid",
      ],
    },
  },
} as const
