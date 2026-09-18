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
      branding: {
        Row: {
          base_font_size: number
          body_font: string
          color_accent: string
          color_background: string
          color_border: string
          color_foreground: string
          color_primary: string
          color_primary_foreground: string
          color_surface: string
          favicon_url: string | null
          heading_font: string
          heading_scale: number
          id: string
          logo_height: number
          logo_url: string | null
          radius: number
          updated_at: string
        }
        Insert: {
          base_font_size?: number
          body_font?: string
          color_accent?: string
          color_background?: string
          color_border?: string
          color_foreground?: string
          color_primary?: string
          color_primary_foreground?: string
          color_surface?: string
          favicon_url?: string | null
          heading_font?: string
          heading_scale?: number
          id?: string
          logo_height?: number
          logo_url?: string | null
          radius?: number
          updated_at?: string
        }
        Update: {
          base_font_size?: number
          body_font?: string
          color_accent?: string
          color_background?: string
          color_border?: string
          color_foreground?: string
          color_primary?: string
          color_primary_foreground?: string
          color_surface?: string
          favicon_url?: string | null
          heading_font?: string
          heading_scale?: number
          id?: string
          logo_height?: number
          logo_url?: string | null
          radius?: number
          updated_at?: string
        }
        Relationships: []
      }
      branding_presets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          settings: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      email_settings: {
        Row: {
          from_email: string | null
          from_name: string | null
          id: string
          provider: string
          updated_at: string
        }
        Insert: {
          from_email?: string | null
          from_name?: string | null
          id?: string
          provider?: string
          updated_at?: string
        }
        Update: {
          from_email?: string | null
          from_name?: string | null
          id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_attendance: {
        Row: {
          attending: boolean
          created_at: string
          event_id: string
          guest_count: number
          household: string
          id: string
          updated_at: string
        }
        Insert: {
          attending?: boolean
          created_at?: string
          event_id: string
          guest_count?: number
          household: string
          id?: string
          updated_at?: string
        }
        Update: {
          attending?: boolean
          created_at?: string
          event_id?: string
          guest_count?: number
          household?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          background_image_url: string | null
          created_at: string
          dress_code: string | null
          event_date: string | null
          id: string
          invite_id: string | null
          name: string
          note: string | null
          outfit_selection: boolean
          rsvp_by: string | null
          sort_order: number
          start_time: string | null
          updated_at: string
          venue: string | null
          venue_address: string | null
        }
        Insert: {
          background_image_url?: string | null
          created_at?: string
          dress_code?: string | null
          event_date?: string | null
          id?: string
          invite_id?: string | null
          name: string
          note?: string | null
          outfit_selection?: boolean
          rsvp_by?: string | null
          sort_order?: number
          start_time?: string | null
          updated_at?: string
          venue?: string | null
          venue_address?: string | null
        }
        Update: {
          background_image_url?: string | null
          created_at?: string
          dress_code?: string | null
          event_date?: string | null
          id?: string
          invite_id?: string | null
          name?: string
          note?: string | null
          outfit_selection?: boolean
          rsvp_by?: string | null
          sort_order?: number
          start_time?: string | null
          updated_at?: string
          venue?: string | null
          venue_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          branding_preset_id: string | null
          code: string
          created_at: string
          email: string | null
          id: string
          invite_id: string | null
          name: string
          needs_wardrobe: boolean
        }
        Insert: {
          branding_preset_id?: string | null
          code: string
          created_at?: string
          email?: string | null
          id?: string
          invite_id?: string | null
          name: string
          needs_wardrobe?: boolean
        }
        Update: {
          branding_preset_id?: string | null
          code?: string
          created_at?: string
          email?: string | null
          id?: string
          invite_id?: string | null
          name?: string
          needs_wardrobe?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "families_branding_preset_id_fkey"
            columns: ["branding_preset_id"]
            isOneToOne: false
            referencedRelation: "branding_presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "families_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_communications: {
        Row: {
          channel: string
          contacted_at: string
          created_at: string
          follow_up_on: string | null
          host_id: string | null
          id: string
          invite_id: string
          notes: string | null
          outcome: string
          reminder_sent_at: string | null
        }
        Insert: {
          channel?: string
          contacted_at?: string
          created_at?: string
          follow_up_on?: string | null
          host_id?: string | null
          id?: string
          invite_id: string
          notes?: string | null
          outcome?: string
          reminder_sent_at?: string | null
        }
        Update: {
          channel?: string
          contacted_at?: string
          created_at?: string
          follow_up_on?: string | null
          host_id?: string | null
          id?: string
          invite_id?: string
          notes?: string | null
          outcome?: string
          reminder_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_communications_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invite_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_host_transfers: {
        Row: {
          applied_at: string | null
          created_at: string
          created_by: string | null
          effective_on: string
          from_host: string | null
          id: string
          invite_id: string
          reason: string | null
          to_host: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          created_by?: string | null
          effective_on?: string
          from_host?: string | null
          id?: string
          invite_id: string
          reason?: string | null
          to_host: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          created_by?: string | null
          effective_on?: string
          from_host?: string | null
          id?: string
          invite_id?: string
          reason?: string | null
          to_host?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_host_transfers_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invite_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_hosts: {
        Row: {
          created_at: string
          host_id: string
          id: string
          invite_id: string
          note: string | null
        }
        Insert: {
          created_at?: string
          host_id: string
          id?: string
          invite_id: string
          note?: string | null
        }
        Update: {
          created_at?: string
          host_id?: string
          id?: string
          invite_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_hosts_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invite_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_messages: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string
          created_at: string
          from_host: boolean
          household: string
          id: string
          read_at: string | null
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body: string
          created_at?: string
          from_host?: boolean
          household: string
          id?: string
          read_at?: string | null
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          created_at?: string
          from_host?: boolean
          household?: string
          id?: string
          read_at?: string | null
        }
        Relationships: []
      }
      host_invites: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          code: string
          created_at: string
          email: string
          full_name: string | null
          id: string
          invited_by: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          code: string
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          code?: string
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
        }
        Relationships: []
      }
      household_event_invites: {
        Row: {
          created_at: string
          event_id: string
          household: string
          id: string
          outfit_selection: boolean
        }
        Insert: {
          created_at?: string
          event_id: string
          household: string
          id?: string
          outfit_selection?: boolean
        }
        Update: {
          created_at?: string
          event_id?: string
          household?: string
          id?: string
          outfit_selection?: boolean
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
          branding_preset_id: string | null
          claimed_at: string | null
          claimed_by: string | null
          code: string
          created_at: string
          email: string | null
          family_id: string | null
          gender: string | null
          guest_name: string
          household: string | null
          id: string
          invite_id: string | null
          personally_invited: boolean
          personally_invited_at: string | null
          personally_invited_by: string | null
          rsvp_note: string | null
          rsvp_recorded_at: string | null
          rsvp_recorded_by: string | null
          rsvp_status: string
        }
        Insert: {
          branding_preset_id?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          code: string
          created_at?: string
          email?: string | null
          family_id?: string | null
          gender?: string | null
          guest_name: string
          household?: string | null
          id?: string
          invite_id?: string | null
          personally_invited?: boolean
          personally_invited_at?: string | null
          personally_invited_by?: string | null
          rsvp_note?: string | null
          rsvp_recorded_at?: string | null
          rsvp_recorded_by?: string | null
          rsvp_status?: string
        }
        Update: {
          branding_preset_id?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          code?: string
          created_at?: string
          email?: string | null
          family_id?: string | null
          gender?: string | null
          guest_name?: string
          household?: string | null
          id?: string
          invite_id?: string | null
          personally_invited?: boolean
          personally_invited_at?: string | null
          personally_invited_by?: string | null
          rsvp_note?: string | null
          rsvp_recorded_at?: string | null
          rsvp_recorded_by?: string | null
          rsvp_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_branding_preset_id_fkey"
            columns: ["branding_preset_id"]
            isOneToOne: false
            referencedRelation: "branding_presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          branding_preset_id: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          note: string | null
          updated_at: string
        }
        Insert: {
          branding_preset_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          branding_preset_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_branding_preset_id_fkey"
            columns: ["branding_preset_id"]
            isOneToOne: false
            referencedRelation: "branding_presets"
            referencedColumns: ["id"]
          },
        ]
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
          guest_name: string
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
          guest_name?: string
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
          guest_name?: string
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
      site_content: {
        Row: {
          default_value: string
          group_name: string
          key: string
          kind: string
          label: string
          page_name: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          default_value: string
          group_name: string
          key: string
          kind?: string
          label: string
          page_name?: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          default_value?: string
          group_name?: string
          key?: string
          kind?: string
          label?: string
          page_name?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      travel_plans: {
        Row: {
          arrival_date: string | null
          arrival_flight: string | null
          arrival_time: string | null
          created_at: string
          created_by: string | null
          departure_date: string | null
          departure_flight: string | null
          departure_time: string | null
          guest_name: string | null
          household: string
          id: string
          notes: string | null
          party_size: number | null
          updated_at: string
        }
        Insert: {
          arrival_date?: string | null
          arrival_flight?: string | null
          arrival_time?: string | null
          created_at?: string
          created_by?: string | null
          departure_date?: string | null
          departure_flight?: string | null
          departure_time?: string | null
          guest_name?: string | null
          household: string
          id?: string
          notes?: string | null
          party_size?: number | null
          updated_at?: string
        }
        Update: {
          arrival_date?: string | null
          arrival_flight?: string | null
          arrival_time?: string | null
          created_at?: string
          created_by?: string | null
          departure_date?: string | null
          departure_flight?: string | null
          departure_time?: string | null
          guest_name?: string | null
          household?: string
          id?: string
          notes?: string | null
          party_size?: number | null
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
      apply_due_guest_transfers: { Args: never; Returns: number }
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
      my_branding: { Args: never; Returns: Json }
      my_event_ids: {
        Args: never
        Returns: {
          event_id: string
        }[]
      }
      my_family_needs_wardrobe: { Args: never; Returns: boolean }
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
