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
      agent_proposals: {
        Row: {
          agent_id: string | null
          agent_key: string | null
          created_at: string
          current_value: Json | null
          evidence_refs: Json
          expires_at: string
          id: string
          proposal_type: string
          proposed_value: Json | null
          rationale: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_field: string | null
          target_id: string | null
          target_table: string | null
          workspace_id: string | null
        }
        Insert: {
          agent_id?: string | null
          agent_key?: string | null
          created_at?: string
          current_value?: Json | null
          evidence_refs?: Json
          expires_at?: string
          id?: string
          proposal_type: string
          proposed_value?: Json | null
          rationale: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_field?: string | null
          target_id?: string | null
          target_table?: string | null
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string | null
          agent_key?: string | null
          created_at?: string
          current_value?: Json | null
          evidence_refs?: Json
          expires_at?: string
          id?: string
          proposal_type?: string
          proposed_value?: Json | null
          rationale?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_field?: string | null
          target_id?: string | null
          target_table?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_proposals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "background_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_proposals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_proposals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent_id: string | null
          agent_key: string | null
          error: string | null
          finished_at: string | null
          id: string
          items_actioned: number
          items_examined: number
          items_flagged: number
          started_at: string
          status: string
          summary: string | null
          workspace_id: string | null
        }
        Insert: {
          agent_id?: string | null
          agent_key?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          items_actioned?: number
          items_examined?: number
          items_flagged?: number
          started_at?: string
          status?: string
          summary?: string | null
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string | null
          agent_key?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          items_actioned?: number
          items_examined?: number
          items_flagged?: number
          started_at?: string
          status?: string
          summary?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "background_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
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
          voices: string[]
          workspace_id: string
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
          voices?: string[]
          workspace_id: string
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
          voices?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_events: {
        Row: {
          agreement_id: string
          created_at: string
          event_type: string
          id: string
          meta: Json
          org_id: string
        }
        Insert: {
          agreement_id: string
          created_at?: string
          event_type: string
          id?: string
          meta?: Json
          org_id: string
        }
        Update: {
          agreement_id?: string
          created_at?: string
          event_type?: string
          id?: string
          meta?: Json
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_events_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          file_mime: string | null
          file_name: string | null
          file_path: string | null
          id: string
          is_default: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          is_default?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agreements: {
        Row: {
          amount: number
          body: string
          call_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string | null
          declined_at: string | null
          file_name: string | null
          file_path: string | null
          id: string
          lead_id: string | null
          org_id: string
          sent_at: string | null
          signature_data: string | null
          signature_type: string | null
          signed_at: string | null
          signer_email: string | null
          signer_ip: string | null
          signer_name: string | null
          signer_phone: string | null
          status: string
          template_id: string | null
          title: string
          token: string
          updated_at: string
          viewed_at: string | null
          workspace_id: string
        }
        Insert: {
          amount?: number
          body?: string
          call_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          declined_at?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          lead_id?: string | null
          org_id: string
          sent_at?: string | null
          signature_data?: string | null
          signature_type?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signer_phone?: string | null
          status?: string
          template_id?: string | null
          title: string
          token?: string
          updated_at?: string
          viewed_at?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          body?: string
          call_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          declined_at?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          lead_id?: string | null
          org_id?: string
          sent_at?: string | null
          signature_data?: string | null
          signature_type?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_ip?: string | null
          signer_name?: string | null
          signer_phone?: string | null
          status?: string
          template_id?: string | null
          title?: string
          token?: string
          updated_at?: string
          viewed_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreements_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "agreement_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      background_agents: {
        Row: {
          agent_key: string
          config: Json
          consecutive_failures: number
          created_at: string
          enabled: boolean
          id: string
          interval_minutes: number
          last_run_at: string | null
          mode: string
          next_run_at: string | null
          workspace_id: string | null
        }
        Insert: {
          agent_key: string
          config?: Json
          consecutive_failures?: number
          created_at?: string
          enabled?: boolean
          id?: string
          interval_minutes: number
          last_run_at?: string | null
          mode?: string
          next_run_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          agent_key?: string
          config?: Json
          consecutive_failures?: number
          created_at?: string
          enabled?: boolean
          id?: string
          interval_minutes?: number
          last_run_at?: string | null
          mode?: string
          next_run_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "background_agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_lists_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_lists_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
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
          {
            foreignKeyName: "calls_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          agent_id: string | null
          created_at: string
          daily_cap: number
          goal: string | null
          id: string
          list_id: string | null
          mode: Database["public"]["Enums"]["autonomy_mode"]
          name: string
          org_id: string
          status: string
          workspace_id: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          daily_cap?: number
          goal?: string | null
          id?: string
          list_id?: string | null
          mode?: Database["public"]["Enums"]["autonomy_mode"]
          name: string
          org_id: string
          status?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          daily_cap?: number
          goal?: string | null
          id?: string
          list_id?: string | null
          mode?: Database["public"]["Enums"]["autonomy_mode"]
          name?: string
          org_id?: string
          status?: string
          workspace_id?: string
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
            foreignKeyName: "campaigns_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "call_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
        }
        Insert: {
          call_id?: string | null
          disclosed_at?: string
          id?: string
          jurisdiction?: string | null
          method: string
          notes?: string | null
          org_id: string
          workspace_id: string
        }
        Update: {
          call_id?: string | null
          disclosed_at?: string
          id?: string
          jurisdiction?: string | null
          method?: string
          notes?: string | null
          org_id?: string
          workspace_id?: string
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
          {
            foreignKeyName: "consent_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          created_at: string
          crm_id: string | null
          email: string | null
          id: string
          name: string | null
          org_id: string | null
          phone: string | null
          suppressed: boolean
          suppressed_at: string | null
          timezone: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          crm_id?: string | null
          email?: string | null
          id?: string
          name?: string | null
          org_id?: string | null
          phone?: string | null
          suppressed?: boolean
          suppressed_at?: string | null
          timezone?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          crm_id?: string | null
          email?: string | null
          id?: string
          name?: string | null
          org_id?: string | null
          phone?: string | null
          suppressed?: boolean
          suppressed_at?: string | null
          timezone?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_outcomes: {
        Row: {
          anchor_days_remaining: number | null
          call_id: string | null
          campaign_step_id: string | null
          closer_profile_id: string | null
          confidence: number | null
          contact_id: string | null
          flagged: boolean
          id: string
          labeled_at: string
          labeler_version: string | null
          lead_id: string | null
          lead_line_id: string | null
          mode: string | null
          objection_category: string | null
          outcome: string
          sentiment: string | null
          superseded_at: string | null
          thread_id: string | null
          touches_before_outcome: number | null
          variant_hash: string | null
          workspace_id: string
        }
        Insert: {
          anchor_days_remaining?: number | null
          call_id?: string | null
          campaign_step_id?: string | null
          closer_profile_id?: string | null
          confidence?: number | null
          contact_id?: string | null
          flagged?: boolean
          id?: string
          labeled_at?: string
          labeler_version?: string | null
          lead_id?: string | null
          lead_line_id?: string | null
          mode?: string | null
          objection_category?: string | null
          outcome: string
          sentiment?: string | null
          superseded_at?: string | null
          thread_id?: string | null
          touches_before_outcome?: number | null
          variant_hash?: string | null
          workspace_id: string
        }
        Update: {
          anchor_days_remaining?: number | null
          call_id?: string | null
          campaign_step_id?: string | null
          closer_profile_id?: string | null
          confidence?: number | null
          contact_id?: string | null
          flagged?: boolean
          id?: string
          labeled_at?: string
          labeler_version?: string | null
          lead_id?: string | null
          lead_line_id?: string | null
          mode?: string | null
          objection_category?: string | null
          outcome?: string
          sentiment?: string | null
          superseded_at?: string | null
          thread_id?: string | null
          touches_before_outcome?: number | null
          variant_hash?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_outcomes_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_outcomes_closer_profile_id_fkey"
            columns: ["closer_profile_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_outcomes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_outcomes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_voices: {
        Row: {
          base_voice: string
          created_at: string
          id: string
          name: string
          org_id: string
          style: string | null
          workspace_id: string
        }
        Insert: {
          base_voice?: string
          created_at?: string
          id?: string
          name: string
          org_id: string
          style?: string | null
          workspace_id: string
        }
        Update: {
          base_voice?: string
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          style?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_voices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_voices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          sort_order: number
          stage: Database["public"]["Enums"]["deal_stage"]
          stage_id: string | null
          title: string
          updated_at: string
          value: number
          workspace_id: string
        }
        Insert: {
          close_probability?: number
          created_at?: string
          expected_close_at?: string | null
          id?: string
          lead_id?: string | null
          org_id: string
          owner_id?: string | null
          sort_order?: number
          stage?: Database["public"]["Enums"]["deal_stage"]
          stage_id?: string | null
          title: string
          updated_at?: string
          value?: number
          workspace_id: string
        }
        Update: {
          close_probability?: number
          created_at?: string
          expected_close_at?: string | null
          id?: string
          lead_id?: string | null
          org_id?: string
          owner_id?: string | null
          sort_order?: number
          stage?: Database["public"]["Enums"]["deal_stage"]
          stage_id?: string | null
          title?: string
          updated_at?: string
          value?: number
          workspace_id?: string
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
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
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
          {
            foreignKeyName: "dial_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disclosure_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dnc_list: {
        Row: {
          added_at: string
          id: string
          org_id: string
          phone: string
          reason: string | null
          workspace_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          org_id: string
          phone: string
          reason?: string | null
          workspace_id: string
        }
        Update: {
          added_at?: string
          id?: string
          org_id?: string
          phone?: string
          reason?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dnc_list_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dnc_list_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          org_id: string
          payload?: Json
          workspace_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          org_id?: string
          payload?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          body: string
          category: string | null
          created_at: string
          id: string
          org_id: string
          page: string | null
          user_id: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          id?: string
          org_id: string
          page?: string | null
          user_id: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          org_id?: string
          page?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_org_id_fkey"
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
          updated_at: string
          workspace_id: string
        }
        Insert: {
          config?: Json
          connected_at?: string | null
          id?: string
          org_id: string
          provider: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          config?: Json
          connected_at?: string | null
          id?: string
          org_id?: string
          provider?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_lines: {
        Row: {
          anchor_date: string | null
          anchor_type: string | null
          closer_profile_id: string | null
          contact_id: string
          created_at: string
          disposition: string | null
          eligible_at: string | null
          id: string
          last_touch_at: string | null
          owner_user_id: string | null
          product_line: string
          stage: string | null
          status: string
          touches: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          anchor_date?: string | null
          anchor_type?: string | null
          closer_profile_id?: string | null
          contact_id: string
          created_at?: string
          disposition?: string | null
          eligible_at?: string | null
          id?: string
          last_touch_at?: string | null
          owner_user_id?: string | null
          product_line: string
          stage?: string | null
          status?: string
          touches?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          anchor_date?: string | null
          anchor_type?: string | null
          closer_profile_id?: string | null
          contact_id?: string
          created_at?: string
          disposition?: string | null
          eligible_at?: string | null
          id?: string
          last_touch_at?: string | null
          owner_user_id?: string | null
          product_line?: string
          stage?: string | null
          status?: string
          touches?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_lines_closer_profile_id_fkey"
            columns: ["closer_profile_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_lines_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_lines_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_lines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
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
          workspace_id: string
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
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "call_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          org_id: string
          response: string
          trigger: string
          workspace_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          org_id?: string
          response?: string
          trigger?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "objections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          org_id: string
          secret: string
          url: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          org_id?: string
          secret?: string
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_webhooks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_webhooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
      pipeline_stages: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string
          org_id: string
          position: number
          stale_days: number
          updated_at: string
          wip_limit: number | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          label: string
          org_id: string
          position?: number
          stale_days?: number
          updated_at?: string
          wip_limit?: number | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string
          org_id?: string
          position?: number
          stale_days?: number
          updated_at?: string
          wip_limit?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      playbooks: {
        Row: {
          content: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
          workspace_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          workspace_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbooks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playbooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          agent_id: string | null
          confidence: number
          created_at: string
          id: string
          line: string | null
          mode: string
          objection: string | null
          org_id: string
          prospect: string
          tone: string | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          agent_id?: string | null
          confidence?: number
          created_at?: string
          id?: string
          line?: string | null
          mode?: string
          objection?: string | null
          org_id: string
          prospect: string
          tone?: string | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          agent_id?: string | null
          confidence?: number
          created_at?: string
          id?: string
          line?: string | null
          mode?: string
          objection?: string | null
          org_id?: string
          prospect?: string
          tone?: string | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_workspace_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          org_id: string
          real_elite_user_id: string | null
          tour_status: string | null
        }
        Insert: {
          active_workspace_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          org_id: string
          real_elite_user_id?: string | null
          tour_status?: string | null
        }
        Update: {
          active_workspace_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          org_id?: string
          real_elite_user_id?: string | null
          tour_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_workspace_id_fkey"
            columns: ["active_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scorer_weights: {
        Row: {
          fitted_at: string | null
          fitted_on: number
          id: string
          is_default: boolean
          product_line: string
          updated_at: string
          weights: Json
          workspace_id: string
        }
        Insert: {
          fitted_at?: string | null
          fitted_on?: number
          id?: string
          is_default?: boolean
          product_line?: string
          updated_at?: string
          weights?: Json
          workspace_id: string
        }
        Update: {
          fitted_at?: string | null
          fitted_on?: number
          id?: string
          is_default?: boolean
          product_line?: string
          updated_at?: string
          weights?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scorer_weights_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
        }
        Insert: {
          call_id: string
          id?: string
          line: string
          objection: string
          ts_sec?: number
          was_used?: boolean
          workspace_id: string
        }
        Update: {
          call_id?: string
          id?: string
          line?: string
          objection?: string
          ts_sec?: number
          was_used?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      takeover_library: {
        Row: {
          ai_drafted: string | null
          anchor_days: number | null
          call_id: string | null
          closer_profile_id: string | null
          created_at: string
          human_said: string | null
          id: string
          mode: string | null
          objection_category: string | null
          positive: boolean
          sentiment: string | null
          subsequent_outcome: string | null
          workspace_id: string
        }
        Insert: {
          ai_drafted?: string | null
          anchor_days?: number | null
          call_id?: string | null
          closer_profile_id?: string | null
          created_at?: string
          human_said?: string | null
          id?: string
          mode?: string | null
          objection_category?: string | null
          positive?: boolean
          sentiment?: string | null
          subsequent_outcome?: string | null
          workspace_id: string
        }
        Update: {
          ai_drafted?: string | null
          anchor_days?: number | null
          call_id?: string | null
          closer_profile_id?: string | null
          created_at?: string
          human_said?: string | null
          id?: string
          mode?: string | null
          objection_category?: string | null
          positive?: boolean
          sentiment?: string | null
          subsequent_outcome?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "takeover_library_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takeover_library_closer_profile_id_fkey"
            columns: ["closer_profile_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takeover_library_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          call_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          due_at: string | null
          id: string
          lead_id: string | null
          notes: string | null
          org_id: string
          priority: string
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assignee_id?: string | null
          call_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          org_id: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assignee_id?: string | null
          call_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          org_id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
        }
        Insert: {
          call_id: string
          id?: string
          speaker: string
          text: string
          ts_sec?: number
          workspace_id: string
        }
        Update: {
          call_id?: string
          id?: string
          speaker?: string
          text?: string
          ts_sec?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_segments_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcript_segments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string
        }
        Insert: {
          delivered_at?: string
          error?: string | null
          event_id: string
          id?: string
          status_code?: number | null
          webhook_id: string
          workspace_id: string
        }
        Update: {
          delivered_at?: string
          error?: string | null
          event_id?: string
          id?: string
          status_code?: number | null
          webhook_id?: string
          workspace_id?: string
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
          {
            foreignKeyName: "webhook_deliveries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      worklist_feedback: {
        Row: {
          action: string
          contact_id: string | null
          created_at: string
          id: string
          lead_id: string | null
          lead_line_id: string | null
          nomination_id: string | null
          score_at_action: number | null
          undone: boolean
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          contact_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          lead_line_id?: string | null
          nomination_id?: string | null
          score_at_action?: number | null
          undone?: boolean
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          lead_line_id?: string | null
          nomination_id?: string | null
          score_at_action?: number | null
          undone?: boolean
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worklist_feedback_nomination_id_fkey"
            columns: ["nomination_id"]
            isOneToOne: false
            referencedRelation: "worklist_nominations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worklist_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worklist_feedback_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      worklist_nominations: {
        Row: {
          contact_id: string | null
          expires_at: string
          id: string
          lead_id: string | null
          lead_line_id: string | null
          nominated_at: string
          reason_code: string
          reason_text: string
          score: number
          suggested: boolean
          workspace_id: string
        }
        Insert: {
          contact_id?: string | null
          expires_at?: string
          id?: string
          lead_id?: string | null
          lead_line_id?: string | null
          nominated_at?: string
          reason_code: string
          reason_text: string
          score?: number
          suggested?: boolean
          workspace_id: string
        }
        Update: {
          contact_id?: string | null
          expires_at?: string
          id?: string
          lead_id?: string | null
          lead_line_id?: string | null
          nominated_at?: string
          reason_code?: string
          reason_text?: string
          score?: number
          suggested?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worklist_nominations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worklist_nominations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worklist_nominations_lead_line_id_fkey"
            columns: ["lead_line_id"]
            isOneToOne: false
            referencedRelation: "lead_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worklist_nominations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: string
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role?: string
          token: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          brand_color: string
          business_state: string | null
          created_at: string
          default_caller_id: string | null
          id: string
          legal_business_name: string | null
          logo_url: string | null
          name: string
          org_id: string | null
          owner_id: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          brand_color?: string
          business_state?: string | null
          created_at?: string
          default_caller_id?: string | null
          id?: string
          legal_business_name?: string | null
          logo_url?: string | null
          name: string
          org_id?: string | null
          owner_id: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          brand_color?: string
          business_state?: string | null
          created_at?: string
          default_caller_id?: string | null
          id?: string
          legal_business_name?: string | null
          logo_url?: string | null
          name?: string
          org_id?: string | null
          owner_id?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      active_workspace_id: { Args: never; Returns: string }
      auth_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_workspace_member: { Args: { ws: string }; Returns: boolean }
      seed_background_agents: { Args: { ws: string }; Returns: undefined }
      workspace_role: { Args: { ws: string }; Returns: string }
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
