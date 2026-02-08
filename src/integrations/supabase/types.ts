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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      adr_rule_links: {
        Row: {
          adr_id: string
          id: string
          rule_id: string
        }
        Insert: {
          adr_id: string
          id?: string
          rule_id: string
        }
        Update: {
          adr_id?: string
          id?: string
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adr_rule_links_adr_id_fkey"
            columns: ["adr_id"]
            isOneToOne: false
            referencedRelation: "decision_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adr_rule_links_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "constitution_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      constitution_rules: {
        Row: {
          category_id: string
          code: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_locked: boolean
          name: string
          rationale: string | null
          severity: string
          updated_at: string
          version: number
        }
        Insert: {
          category_id: string
          code: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          is_locked?: boolean
          name: string
          rationale?: string | null
          severity?: string
          updated_at?: string
          version?: number
        }
        Update: {
          category_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_locked?: boolean
          name?: string
          rationale?: string | null
          severity?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "constitution_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "rule_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_records: {
        Row: {
          alternatives_considered: Json | null
          consequences: string | null
          context: string
          created_at: string
          created_by: string | null
          decision: string
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          alternatives_considered?: Json | null
          consequences?: string | null
          context: string
          created_at?: string
          created_by?: string | null
          decision: string
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          alternatives_considered?: Json | null
          consequences?: string | null
          context?: string
          created_at?: string
          created_by?: string | null
          decision?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rule_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      sdd_agent_messages: {
        Row: {
          agent_name: string | null
          content: string
          created_at: string
          id: string
          metadata: Json | null
          phase: string
          project_id: string
          role: string
        }
        Insert: {
          agent_name?: string | null
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          phase: string
          project_id: string
          role: string
        }
        Update: {
          agent_name?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          phase?: string
          project_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdd_agent_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "sdd_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sdd_documents: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          doc_type: string
          generated_by: string | null
          id: string
          phase: string
          project_id: string
          review_comment: string | null
          reviewed_by: string | null
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          doc_type: string
          generated_by?: string | null
          id?: string
          phase: string
          project_id: string
          review_comment?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          doc_type?: string
          generated_by?: string | null
          id?: string
          phase?: string
          project_id?: string
          review_comment?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sdd_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "sdd_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sdd_projects: {
        Row: {
          created_at: string
          created_by: string
          current_phase: string
          description: string | null
          id: string
          methodology: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_phase?: string
          description?: string | null
          id?: string
          methodology?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_phase?: string
          description?: string | null
          id?: string
          methodology?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
