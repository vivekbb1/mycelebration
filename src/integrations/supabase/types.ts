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
      boutique_members: {
        Row: {
          boutique_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          boutique_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          boutique_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boutique_members_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
        ]
      }
      boutiques: {
        Row: {
          access_code: string
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          access_code: string
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          access_code?: string
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          dress_code: string | null
          event_date: string | null
          id: string
          name: string
          note: string | null
          outfit_selection: boolean
          rsvp_by: string | null
          sort_order: number
          start_time: string | null
          venue: string | null
          venue_address: string | null
        }
        Insert: {
          created_at?: string
          dress_code?: string | null
          event_date?: string | null
          id?: string
          name: string
          note?: string | null
          outfit_selection?: boolean
          rsvp_by?: string | null
          sort_order?: number
          start_time?: string | null
          venue?: string | null
          venue_address?: string | null
        }
        Update: {
          created_at?: string
          dress_code?: string | null
          event_date?: string | null
          id?: string
          name?: string
          note?: string | null
          outfit_selection?: boolean
          rsvp_by?: string | null
          sort_order?: number
          start_time?: string | null
          venue?: string | null
          venue_address?: string | null
        }
        Relationships: []
      }
      household_event_invites: {
        Row: {
          created_at: string
          event_id: string
          household: string
          id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          household: string
          id?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          household?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_event_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          code: string
          created_at: string
          email: string | null
          gender: string | null
          guest_name: string
          household: string | null
          id: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          code: string
          created_at?: string
          email?: string | null
          gender?: string | null
          guest_name: string
          household?: string | null
          id?: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          code?: string
          created_at?: string
          email?: string | null
          gender?: string | null
          guest_name?: string
          household?: string | null
          id?: string
        }
        Relationships: []
      }
      logistics: {
        Row: {
          checkin_note: string | null
          created_at: string
          hotel_address: string | null
          hotel_name: string | null
          id: string
          intro: string
          measurements_deadline: string | null
          singleton: boolean
          team_email: string | null
          team_name: string | null
          team_whatsapp: string | null
          timeline: Json
          updated_at: string
        }
        Insert: {
          checkin_note?: string | null
          created_at?: string
          hotel_address?: string | null
          hotel_name?: string | null
          id?: string
          intro?: string
          measurements_deadline?: string | null
          singleton?: boolean
          team_email?: string | null
          team_name?: string | null
          team_whatsapp?: string | null
          timeline?: Json
          updated_at?: string
        }
        Update: {
          checkin_note?: string | null
          created_at?: string
          hotel_address?: string | null
          hotel_name?: string | null
          id?: string
          intro?: string
          measurements_deadline?: string | null
          singleton?: boolean
          team_email?: string | null
          team_name?: string | null
          team_whatsapp?: string | null
          timeline?: Json
          updated_at?: string
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
          boutique_id: string | null
          boutique_url: string | null
          color_family: string | null
          created_at: string
          designer: string | null
          event_id: string | null
          garment_type: string | null
          gender: string
          id: string
          image_url: string | null
          images: Json
          is_available: boolean
          notes: string | null
          price_inr: number | null
          price_note: string | null
          silhouette: string | null
          size_note: string | null
          source_sku: string | null
          title: string
          updated_at: string
        }
        Insert: {
          boutique_id?: string | null
          boutique_url?: string | null
          color_family?: string | null
          created_at?: string
          designer?: string | null
          event_id?: string | null
          garment_type?: string | null
          gender?: string
          id?: string
          image_url?: string | null
          images?: Json
          is_available?: boolean
          notes?: string | null
          price_inr?: number | null
          price_note?: string | null
          silhouette?: string | null
          size_note?: string | null
          source_sku?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          boutique_id?: string | null
          boutique_url?: string | null
          color_family?: string | null
          created_at?: string
          designer?: string | null
          event_id?: string | null
          garment_type?: string | null
          gender?: string
          id?: string
          image_url?: string | null
          images?: Json
          is_available?: boolean
          notes?: string | null
          price_inr?: number | null
          price_note?: string | null
          silhouette?: string | null
          size_note?: string | null
          source_sku?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfits_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
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
          gender: string | null
          household: string | null
          id: string
          invite_claimed: boolean
          rsvp_note: string | null
          rsvp_status: string
          rsvp_updated_at: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          gender?: string | null
          household?: string | null
          id: string
          invite_claimed?: boolean
          rsvp_note?: string | null
          rsvp_status?: string
          rsvp_updated_at?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          gender?: string | null
          household?: string | null
          id?: string
          invite_claimed?: boolean
          rsvp_note?: string | null
          rsvp_status?: string
          rsvp_updated_at?: string | null
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
          order_status: string
          order_status_updated_at: string
          outfit_id: string
          status: string
        }
        Insert: {
          created_at?: string
          guest_id: string
          guest_name?: string | null
          id?: string
          order_status?: string
          order_status_updated_at?: string
          outfit_id: string
          status?: string
        }
        Update: {
          created_at?: string
          guest_id?: string
          guest_name?: string | null
          id?: string
          order_status?: string
          order_status_updated_at?: string
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
      can_boutique_see_guest: { Args: { _guest_id: string }; Returns: boolean }
      can_boutique_see_outfit: {
        Args: { _outfit_id: string }
        Returns: boolean
      }
      claim_host_access: { Args: never; Returns: Json }
      claim_invite: { Args: { _code: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      household_members: {
        Args: never
        Returns: {
          gender: string
          name: string
        }[]
      }
      is_boutique_member: { Args: { _boutique_id: string }; Returns: boolean }
      my_event_ids: {
        Args: never
        Returns: {
          event_id: string
        }[]
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
