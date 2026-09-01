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
      events: {
        Row: {
          created_at: string
          dress_code: string | null
          event_date: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          dress_code?: string | null
          event_date?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          dress_code?: string | null
          event_date?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          code: string
          created_at: string
          email: string | null
          guest_name: string
          id: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          code: string
          created_at?: string
          email?: string | null
          guest_name: string
          id?: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          code?: string
          created_at?: string
          email?: string | null
          guest_name?: string
          id?: string
        }
        Relationships: []
      }
      measurements: {
        Row: {
          bottom_length: number | null
          bust: number | null
          created_at: string
          guest_id: string
          height: number | null
          hip: number | null
          id: string
          inseam: number | null
          notes: string | null
          shoulder: number | null
          sleeve_length: number | null
          top_length: number | null
          unit: string
          updated_at: string
          waist: number | null
        }
        Insert: {
          bottom_length?: number | null
          bust?: number | null
          created_at?: string
          guest_id: string
          height?: number | null
          hip?: number | null
          id?: string
          inseam?: number | null
          notes?: string | null
          shoulder?: number | null
          sleeve_length?: number | null
          top_length?: number | null
          unit?: string
          updated_at?: string
          waist?: number | null
        }
        Update: {
          bottom_length?: number | null
          bust?: number | null
          created_at?: string
          guest_id?: string
          height?: number | null
          hip?: number | null
          id?: string
          inseam?: number | null
          notes?: string | null
          shoulder?: number | null
          sleeve_length?: number | null
          top_length?: number | null
          unit?: string
          updated_at?: string
          waist?: number | null
        }
        Relationships: []
      }
      outfits: {
        Row: {
          boutique_url: string | null
          color_family: string | null
          created_at: string
          designer: string | null
          event_id: string | null
          garment_type: string | null
          gender: string
          id: string
          image_url: string | null
          is_available: boolean
          notes: string | null
          price_note: string | null
          size_note: string | null
          title: string
          updated_at: string
        }
        Insert: {
          boutique_url?: string | null
          color_family?: string | null
          created_at?: string
          designer?: string | null
          event_id?: string | null
          garment_type?: string | null
          gender?: string
          id?: string
          image_url?: string | null
          is_available?: boolean
          notes?: string | null
          price_note?: string | null
          size_note?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          boutique_url?: string | null
          color_family?: string | null
          created_at?: string
          designer?: string | null
          event_id?: string | null
          garment_type?: string | null
          gender?: string
          id?: string
          image_url?: string | null
          is_available?: boolean
          notes?: string | null
          price_note?: string | null
          size_note?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfits_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          invite_claimed: boolean
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          invite_claimed?: boolean
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          invite_claimed?: boolean
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      reservations: {
        Row: {
          created_at: string
          guest_id: string
          guest_name: string | null
          id: string
          outfit_id: string
          status: string
        }
        Insert: {
          created_at?: string
          guest_id: string
          guest_name?: string | null
          id?: string
          outfit_id: string
          status?: string
        }
        Update: {
          created_at?: string
          guest_id?: string
          guest_name?: string | null
          id?: string
          outfit_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: true
            referencedRelation: "outfits"
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
      claim_host_access: { Args: never; Returns: Json }
      claim_invite: { Args: { _code: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "guest"
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
      app_role: ["admin", "guest"],
    },
  },
} as const
