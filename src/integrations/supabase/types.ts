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
      addons: {
        Row: {
          blurb: string | null
          created_at: string
          features: Json
          id: string
          name: string
          price_amount: number | null
          price_currency: string
          price_period: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          blurb?: string | null
          created_at?: string
          features?: Json
          id: string
          name: string
          price_amount?: number | null
          price_currency?: string
          price_period?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          blurb?: string | null
          created_at?: string
          features?: Json
          id?: string
          name?: string
          price_amount?: number | null
          price_currency?: string
          price_period?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      boutique_celebrations: {
        Row: {
          boutique_id: string
          created_at: string
          invite_id: string
        }
        Insert: {
          boutique_id: string
          created_at?: string
          invite_id: string
        }
        Update: {
          boutique_id?: string
          created_at?: string
          invite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boutique_celebrations_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boutique_celebrations_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
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
          cover_logo_height: number
          cover_logo_url: string | null
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
          cover_logo_height?: number
          cover_logo_url?: string | null
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
          cover_logo_height?: number
          cover_logo_url?: string | null
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
          invite_id: string | null
          name: string
          settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_id?: string | null
          name: string
          settings: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_id?: string | null
          name?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branding_presets_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          actual_amount: number | null
          category: string
          created_at: string
          created_by: string | null
          currency: string
          due_on: string | null
          event_id: string | null
          id: string
          invite_id: string | null
          label: string
          notes: string | null
          paid_amount: number
          planned_amount: number
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          actual_amount?: number | null
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          due_on?: string | null
          event_id?: string | null
          id?: string
          invite_id?: string | null
          label: string
          notes?: string | null
          paid_amount?: number
          planned_amount?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          actual_amount?: number | null
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          due_on?: string | null
          event_id?: string | null
          id?: string
          invite_id?: string | null
          label?: string
          notes?: string | null
          paid_amount?: number
          planned_amount?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      celebration_addons: {
        Row: {
          addon_id: string
          created_at: string
          id: string
          invite_id: string
          note: string | null
        }
        Insert: {
          addon_id: string
          created_at?: string
          id?: string
          invite_id: string
          note?: string | null
        }
        Update: {
          addon_id?: string
          created_at?: string
          id?: string
          invite_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "celebration_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "celebration_addons_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      celebration_content: {
        Row: {
          invite_id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          invite_id: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          invite_id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "celebration_content_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "celebration_content_key_fkey"
            columns: ["key"]
            isOneToOne: false
            referencedRelation: "site_content"
            referencedColumns: ["key"]
          },
        ]
      }
      celebration_creator_emails: {
        Row: {
          approved_by: string | null
          created_at: string
          email: string
          notified_at: string | null
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          email: string
          notified_at?: string | null
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          email?: string
          notified_at?: string | null
        }
        Relationships: []
      }
      celebration_creators: {
        Row: {
          approved_by: string | null
          created_at: string
          email: string | null
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          email?: string | null
          user_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      celebration_email_settings: {
        Row: {
          from_email: string | null
          from_name: string | null
          invite_id: string
          provider: string
          updated_at: string
        }
        Insert: {
          from_email?: string | null
          from_name?: string | null
          invite_id: string
          provider?: string
          updated_at?: string
        }
        Update: {
          from_email?: string | null
          from_name?: string | null
          invite_id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "celebration_email_settings_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: true
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      celebration_hosts: {
        Row: {
          created_at: string
          id: string
          invite_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "celebration_hosts_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      celebration_subscriptions: {
        Row: {
          created_at: string
          features_extra: Json
          invite_id: string
          note: string | null
          plan_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          features_extra?: Json
          invite_id: string
          note?: string | null
          plan_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          features_extra?: Json
          invite_id?: string
          note?: string | null
          plan_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "celebration_subscriptions_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: true
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "celebration_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          recipient: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          recipient: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          recipient?: string
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
          invite_id: string | null
          updated_at: string
        }
        Insert: {
          attending?: boolean
          created_at?: string
          event_id: string
          guest_count?: number
          household: string
          id?: string
          invite_id?: string | null
          updated_at?: string
        }
        Update: {
          attending?: boolean
          created_at?: string
          event_id?: string
          guest_count?: number
          household?: string
          id?: string
          invite_id?: string | null
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
          {
            foreignKeyName: "event_attendance_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      event_fees: {
        Row: {
          active: boolean
          audience: string
          base_amount: number
          created_at: string
          created_by: string | null
          currency: string
          event_id: string | null
          id: string
          invite_id: string
          label: string
          note: string | null
          per_guest_amount: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          audience?: string
          base_amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          event_id?: string | null
          id?: string
          invite_id: string
          label?: string
          note?: string | null
          per_guest_amount?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          audience?: string
          base_amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          event_id?: string | null
          id?: string
          invite_id?: string
          label?: string
          note?: string | null
          per_guest_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_fees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_fees_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
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
          outfit_choose_by: string | null
          outfit_ready_by: string | null
          outfit_selection: boolean
          outfit_slot_note: string | null
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
          outfit_choose_by?: string | null
          outfit_ready_by?: string | null
          outfit_selection?: boolean
          outfit_slot_note?: string | null
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
          outfit_choose_by?: string | null
          outfit_ready_by?: string | null
          outfit_selection?: boolean
          outfit_slot_note?: string | null
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
          link_opened_at: string | null
          name: string
          needs_wardrobe: boolean
          signup_link_id: string | null
          travel_need: string | null
        }
        Insert: {
          branding_preset_id?: string | null
          code: string
          created_at?: string
          email?: string | null
          id?: string
          invite_id?: string | null
          link_opened_at?: string | null
          name: string
          needs_wardrobe?: boolean
          signup_link_id?: string | null
          travel_need?: string | null
        }
        Update: {
          branding_preset_id?: string | null
          code?: string
          created_at?: string
          email?: string | null
          id?: string
          invite_id?: string | null
          link_opened_at?: string | null
          name?: string
          needs_wardrobe?: boolean
          signup_link_id?: string | null
          travel_need?: string | null
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
          {
            foreignKeyName: "families_signup_link_id_fkey"
            columns: ["signup_link_id"]
            isOneToOne: false
            referencedRelation: "signup_links"
            referencedColumns: ["id"]
          },
        ]
      }
      family_notes: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string
          created_at: string
          household: string
          id: string
          invite_id: string
          is_change_log: boolean
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body: string
          created_at?: string
          household: string
          id?: string
          invite_id: string
          is_change_log?: boolean
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          created_at?: string
          household?: string
          id?: string
          invite_id?: string
          is_change_log?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_notes_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payments: {
        Row: {
          amount_due: number
          amount_paid: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          host_id: string | null
          household: string | null
          id: string
          invite_id: string | null
          method: string | null
          note: string | null
          paid_at: string | null
          payer_kind: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          host_id?: string | null
          household?: string | null
          id?: string
          invite_id?: string | null
          method?: string | null
          note?: string | null
          paid_at?: string | null
          payer_kind?: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          host_id?: string | null
          household?: string | null
          id?: string
          invite_id?: string | null
          method?: string | null
          note?: string | null
          paid_at?: string | null
          payer_kind?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_invite_id_fkey"
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
          channel: string
          created_at: string
          external_id: string | null
          from_host: boolean
          household: string
          id: string
          invite_id: string | null
          read_at: string | null
          subject: string | null
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body: string
          channel?: string
          created_at?: string
          external_id?: string | null
          from_host?: boolean
          household: string
          id?: string
          invite_id?: string | null
          read_at?: string | null
          subject?: string | null
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          channel?: string
          created_at?: string
          external_id?: string | null
          from_host?: boolean
          household?: string
          id?: string
          invite_id?: string | null
          read_at?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_messages_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_passports: {
        Row: {
          created_at: string
          date_of_birth: string | null
          doc_path: string | null
          expiry: string | null
          first_name: string | null
          household: string
          id: string
          invite_id: string | null
          last_name: string | null
          nationality: string | null
          passport_number: string | null
          person_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          doc_path?: string | null
          expiry?: string | null
          first_name?: string | null
          household: string
          id?: string
          invite_id?: string | null
          last_name?: string | null
          nationality?: string | null
          passport_number?: string | null
          person_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          doc_path?: string | null
          expiry?: string | null
          first_name?: string | null
          household?: string
          id?: string
          invite_id?: string | null
          last_name?: string | null
          nationality?: string | null
          passport_number?: string | null
          person_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_passports_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_stays: {
        Row: {
          checkin_date: string | null
          checkout_date: string | null
          created_at: string
          created_by: string | null
          guest_name: string | null
          host_contact: string | null
          hotel_address: string | null
          hotel_name: string | null
          household: string
          id: string
          invite_id: string | null
          notes: string | null
          room_number: string | null
          room_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          checkin_date?: string | null
          checkout_date?: string | null
          created_at?: string
          created_by?: string | null
          guest_name?: string | null
          host_contact?: string | null
          hotel_address?: string | null
          hotel_name?: string | null
          household: string
          id?: string
          invite_id?: string | null
          notes?: string | null
          room_number?: string | null
          room_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          checkin_date?: string | null
          checkout_date?: string | null
          created_at?: string
          created_by?: string | null
          guest_name?: string | null
          host_contact?: string | null
          hotel_address?: string | null
          hotel_name?: string | null
          household?: string
          id?: string
          invite_id?: string | null
          notes?: string | null
          room_number?: string | null
          room_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_stays_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_tag_hosts: {
        Row: {
          created_at: string
          host_id: string
          id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          host_id: string
          id?: string
          tag_id: string
        }
        Update: {
          created_at?: string
          host_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_tag_hosts_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "guest_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_tags: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invite_id: string | null
          name: string
          note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_id?: string | null
          name: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_id?: string | null
          name?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_tags_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_transport: {
        Row: {
          created_at: string
          created_by: string | null
          driver_name: string | null
          driver_phone: string | null
          event_id: string | null
          flight: string | null
          from_place: string | null
          guest_name: string | null
          household: string
          id: string
          invite_id: string | null
          kind: string
          notes: string | null
          scheduled_at: string | null
          status: string
          to_place: string | null
          updated_at: string
          vehicle: string | null
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          event_id?: string | null
          flight?: string | null
          from_place?: string | null
          guest_name?: string | null
          household: string
          id?: string
          invite_id?: string | null
          kind?: string
          notes?: string | null
          scheduled_at?: string | null
          status?: string
          to_place?: string | null
          updated_at?: string
          vehicle?: string | null
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          event_id?: string | null
          flight?: string | null
          from_place?: string | null
          guest_name?: string | null
          household?: string
          id?: string
          invite_id?: string | null
          kind?: string
          notes?: string | null
          scheduled_at?: string | null
          status?: string
          to_place?: string | null
          updated_at?: string
          vehicle?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_transport_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_transport_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_transport_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      host_addons: {
        Row: {
          addon_id: string
          created_at: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          addon_id: string
          created_at?: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          addon_id?: string
          created_at?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "addons"
            referencedColumns: ["id"]
          },
        ]
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
          invite_id: string | null
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
          invite_id?: string | null
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
          invite_id?: string | null
          invited_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "host_invites_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      host_subscriptions: {
        Row: {
          created_at: string
          features_extra: Json
          note: string | null
          plan_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          features_extra?: Json
          note?: string | null
          plan_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          features_extra?: Json
          note?: string | null
          plan_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_rooms: {
        Row: {
          beds: number
          block_checkin_date: string | null
          block_checkout_date: string | null
          category: string
          created_at: string
          extra_bed_allowed: boolean
          floor: string | null
          id: string
          invite_id: string
          max_occupancy: number
          notes: string | null
          room_number: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          beds?: number
          block_checkin_date?: string | null
          block_checkout_date?: string | null
          category?: string
          created_at?: string
          extra_bed_allowed?: boolean
          floor?: string | null
          id?: string
          invite_id: string
          max_occupancy?: number
          notes?: string | null
          room_number: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          beds?: number
          block_checkin_date?: string | null
          block_checkout_date?: string | null
          category?: string
          created_at?: string
          extra_bed_allowed?: boolean
          floor?: string | null
          id?: string
          invite_id?: string
          max_occupancy?: number
          notes?: string | null
          room_number?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_rooms_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_rooms_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      household_event_invites: {
        Row: {
          created_at: string
          event_id: string
          household: string
          id: string
          invite_id: string | null
          outfit_selection: boolean
        }
        Insert: {
          created_at?: string
          event_id: string
          household: string
          id?: string
          invite_id?: string | null
          outfit_selection?: boolean
        }
        Update: {
          created_at?: string
          event_id?: string
          household?: string
          id?: string
          invite_id?: string | null
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
          {
            foreignKeyName: "household_event_invites_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      import_worker_key: {
        Row: {
          id: number
          token: string
        }
        Insert: {
          id?: number
          token?: string
        }
        Update: {
          id?: number
          token?: string
        }
        Relationships: []
      }
      inbound_unmatched: {
        Row: {
          body: string
          channel: string
          created_at: string
          external_id: string | null
          household: string | null
          id: string
          invite_id: string | null
          resolved_at: string | null
          sender: string
          sender_name: string | null
          subject: string | null
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          external_id?: string | null
          household?: string | null
          id?: string
          invite_id?: string | null
          resolved_at?: string | null
          sender: string
          sender_name?: string | null
          subject?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          external_id?: string | null
          household?: string | null
          id?: string
          invite_id?: string | null
          resolved_at?: string | null
          sender?: string
          sender_name?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_unmatched_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          branding_preset_id: string | null
          category: string
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
          invite_sent_at: string | null
          link_opened_at: string | null
          passport_expiry: string | null
          passport_nationality: string | null
          passport_number: string | null
          personally_invited: boolean
          personally_invited_at: string | null
          personally_invited_by: string | null
          phone: string | null
          rsvp_note: string | null
          rsvp_recorded_at: string | null
          rsvp_recorded_by: string | null
          rsvp_status: string
          tags: string | null
        }
        Insert: {
          branding_preset_id?: string | null
          category?: string
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
          invite_sent_at?: string | null
          link_opened_at?: string | null
          passport_expiry?: string | null
          passport_nationality?: string | null
          passport_number?: string | null
          personally_invited?: boolean
          personally_invited_at?: string | null
          personally_invited_by?: string | null
          phone?: string | null
          rsvp_note?: string | null
          rsvp_recorded_at?: string | null
          rsvp_recorded_by?: string | null
          rsvp_status?: string
          tags?: string | null
        }
        Update: {
          branding_preset_id?: string | null
          category?: string
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
          invite_sent_at?: string | null
          link_opened_at?: string | null
          passport_expiry?: string | null
          passport_nationality?: string | null
          passport_number?: string | null
          personally_invited?: boolean
          personally_invited_at?: string | null
          personally_invited_by?: string | null
          phone?: string | null
          rsvp_note?: string | null
          rsvp_recorded_at?: string | null
          rsvp_recorded_by?: string | null
          rsvp_status?: string
          tags?: string | null
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
          custom_domain: string | null
          default_travel_need: string
          fees_enabled: boolean
          id: string
          name: string
          note: string | null
          outfits_paid_by_host: boolean
          passport_required: boolean
          pay_instructions: string | null
          public_accent: string | null
          public_bg_url: string | null
          public_intro: string | null
          public_logo_url: string | null
          slug: string | null
          travel_required: boolean
          updated_at: string
        }
        Insert: {
          branding_preset_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_domain?: string | null
          default_travel_need?: string
          fees_enabled?: boolean
          id?: string
          name: string
          note?: string | null
          outfits_paid_by_host?: boolean
          passport_required?: boolean
          pay_instructions?: string | null
          public_accent?: string | null
          public_bg_url?: string | null
          public_intro?: string | null
          public_logo_url?: string | null
          slug?: string | null
          travel_required?: boolean
          updated_at?: string
        }
        Update: {
          branding_preset_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_domain?: string | null
          default_travel_need?: string
          fees_enabled?: boolean
          id?: string
          name?: string
          note?: string | null
          outfits_paid_by_host?: boolean
          passport_required?: boolean
          pay_instructions?: string | null
          public_accent?: string | null
          public_bg_url?: string | null
          public_intro?: string | null
          public_logo_url?: string | null
          slug?: string | null
          travel_required?: boolean
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
          enabled: boolean
          hotel_address: string | null
          hotel_name: string | null
          id: string
          intro: string
          invite_id: string | null
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
          enabled?: boolean
          hotel_address?: string | null
          hotel_name?: string | null
          id?: string
          intro?: string
          invite_id?: string | null
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
          enabled?: boolean
          hotel_address?: string | null
          hotel_name?: string | null
          id?: string
          intro?: string
          invite_id?: string | null
          measurements_deadline?: string | null
          singleton?: boolean
          team_email?: string | null
          team_name?: string | null
          team_whatsapp?: string | null
          timeline?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistics_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: true
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      measurements: {
        Row: {
          armhole: number | null
          bottom_length: number | null
          bust: number | null
          chest: number | null
          created_at: string
          form: string | null
          guest_id: string
          guest_name: string
          height: number | null
          hip: number | null
          id: string
          inseam: number | null
          invite_id: string | null
          neck: number | null
          notes: string | null
          shoulder: number | null
          sleeve_length: number | null
          top_length: number | null
          under_bust: number | null
          unit: string
          updated_at: string
          usual_size: string | null
          waist: number | null
        }
        Insert: {
          armhole?: number | null
          bottom_length?: number | null
          bust?: number | null
          chest?: number | null
          created_at?: string
          form?: string | null
          guest_id: string
          guest_name?: string
          height?: number | null
          hip?: number | null
          id?: string
          inseam?: number | null
          invite_id?: string | null
          neck?: number | null
          notes?: string | null
          shoulder?: number | null
          sleeve_length?: number | null
          top_length?: number | null
          under_bust?: number | null
          unit?: string
          updated_at?: string
          usual_size?: string | null
          waist?: number | null
        }
        Update: {
          armhole?: number | null
          bottom_length?: number | null
          bust?: number | null
          chest?: number | null
          created_at?: string
          form?: string | null
          guest_id?: string
          guest_name?: string
          height?: number | null
          hip?: number | null
          id?: string
          inseam?: number | null
          invite_id?: string | null
          neck?: number | null
          notes?: string | null
          shoulder?: number | null
          sleeve_length?: number | null
          top_length?: number | null
          under_bust?: number | null
          unit?: string
          updated_at?: string
          usual_size?: string | null
          waist?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "measurements_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      outfit_favourites: {
        Row: {
          created_at: string
          id: string
          invite_id: string | null
          outfit_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_id?: string | null
          outfit_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_id?: string | null
          outfit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_favourites_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_favourites_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      outfit_feed_hidden: {
        Row: {
          created_at: string
          event_id: string
          id: string
          invite_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          invite_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          invite_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_feed_hidden_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_feed_hidden_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      outfit_feeds: {
        Row: {
          audience: string
          category: string
          colour: string | null
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          invite_id: string | null
          label: string | null
          max_price: number
          min_price: number
          ready_to_ship: boolean
          ship_in_days: string | null
          sort_order: number
        }
        Insert: {
          audience?: string
          category: string
          colour?: string | null
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          invite_id?: string | null
          label?: string | null
          max_price?: number
          min_price?: number
          ready_to_ship?: boolean
          ship_in_days?: string | null
          sort_order?: number
        }
        Update: {
          audience?: string
          category?: string
          colour?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          invite_id?: string | null
          label?: string | null
          max_price?: number
          min_price?: number
          ready_to_ship?: boolean
          ship_in_days?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "outfit_feeds_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_feeds_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      outfit_import_items: {
        Row: {
          attempts: number
          claimed_at: string | null
          id: number
          job_id: string
          slug: string
          status: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          id?: number
          job_id: string
          slug: string
          status?: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          id?: number
          job_id?: string
          slug?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_import_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "outfit_import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      outfit_import_jobs: {
        Row: {
          boutique_id: string | null
          created_at: string
          created_by: string
          event_id: string | null
          failed: number
          finished_at: string | null
          gender: string | null
          id: string
          imported: number
          invite_id: string | null
          skipped: number
          status: string
          total: number
        }
        Insert: {
          boutique_id?: string | null
          created_at?: string
          created_by?: string
          event_id?: string | null
          failed?: number
          finished_at?: string | null
          gender?: string | null
          id?: string
          imported?: number
          invite_id?: string | null
          skipped?: number
          status?: string
          total?: number
        }
        Update: {
          boutique_id?: string | null
          created_at?: string
          created_by?: string
          event_id?: string | null
          failed?: number
          finished_at?: string | null
          gender?: string | null
          id?: string
          imported?: number
          invite_id?: string | null
          skipped?: number
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "outfit_import_jobs_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
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
          invite_id: string | null
          is_available: boolean
          is_pinned: boolean
          notes: string | null
          price_inr: number | null
          price_note: string | null
          silhouette: string | null
          size_note: string | null
          sizes: Json | null
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
          invite_id?: string | null
          is_available?: boolean
          is_pinned?: boolean
          notes?: string | null
          price_inr?: number | null
          price_note?: string | null
          silhouette?: string | null
          size_note?: string | null
          sizes?: Json | null
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
          invite_id?: string | null
          is_available?: boolean
          is_pinned?: boolean
          notes?: string | null
          price_inr?: number | null
          price_note?: string | null
          silhouette?: string | null
          size_note?: string | null
          sizes?: Json | null
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
          {
            foreignKeyName: "outfits_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_requests: {
        Row: {
          addon_ids: Json
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          invite_id: string | null
          note: string | null
          plan_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          addon_ids?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          invite_id?: string | null
          note?: string | null
          plan_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          addon_ids?: Json
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          invite_id?: string | null
          note?: string | null
          plan_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_requests_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          blurb: string | null
          created_at: string
          features: Json
          id: string
          name: string
          price_amount: number | null
          price_currency: string
          price_period: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          blurb?: string | null
          created_at?: string
          features?: Json
          id: string
          name: string
          price_amount?: number | null
          price_currency?: string
          price_period?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          blurb?: string | null
          created_at?: string
          features?: Json
          id?: string
          name?: string
          price_amount?: number | null
          price_currency?: string
          price_period?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
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
          phone: string | null
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
          phone?: string | null
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
          phone?: string | null
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
          amount_paid: number
          build_fabric: string | null
          build_garment: string | null
          build_size: string | null
          created_at: string
          guest_id: string
          guest_name: string | null
          id: string
          invite_id: string | null
          order_amount: number | null
          order_currency: string
          order_note: string | null
          order_placed_at: string | null
          order_reference: string | null
          order_status: string
          order_status_updated_at: string
          outfit_id: string
          payment_status: string
          shipping_carrier: string | null
          shipping_status: string
          size_choice: string | null
          status: string
          tracking_number: string | null
          tracking_url: string | null
        }
        Insert: {
          amount_paid?: number
          build_fabric?: string | null
          build_garment?: string | null
          build_size?: string | null
          created_at?: string
          guest_id: string
          guest_name?: string | null
          id?: string
          invite_id?: string | null
          order_amount?: number | null
          order_currency?: string
          order_note?: string | null
          order_placed_at?: string | null
          order_reference?: string | null
          order_status?: string
          order_status_updated_at?: string
          outfit_id: string
          payment_status?: string
          shipping_carrier?: string | null
          shipping_status?: string
          size_choice?: string | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
        }
        Update: {
          amount_paid?: number
          build_fabric?: string | null
          build_garment?: string | null
          build_size?: string | null
          created_at?: string
          guest_id?: string
          guest_name?: string | null
          id?: string
          invite_id?: string | null
          order_amount?: number | null
          order_currency?: string
          order_note?: string | null
          order_placed_at?: string | null
          order_reference?: string | null
          order_status?: string
          order_status_updated_at?: string
          outfit_id?: string
          payment_status?: string
          shipping_carrier?: string | null
          shipping_status?: string
          size_choice?: string | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: true
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      room_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          extra_bed: boolean
          guest_name: string
          household: string
          id: string
          invite_id: string
          room_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          extra_bed?: boolean
          guest_name: string
          household: string
          id?: string
          invite_id: string
          room_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          extra_bed?: boolean
          guest_name?: string
          household?: string
          id?: string
          invite_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_assignments_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_assignments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hotel_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_links: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          event_ids: string[]
          id: string
          invite_id: string
          label: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          event_ids?: string[]
          id?: string
          invite_id: string
          label?: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          event_ids?: string[]
          id?: string
          invite_id?: string
          label?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signup_links_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
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
          checkin_date: string | null
          checkin_time: string | null
          checkout_date: string | null
          checkout_time: string | null
          created_at: string
          created_by: string | null
          departure_date: string | null
          departure_flight: string | null
          departure_time: string | null
          guest_name: string | null
          household: string
          id: string
          invite_id: string | null
          notes: string | null
          party_size: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          arrival_date?: string | null
          arrival_flight?: string | null
          arrival_time?: string | null
          checkin_date?: string | null
          checkin_time?: string | null
          checkout_date?: string | null
          checkout_time?: string | null
          created_at?: string
          created_by?: string | null
          departure_date?: string | null
          departure_flight?: string | null
          departure_time?: string | null
          guest_name?: string | null
          household: string
          id?: string
          invite_id?: string | null
          notes?: string | null
          party_size?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          arrival_date?: string | null
          arrival_flight?: string | null
          arrival_time?: string | null
          checkin_date?: string | null
          checkin_time?: string | null
          checkout_date?: string | null
          checkout_time?: string | null
          created_at?: string
          created_by?: string | null
          departure_date?: string | null
          departure_flight?: string | null
          departure_time?: string | null
          guest_name?: string | null
          household?: string
          id?: string
          invite_id?: string | null
          notes?: string | null
          party_size?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travel_plans_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
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
      vendors: {
        Row: {
          agreed_amount: number | null
          category: string
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          invite_id: string | null
          name: string
          notes: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          agreed_amount?: number | null
          category?: string
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invite_id?: string | null
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          agreed_amount?: number | null
          category?: string
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invite_id?: string | null
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "invites"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_broadcasts: {
        Row: {
          created_at: string
          created_by: string | null
          failed_count: number
          failures: Json
          id: string
          invite_id: string | null
          language: string
          sent_count: number
          template_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          failed_count?: number
          failures?: Json
          id?: string
          invite_id?: string | null
          language?: string
          sent_count?: number
          template_name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          failed_count?: number
          failures?: Json
          id?: string
          invite_id?: string | null
          language?: string
          sent_count?: number
          template_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_due_guest_transfers: { Args: never; Returns: number }
      approve_celebration_creator: { Args: { _email: string }; Returns: Json }
      boutique_host_can_manage: {
        Args: { _boutique_id: string }
        Returns: boolean
      }
      boutique_sees_celebration: {
        Args: { _invite_id: string }
        Returns: boolean
      }
      can_boutique_see_guest: { Args: { _guest_id: string }; Returns: boolean }
      can_boutique_see_outfit: {
        Args: { _outfit_id: string }
        Returns: boolean
      }
      can_create_celebration: { Args: never; Returns: boolean }
      celebration_by_slug: { Args: { _slug: string }; Returns: Json }
      celebration_features: { Args: { _invite_id: string }; Returns: Json }
      celebration_has_feature: {
        Args: { _invite_id: string; _key: string }
        Returns: boolean
      }
      celebration_slug_for_domain: { Args: { _host: string }; Returns: string }
      claim_host_access: { Args: never; Returns: Json }
      claim_invite: { Args: { _code: string }; Returns: Json }
      claim_invites_by_email: { Args: never; Returns: number }
      claim_outfit_import_item: {
        Args: never
        Returns: {
          item_id: number
          job_id: string
          slug: string
        }[]
      }
      code_celebration: { Args: { _code_id: string }; Returns: string }
      default_celebration_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      host_can_see_user: { Args: { _user_id: string }; Returns: boolean }
      household_members: {
        Args: never
        Returns: {
          gender: string
          name: string
        }[]
      }
      household_rsvp_summary: {
        Args: never
        Returns: {
          events_answered: number
          events_yes: number
          household: string
          status: string
        }[]
      }
      is_any_host: { Args: never; Returns: boolean }
      is_boutique_member: { Args: { _boutique_id: string }; Returns: boolean }
      is_celebration_host: { Args: { _invite_id: string }; Returns: boolean }
      is_celebration_owner: { Args: { _invite_id: string }; Returns: boolean }
      is_guest_of: { Args: { _invite_id: string }; Returns: boolean }
      is_my_household: {
        Args: { _household: string; _invite_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      mark_invite_opened: { Args: { _code: string }; Returns: undefined }
      my_branding: { Args: never; Returns: Json }
      my_celebration_ids: {
        Args: never
        Returns: {
          invite_id: string
        }[]
      }
      my_contact: { Args: never; Returns: Json }
      my_event_ids: {
        Args: never
        Returns: {
          event_id: string
        }[]
      }
      my_family_needs_wardrobe: { Args: never; Returns: boolean }
      my_features: { Args: never; Returns: Json }
      my_fees_enabled: { Args: never; Returns: boolean }
      my_guest_invite_ids: {
        Args: never
        Returns: {
          invite_id: string
        }[]
      }
      my_household: { Args: never; Returns: string }
      my_outfits_paid_by_host: { Args: never; Returns: boolean }
      my_pay_instructions: { Args: never; Returns: string }
      my_room: { Args: never; Returns: Json }
      my_travel_settings: { Args: never; Returns: Json }
      signup_link_info: { Args: { _token: string }; Returns: Json }
      sync_household_rsvp: { Args: { _household: string }; Returns: undefined }
      sync_household_rsvp_in: {
        Args: { _household: string; _invite_id: string }
        Returns: undefined
      }
      tenancy_report: {
        Args: never
        Returns: {
          table_name: string
          total: number
          unlinked: number
        }[]
      }
      update_my_contact: {
        Args: { _email: string; _phone: string }
        Returns: undefined
      }
      wake_outfit_import_worker: {
        Args: { _base_url: string }
        Returns: undefined
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
