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
      app_settings: {
        Row: {
          id: number
          organization_name: string | null
          timezone: string | null
        }
        Insert: {
          id?: number
          organization_name?: string | null
          timezone?: string | null
        }
        Update: {
          id?: number
          organization_name?: string | null
          timezone?: string | null
        }
        Relationships: []
      }
      parking_events: {
        Row: {
          duration_min: number | null
          ended_at: string | null
          id: number
          started_at: string
          vehicle_id: number | null
        }
        Insert: {
          duration_min?: number | null
          ended_at?: string | null
          id?: number
          started_at: string
          vehicle_id?: number | null
        }
        Update: {
          duration_min?: number | null
          ended_at?: string | null
          id?: number
          started_at?: string
          vehicle_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parking_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_table_columns: {
        Row: {
          col_order: number | null
          column_key: string
          created_at: string | null
          format: string | null
          id: string
          label: string | null
          report_table_id: string
          updated_at: string | null
          visible: boolean | null
          width: number | null
        }
        Insert: {
          col_order?: number | null
          column_key: string
          created_at?: string | null
          format?: string | null
          id?: string
          label?: string | null
          report_table_id: string
          updated_at?: string | null
          visible?: boolean | null
          width?: number | null
        }
        Update: {
          col_order?: number | null
          column_key?: string
          created_at?: string | null
          format?: string | null
          id?: string
          label?: string | null
          report_table_id?: string
          updated_at?: string | null
          visible?: boolean | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "report_table_columns_report_table_id_fkey"
            columns: ["report_table_id"]
            isOneToOne: false
            referencedRelation: "report_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      report_tables: {
        Row: {
          created_at: string | null
          default_page_size: number | null
          id: string
          report_id: string
          sql: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_page_size?: number | null
          id?: string
          report_id: string
          sql: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_page_size?: number | null
          id?: string
          report_id?: string
          sql?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_tables_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_tiles: {
        Row: {
          created_at: string | null
          decimals: number | null
          format: string | null
          id: string
          position: number
          refresh_seconds: number | null
          report_id: string
          sql: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          decimals?: number | null
          format?: string | null
          id?: string
          position: number
          refresh_seconds?: number | null
          report_id: string
          sql: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          decimals?: number | null
          format?: string | null
          id?: string
          position?: number
          refresh_seconds?: number | null
          report_id?: string
          sql?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_tiles_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          section_id: string | null
          settings: Json
          slug: string | null
          sort_index: number
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          section_id?: string | null
          settings?: Json
          slug?: string | null
          sort_index?: number
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          section_id?: string | null
          settings?: Json
          slug?: string | null
          sort_index?: number
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          sort_index: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          sort_index?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          sort_index?: number
        }
        Relationships: []
      }
      speeding_events: {
        Row: {
          event_time: string
          id: number
          limit_kmh: number | null
          speed_kmh: number | null
          vehicle_id: number | null
        }
        Insert: {
          event_time: string
          id?: number
          limit_kmh?: number | null
          speed_kmh?: number | null
          vehicle_id?: number | null
        }
        Update: {
          event_time?: string
          id?: number
          limit_kmh?: number | null
          speed_kmh?: number | null
          vehicle_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "speeding_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          avg_speed_kmh: number | null
          distance_km: number | null
          end_time: string | null
          id: number
          start_time: string
          vehicle_id: number | null
        }
        Insert: {
          avg_speed_kmh?: number | null
          distance_km?: number | null
          end_time?: string | null
          id?: number
          start_time: string
          vehicle_id?: number | null
        }
        Update: {
          avg_speed_kmh?: number | null
          distance_km?: number | null
          end_time?: string | null
          id?: number
          start_time?: string
          vehicle_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          id: number
          last_seen_at: string
          plate: string
          status: string
        }
        Insert: {
          id?: number
          last_seen_at?: string
          plate: string
          status: string
        }
        Update: {
          id?: number
          last_seen_at?: string
          plate?: string
          status?: string
        }
        Relationships: []
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
