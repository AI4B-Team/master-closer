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
      agents: {
        Row: {
          active: boolean
          created_at: string
          default_mode: Database["public"]["Enums"]["autonomy_mode"]
          id: string
          industry: string | null
          name: string
          org_id: string
          system_prompt: string | null
          transfer_to: string | null
          voice: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_mode?: Database["public"]["Enums"]["autonomy_mode"]
          id?: string
          industry?: string | null
          name: string
          org_id: string
          system_prompt?: string | null
          transfer_to?: string | null
          voice?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          default_mode?: Database["public"]["Enums"]["autonomy_mode"]
          id?: string
          industry?: string | null
          name?: string
          org_id?: string
          system_prompt?: string | null
          transfer_to?: string | null
          voice?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_lists: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_lists_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          agent_id: string | null
          campaign_id: string | null
          close_probability: number
          dial_outcome: Database["public"]["Enums"]["dial_outcome"] | null
          disposition: string | null
          duration_sec: number
          ended_at: string | null
          id: string
          lead_id: string | null
          list_contact_id: string | null
          mode: Database["public"]["Enums"]["autonomy_mode"]
          org_id: string
          outcome: Database["public"]["Enums"]["call_outcome"]
          recording_url: string | null
          rep_id: string | null
          started_at: string
          summary: string | null
        }
        Insert: {
          agent_id?: string | null
          campaign_id?: string | null
          close_probability?: number
          dial_outcome?: Database["public"]["Enums"]["dial_outcome"] | null
          disposition?: string | null
          duration_sec?: number
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          list_contact_id?: string | null
          mode?: Database["public"]["Enums"]["autonomy_mode"]
          org_id: string
          outcome?: Database["public"]["Enums"]["call_outcome"]
          recording_url?: string | null
          rep_id?: string | null
          started_at?: string
          summary?: string | null
        }
        Update: {
          agent_id?: string | null
          campaign_id?: string | null
          close_probability?: number
          dial_outcome?: Database["public"]["Enums"]["dial_outcome"] | null
          disposition?: string | null
          duration_sec?: number
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          list_contact_id?: string | null
          mode?: Database["public"]["Enums"]["autonomy_mode"]
          org_id?: string
          outcome?: Database["public"]["Enums"]["call_outcome"]
          recording_url?: string | null
          rep_id?: string | null
          started_at?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_list_contact_id_fkey"
            columns: ["list_contact_id"]
            isOneToOne: false
            referencedRelation: "list_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          agent_id: string | null
          created_at: string
          id: string
          mode: Database["public"]["Enums"]["autonomy_mode"]
          name: string
          org_id: string
          status: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["autonomy_mode"]
          name: string
          org_id: string
          status?: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["autonomy_mode"]
          name?: string
          org_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_logs: {
        Row: {
          call_id: string | null
          disclosed_at: string
          id: string
          jurisdiction: string | null
          method: string
          notes: string | null
          org_id: string
        }
        Insert: {
          call_id?: string | null
          disclosed_at?: string
          id?: string
          jurisdiction?: string | null
          method: string
          notes?: string | null
          org_id: string
        }
        Update: {
          call_id?: string | null
          disclosed_at?: string
          id?: string
          jurisdiction?: string | null
          method?: string
          notes?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_logs_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          close_probability: number
          created_at: string
          expected_close_at: string | null
          id: string
          lead_id: string | null
          org_id: string
          owner_id: string | null
          stage: Database["public"]["Enums"]["deal_stage"]
          title: string
          updated_at: string
          value: number
        }
        Insert: {
          close_probability?: number
          created_at?: string
          expected_close_at?: string | null
          id?: string
          lead_id?: string | null
          org_id: string
          owner_id?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          title: string
          updated_at?: string
          value?: number
        }
        Update: {
          close_probability?: number
          created_at?: string
          expected_close_at?: string | null
          id?: string
          lead_id?: string | null
          org_id?: string
          owner_id?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          title?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dial_sessions: {
        Row: {
          calls_made: number
          campaign_id: string | null
          connects: number
          ended_at: string | null
          id: string
          org_id: string
          rep_id: string | null
          started_at: string
        }
        Insert: {
          calls_made?: number
          campaign_id?: string | null
          connects?: number
          ended_at?: string | null
          id?: string
          org_id: string
          rep_id?: string | null
          started_at?: string
        }
        Update: {
          calls_made?: number
          campaign_id?: string | null
          connects?: number
          ended_at?: string | null
          id?: string
          org_id?: string
          rep_id?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dial_sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dial_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      disclosure_settings: {
        Row: {
          booking_confirmation: boolean
          created_at: string
          default_jurisdiction: string
          id: string
          org_id: string
          outbound_pre_connect_audio: boolean
          script: string
          spoken_at_call_open: boolean
          updated_at: string
        }
        Insert: {
          booking_confirmation?: boolean
          created_at?: string
          default_jurisdiction?: string
          id?: string
          org_id: string
          outbound_pre_connect_audio?: boolean
          script?: string
          spoken_at_call_open?: boolean
          updated_at?: string
        }
        Update: {
          booking_confirmation?: boolean
          created_at?: string
          default_jurisdiction?: string
          id?: string
          org_id?: string
          outbound_pre_connect_audio?: boolean
          script?: string
          spoken_at_call_open?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      dnc_list: {
        Row: {
          added_at: string
          id: string
          org_id: string
          phone: string
          reason: string | null
        }
        Insert: {
          added_at?: string
          id?: string
          org_id: string
          phone: string
          reason?: string | null
        }
        Update: {
          added_at?: string
          id?: string
          org_id?: string
          phone?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dnc_list_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          org_id: string
          payload: Json
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          org_id: string
          payload?: Json
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          org_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json
          connected_at: string | null
          id: string
          org_id: string
          provider: string
          status: string
        }
        Insert: {
          config?: Json
          connected_at?: string | null
          id?: string
          org_id: string
          provider: string
          status?: string
        }
        Update: {
          config?: Json
          connected_at?: string | null
          id?: string
          org_id?: string
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company: string | null
          consent: Database["public"]["Enums"]["consent_state"]
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          owner_id: string | null
          phone: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          tags: string[] | null
          title: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          consent?: Database["public"]["Enums"]["consent_state"]
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          owner_id?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          consent?: Database["public"]["Enums"]["consent_state"]
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          owner_id?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      list_contacts: {
        Row: {
          attempts: number
          consent: Database["public"]["Enums"]["consent_state"]
          email: string | null
          id: string
          last_outcome: Database["public"]["Enums"]["dial_outcome"] | null
          list_id: string
          name: string
          phone: string
        }
        Insert: {
          attempts?: number
          consent?: Database["public"]["Enums"]["consent_state"]
          email?: string | null
          id?: string
          last_outcome?: Database["public"]["Enums"]["dial_outcome"] | null
          list_id: string
          name: string
          phone: string
        }
        Update: {
          attempts?: number
          consent?: Database["public"]["Enums"]["consent_state"]
          email?: string | null
          id?: string
          last_outcome?: Database["public"]["Enums"]["dial_outcome"] | null
          list_id?: string
          name?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "call_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      objections: {
        Row: {
          category: string | null
          created_at: string
          id: string
          org_id: string
          response: string
          trigger: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          org_id: string
          response: string
          trigger: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          org_id?: string
          response?: string
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "objections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_webhooks: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          org_id: string
          secret: string
          url: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          org_id: string
          secret: string
          url: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          org_id?: string
          secret?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_webhooks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          real_elite_org_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          real_elite_org_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          real_elite_org_id?: string | null
        }
        Relationships: []
      }
      playbooks: {
        Row: {
          content: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbooks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          org_id: string
          real_elite_user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          org_id: string
          real_elite_user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          org_id?: string
          real_elite_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestions: {
        Row: {
          call_id: string
          id: string
          line: string
          objection: string
          ts_sec: number
          was_used: boolean
        }
        Insert: {
          call_id: string
          id?: string
          line: string
          objection: string
          ts_sec?: number
          was_used?: boolean
        }
        Update: {
          call_id?: string
          id?: string
          line?: string
          objection?: string
          ts_sec?: number
          was_used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_segments: {
        Row: {
          call_id: string
          id: string
          speaker: string
          text: string
          ts_sec: number
        }
        Insert: {
          call_id: string
          id?: string
          speaker: string
          text: string
          ts_sec?: number
        }
        Update: {
          call_id?: string
          id?: string
          speaker?: string
          text?: string
          ts_sec?: number
        }
        Relationships: [
          {
            foreignKeyName: "transcript_segments_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          delivered_at: string
          error: string | null
          event_id: string
          id: string
          status_code: number | null
          webhook_id: string
        }
        Insert: {
          delivered_at?: string
          error?: string | null
          event_id: string
          id?: string
          status_code?: number | null
          webhook_id: string
        }
        Update: {
          delivered_at?: string
          error?: string | null
          event_id?: string
          id?: string
          status_code?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "org_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_org_to_hub: {
        Args: { _reo_org_id: string; _reo_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "rep"
      autonomy_mode: "full_ai" | "hybrid" | "copilot"
      call_outcome:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "no_answer"
        | "voicemail"
        | "failed"
      consent_state: "unknown" | "implied" | "express_written" | "opt_out"
      deal_stage:
        | "new"
        | "qualifying"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      dial_outcome:
        | "connected"
        | "no_answer"
        | "voicemail"
        | "busy"
        | "failed"
        | "dnc"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "unqualified"
        | "customer"
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
      app_role: ["admin", "manager", "rep"],
      autonomy_mode: ["full_ai", "hybrid", "copilot"],
      call_outcome: [
        "scheduled",
        "in_progress",
        "completed",
        "no_answer",
        "voicemail",
        "failed",
      ],
      consent_state: ["unknown", "implied", "express_written", "opt_out"],
      deal_stage: [
        "new",
        "qualifying",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      dial_outcome: [
        "connected",
        "no_answer",
        "voicemail",
        "busy",
        "failed",
        "dnc",
      ],
      lead_status: ["new", "contacted", "qualified", "unqualified", "customer"],
    },
  },
} as const
