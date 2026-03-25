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
      companies: {
        Row: {
          address: string | null
          asset_band: string | null
          companies_house_number: string | null
          company_name: string
          created_at: string
          description_of_activities: string | null
          geography: string | null
          id: string
          industry: string | null
          mandate_id: string
          net_assets: number | null
          number_of_employees: number | null
          profit_before_tax: number | null
          revenue: number | null
          revenue_band: string | null
          status: string | null
          total_assets: number | null
          website: string | null
        }
        Insert: {
          address?: string | null
          asset_band?: string | null
          companies_house_number?: string | null
          company_name: string
          created_at?: string
          description_of_activities?: string | null
          geography?: string | null
          id?: string
          industry?: string | null
          mandate_id: string
          net_assets?: number | null
          number_of_employees?: number | null
          profit_before_tax?: number | null
          revenue?: number | null
          revenue_band?: string | null
          status?: string | null
          total_assets?: number | null
          website?: string | null
        }
        Update: {
          address?: string | null
          asset_band?: string | null
          companies_house_number?: string | null
          company_name?: string
          created_at?: string
          description_of_activities?: string | null
          geography?: string | null
          id?: string
          industry?: string | null
          mandate_id?: string
          net_assets?: number | null
          number_of_employees?: number | null
          profit_before_tax?: number | null
          revenue?: number | null
          revenue_band?: string | null
          status?: string | null
          total_assets?: number | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_submissions: {
        Row: {
          asking_price: string | null
          business_summary: string | null
          company_name: string
          consent_given: boolean
          contact_email: string
          contact_name: string
          contact_phone: string | null
          contact_role: string
          ebitda: string | null
          file_urls: string[] | null
          id: string
          industry: string | null
          internal_notes: string | null
          location: string | null
          reason_for_sale: string | null
          revenue: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          asking_price?: string | null
          business_summary?: string | null
          company_name: string
          consent_given?: boolean
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          contact_role?: string
          ebitda?: string | null
          file_urls?: string[] | null
          id?: string
          industry?: string | null
          internal_notes?: string | null
          location?: string | null
          reason_for_sale?: string | null
          revenue?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          asking_price?: string | null
          business_summary?: string | null
          company_name?: string
          consent_given?: boolean
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          contact_role?: string
          ebitda?: string | null
          file_urls?: string[] | null
          id?: string
          industry?: string | null
          internal_notes?: string | null
          location?: string | null
          reason_for_sale?: string | null
          revenue?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      domains: {
        Row: {
          created_at: string
          domain_name: string
          free_companies_remaining: number
          id: string
        }
        Insert: {
          created_at?: string
          domain_name: string
          free_companies_remaining?: number
          id?: string
        }
        Update: {
          created_at?: string
          domain_name?: string
          free_companies_remaining?: number
          id?: string
        }
        Relationships: []
      }
      mandates: {
        Row: {
          companies_delivered: number
          country: string
          created_at: string
          domain_id: string | null
          id: string
          industry_description: string | null
          name: string
          net_assets_max: number | null
          net_assets_min: number | null
          notes: string | null
          outreach_preference: string | null
          regions: string[] | null
          revenue_max: number | null
          revenue_min: number | null
          sic_codes: string | null
          status: Database["public"]["Enums"]["mandate_status"]
          total_assets_max: number | null
          total_assets_min: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          companies_delivered?: number
          country?: string
          created_at?: string
          domain_id?: string | null
          id?: string
          industry_description?: string | null
          name: string
          net_assets_max?: number | null
          net_assets_min?: number | null
          notes?: string | null
          outreach_preference?: string | null
          regions?: string[] | null
          revenue_max?: number | null
          revenue_min?: number | null
          sic_codes?: string | null
          status?: Database["public"]["Enums"]["mandate_status"]
          total_assets_max?: number | null
          total_assets_min?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          companies_delivered?: number
          country?: string
          created_at?: string
          domain_id?: string | null
          id?: string
          industry_description?: string | null
          name?: string
          net_assets_max?: number | null
          net_assets_min?: number | null
          notes?: string | null
          outreach_preference?: string | null
          regions?: string[] | null
          revenue_max?: number | null
          revenue_min?: number | null
          sic_codes?: string | null
          status?: Database["public"]["Enums"]["mandate_status"]
          total_assets_max?: number | null
          total_assets_min?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mandates_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      on_market_deals: {
        Row: {
          ai_summary: string | null
          approval_status: string
          asking_price: string | null
          company_name: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          id: string
          industry: string | null
          listing_type: string
          location: string | null
          net_assets: string | null
          profit: string | null
          revenue: string | null
          scraped_at: string
          source: string
          source_url: string
          submitted_by: string | null
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          approval_status?: string
          asking_price?: string | null
          company_name: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          listing_type?: string
          location?: string | null
          net_assets?: string | null
          profit?: string | null
          revenue?: string | null
          scraped_at?: string
          source: string
          source_url: string
          submitted_by?: string | null
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          approval_status?: string
          asking_price?: string | null
          company_name?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          listing_type?: string
          location?: string | null
          net_assets?: string | null
          profit?: string | null
          revenue?: string | null
          scraped_at?: string
          source?: string
          source_url?: string
          submitted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      outreach_messages: {
        Row: {
          body: string
          closed_at: string | null
          company_id: string
          created_at: string
          follow_up_days: number | null
          follow_up_dismissed_at: string | null
          id: string
          mandate_id: string
          meeting_scheduled_at: string | null
          notes: string | null
          opened_at: string | null
          outcome: string | null
          recipient_email: string | null
          replied_at: string | null
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          closed_at?: string | null
          company_id: string
          created_at?: string
          follow_up_days?: number | null
          follow_up_dismissed_at?: string | null
          id?: string
          mandate_id: string
          meeting_scheduled_at?: string | null
          notes?: string | null
          opened_at?: string | null
          outcome?: string | null
          recipient_email?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          closed_at?: string | null
          company_id?: string
          created_at?: string
          follow_up_days?: number | null
          follow_up_dismissed_at?: string | null
          id?: string
          mandate_id?: string
          meeting_scheduled_at?: string | null
          notes?: string | null
          opened_at?: string | null
          outcome?: string | null
          recipient_email?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_messages_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          domain_id: string | null
          email: string
          full_name: string | null
          id: string
          is_paid: boolean
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          domain_id?: string | null
          email: string
          full_name?: string | null
          id: string
          is_paid?: boolean
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          domain_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_paid?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_logs: {
        Row: {
          completed_at: string | null
          deals_found: number
          error_message: string | null
          id: string
          source: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          deals_found?: number
          error_message?: string | null
          id?: string
          source: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          deals_found?: number
          error_message?: string | null
          id?: string
          source?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      scrape_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          search_query: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          search_query?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          search_query?: string
          updated_at?: string
          url?: string
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
      extract_email_domain: { Args: { email: string }; Returns: string }
      get_user_domain_id: { Args: { user_uuid: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      mandate_status: "draft" | "active" | "completed"
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
      mandate_status: ["draft", "active", "completed"],
    },
  },
} as const
