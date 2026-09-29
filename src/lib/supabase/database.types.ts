export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ai_template_generations: {
        Row: {
          actor_user_id: string
          attempts: number
          counts_toward_quota: boolean
          duration_ms: number | null
          error_code: string | null
          finished_at: string | null
          id: string
          input_chars: number
          input_tokens: number | null
          model: string
          output_tokens: number | null
          provider: string
          review_summary: Json
          schema_version: string
          source_type: string
          started_at: string
          status: string
          template_id: string | null
          workspace_id: string
        }
        Insert: {
          actor_user_id: string
          attempts?: number
          counts_toward_quota?: boolean
          duration_ms?: number | null
          error_code?: string | null
          finished_at?: string | null
          id?: string
          input_chars: number
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          provider: string
          review_summary?: Json
          schema_version: string
          source_type: string
          started_at?: string
          status?: string
          template_id?: string | null
          workspace_id: string
        }
        Update: {
          actor_user_id?: string
          attempts?: number
          counts_toward_quota?: boolean
          duration_ms?: number | null
          error_code?: string | null
          finished_at?: string | null
          id?: string
          input_chars?: number
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          provider?: string
          review_summary?: Json
          schema_version?: string
          source_type?: string
          started_at?: string
          status?: string
          template_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_template_generations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_template_generations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          exact_address: string
          full_name: string
          id: string
          identification_number: string
          identification_search: string | null
          identification_type: string
          marital_status: string | null
          nationality: string | null
          occupation: string | null
          owner_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          exact_address: string
          full_name: string
          id?: string
          identification_number: string
          identification_search?: string | null
          identification_type: string
          marital_status?: string | null
          nationality?: string | null
          occupation?: string | null
          owner_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          exact_address?: string
          full_name?: string
          id?: string
          identification_number?: string
          identification_search?: string | null
          identification_type?: string
          marital_status?: string | null
          nationality?: string | null
          occupation?: string | null
          owner_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      document_activity: {
        Row: {
          actor_name_snapshot: string
          actor_role_snapshot: string
          actor_user_id: string
          created_at: string
          document_id: string
          event_type: string
          id: string
          metadata: Json
          owner_id: string
          summary: string | null
          workspace_id: string
        }
        Insert: {
          actor_name_snapshot: string
          actor_role_snapshot: string
          actor_user_id: string
          created_at?: string
          document_id: string
          event_type: string
          id?: string
          metadata?: Json
          owner_id: string
          summary?: string | null
          workspace_id: string
        }
        Update: {
          actor_name_snapshot?: string
          actor_role_snapshot?: string
          actor_user_id?: string
          created_at?: string
          document_id?: string
          event_type?: string
          id?: string
          metadata?: Json
          owner_id?: string
          summary?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_activity_document_workspace_fk"
            columns: ["document_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "document_activity_document_workspace_fk"
            columns: ["document_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "notarial_index_entries"
            referencedColumns: ["document_id", "workspace_id"]
          },
          {
            foreignKeyName: "document_activity_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      document_notarial_metadata: {
        Row: {
          act_name_override: string | null
          act_name_snapshot: string | null
          authorized_at: string | null
          authorized_date_derived_snapshot: string | null
          authorized_time_derived_snapshot: string | null
          created_at: string
          document_id: string
          final_folio: string | null
          final_folio_derived_snapshot: string | null
          generated_parties: string | null
          id: string
          initial_folio: string | null
          initial_folio_derived_snapshot: string | null
          instrument_number: number | null
          instrument_number_derived_snapshot: number | null
          notarial_confirmed_at: string | null
          notarial_confirmed_by: string | null
          notarial_review_required: boolean
          notes: string | null
          owner_id: string
          parties_override: string | null
          protocol_book: string | null
          protocol_book_derived_snapshot: string | null
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          act_name_override?: string | null
          act_name_snapshot?: string | null
          authorized_at?: string | null
          authorized_date_derived_snapshot?: string | null
          authorized_time_derived_snapshot?: string | null
          created_at?: string
          document_id: string
          final_folio?: string | null
          final_folio_derived_snapshot?: string | null
          generated_parties?: string | null
          id?: string
          initial_folio?: string | null
          initial_folio_derived_snapshot?: string | null
          instrument_number?: number | null
          instrument_number_derived_snapshot?: number | null
          notarial_confirmed_at?: string | null
          notarial_confirmed_by?: string | null
          notarial_review_required?: boolean
          notes?: string | null
          owner_id: string
          parties_override?: string | null
          protocol_book?: string | null
          protocol_book_derived_snapshot?: string | null
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          act_name_override?: string | null
          act_name_snapshot?: string | null
          authorized_at?: string | null
          authorized_date_derived_snapshot?: string | null
          authorized_time_derived_snapshot?: string | null
          created_at?: string
          document_id?: string
          final_folio?: string | null
          final_folio_derived_snapshot?: string | null
          generated_parties?: string | null
          id?: string
          initial_folio?: string | null
          initial_folio_derived_snapshot?: string | null
          instrument_number?: number | null
          instrument_number_derived_snapshot?: number | null
          notarial_confirmed_at?: string | null
          notarial_confirmed_by?: string | null
          notarial_review_required?: boolean
          notes?: string | null
          owner_id?: string
          parties_override?: string | null
          protocol_book?: string | null
          protocol_book_derived_snapshot?: string | null
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dnm_document_workspace_fk"
            columns: ["document_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "dnm_document_workspace_fk"
            columns: ["document_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "notarial_index_entries"
            referencedColumns: ["document_id", "workspace_id"]
          },
          {
            foreignKeyName: "document_notarial_metadata_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      document_settings: {
        Row: {
          back_margin_bottom_cm: number | null
          back_margin_left_cm: number | null
          back_margin_right_cm: number | null
          back_margin_top_cm: number | null
          created_at: string
          font_family: string
          font_size: number
          id: string
          line_spacing: number
          margin_bottom_cm: number
          margin_left_cm: number
          margin_right_cm: number
          margin_top_cm: number
          owner_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          back_margin_bottom_cm?: number | null
          back_margin_left_cm?: number | null
          back_margin_right_cm?: number | null
          back_margin_top_cm?: number | null
          created_at?: string
          font_family: string
          font_size: number
          id?: string
          line_spacing?: number
          margin_bottom_cm: number
          margin_left_cm: number
          margin_right_cm: number
          margin_top_cm: number
          owner_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          back_margin_bottom_cm?: number | null
          back_margin_left_cm?: number | null
          back_margin_right_cm?: number | null
          back_margin_top_cm?: number | null
          created_at?: string
          font_family?: string
          font_size?: number
          id?: string
          line_spacing?: number
          margin_bottom_cm?: number
          margin_left_cm?: number
          margin_right_cm?: number
          margin_top_cm?: number
          owner_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          client_id: string | null
          created_at: string
          field_values: Json
          id: string
          include_in_notarial_index: boolean
          option_selections: Json
          owner_id: string
          rendered_content: string
          status: string
          template_id: string
          template_snapshot: Json | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          field_values?: Json
          id?: string
          include_in_notarial_index?: boolean
          option_selections?: Json
          owner_id: string
          rendered_content?: string
          status?: string
          template_id: string
          template_snapshot?: Json | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          field_values?: Json
          id?: string
          include_in_notarial_index?: boolean
          option_selections?: Json
          owner_id?: string
          rendered_content?: string
          status?: string
          template_id?: string
          template_snapshot?: Json | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_workspace_fk"
            columns: ["client_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "documents_template_workspace_fk"
            columns: ["template_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lawyer_profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          owner_id: string
          phone: string | null
          professional_code: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          owner_id: string
          phone?: string | null
          professional_code?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          owner_id?: string
          phone?: string | null
          professional_code?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lawyer_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notarial_index_exports: {
        Row: {
          actor_name_snapshot: string
          actor_role_snapshot: string
          created_at: string
          format: string
          from_date: string | null
          id: string
          owner_id: string
          row_count: number
          to_date: string | null
          workspace_id: string
        }
        Insert: {
          actor_name_snapshot: string
          actor_role_snapshot: string
          created_at?: string
          format: string
          from_date?: string | null
          id?: string
          owner_id: string
          row_count?: number
          to_date?: string | null
          workspace_id: string
        }
        Update: {
          actor_name_snapshot?: string
          actor_role_snapshot?: string
          created_at?: string
          format?: string
          from_date?: string | null
          id?: string
          owner_id?: string
          row_count?: number
          to_date?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notarial_index_exports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      receivable_activity: {
        Row: {
          actor_name_snapshot: string
          actor_role_snapshot: string
          actor_user_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          owner_id: string
          receivable_id: string
          workspace_id: string
        }
        Insert: {
          actor_name_snapshot: string
          actor_role_snapshot: string
          actor_user_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          owner_id: string
          receivable_id: string
          workspace_id: string
        }
        Update: {
          actor_name_snapshot?: string
          actor_role_snapshot?: string
          actor_user_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          owner_id?: string
          receivable_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_receivable_workspace_fk"
            columns: ["receivable_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "receivable_entries"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "ra_receivable_workspace_fk"
            columns: ["receivable_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "receivable_activity_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      receivable_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          method: string
          owner_id: string
          paid_at: string
          receivable_id: string
          reference: string | null
          status: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          method: string
          owner_id: string
          paid_at?: string
          receivable_id: string
          reference?: string | null
          status?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string
          owner_id?: string
          paid_at?: string
          receivable_id?: string
          reference?: string | null
          status?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivable_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_receivable_workspace_fk"
            columns: ["receivable_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "receivable_entries"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "rp_receivable_workspace_fk"
            columns: ["receivable_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      receivables: {
        Row: {
          amount_total: number
          client_id: string | null
          client_name_snapshot: string
          concept: string
          created_at: string
          currency: string
          document_id: string | null
          due_at: string | null
          id: string
          issued_at: string
          notes: string | null
          owner_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount_total: number
          client_id?: string | null
          client_name_snapshot: string
          concept: string
          created_at?: string
          currency: string
          document_id?: string | null
          due_at?: string | null
          id?: string
          issued_at?: string
          notes?: string | null
          owner_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount_total?: number
          client_id?: string | null
          client_name_snapshot?: string
          concept?: string
          created_at?: string
          currency?: string
          document_id?: string | null
          due_at?: string | null
          id?: string
          issued_at?: string
          notes?: string | null
          owner_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_client_workspace_fk"
            columns: ["client_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "receivables_document_workspace_fk"
            columns: ["document_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "receivables_document_workspace_fk"
            columns: ["document_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "notarial_index_entries"
            referencedColumns: ["document_id", "workspace_id"]
          },
          {
            foreignKeyName: "receivables_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      template_fields: {
        Row: {
          autofill_source: string
          created_at: string
          field_key: string
          field_type: string
          id: string
          label: string
          output_transform: string
          owner_id: string
          required: boolean
          role_key: string | null
          sort_order: number
          source: string | null
          template_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          autofill_source?: string
          created_at?: string
          field_key: string
          field_type: string
          id?: string
          label: string
          output_transform?: string
          owner_id: string
          required?: boolean
          role_key?: string | null
          sort_order?: number
          source?: string | null
          template_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          autofill_source?: string
          created_at?: string
          field_key?: string
          field_type?: string
          id?: string
          label?: string
          output_transform?: string
          owner_id?: string
          required?: boolean
          role_key?: string | null
          sort_order?: number
          source?: string | null
          template_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_fields_template_workspace_fk"
            columns: ["template_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "template_fields_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      template_index_configuration_fields: {
        Row: {
          configuration_id: string
          created_at: string
          id: string
          owner_id: string
          sort_order: number
          template_field_id: string
          template_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          configuration_id: string
          created_at?: string
          id?: string
          owner_id: string
          sort_order: number
          template_field_id: string
          template_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          configuration_id?: string
          created_at?: string
          id?: string
          owner_id?: string
          sort_order?: number
          template_field_id?: string
          template_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_index_configuration_fields_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_index_fields_configuration_workspace_fk"
            columns: ["configuration_id", "workspace_id", "template_id"]
            isOneToOne: false
            referencedRelation: "template_index_configurations"
            referencedColumns: ["id", "workspace_id", "template_id"]
          },
          {
            foreignKeyName: "template_index_fields_template_field_workspace_fk"
            columns: ["template_field_id", "workspace_id", "template_id"]
            isOneToOne: false
            referencedRelation: "template_fields"
            referencedColumns: ["id", "workspace_id", "template_id"]
          },
        ]
      }
      template_index_configurations: {
        Row: {
          allow_empty: boolean
          authorized_date_field_id: string | null
          authorized_time_field_id: string | null
          authorized_time_option_block_id: string | null
          created_at: string
          final_folio_field_id: string | null
          fixed_suffix: string | null
          id: string
          initial_folio_field_id: string | null
          instrument_number_field_id: string | null
          invalid_mappings: string[]
          is_complete: boolean
          owner_id: string
          party_separator: string
          protocol_book_field_id: string | null
          template_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          allow_empty?: boolean
          authorized_date_field_id?: string | null
          authorized_time_field_id?: string | null
          authorized_time_option_block_id?: string | null
          created_at?: string
          final_folio_field_id?: string | null
          fixed_suffix?: string | null
          id?: string
          initial_folio_field_id?: string | null
          instrument_number_field_id?: string | null
          invalid_mappings?: string[]
          is_complete?: boolean
          owner_id: string
          party_separator?: string
          protocol_book_field_id?: string | null
          template_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          allow_empty?: boolean
          authorized_date_field_id?: string | null
          authorized_time_field_id?: string | null
          authorized_time_option_block_id?: string | null
          created_at?: string
          final_folio_field_id?: string | null
          fixed_suffix?: string | null
          id?: string
          initial_folio_field_id?: string | null
          instrument_number_field_id?: string | null
          invalid_mappings?: string[]
          is_complete?: boolean
          owner_id?: string
          party_separator?: string
          protocol_book_field_id?: string | null
          template_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_index_config_date_field_workspace_fk"
            columns: ["authorized_date_field_id", "workspace_id", "template_id"]
            isOneToOne: false
            referencedRelation: "template_fields"
            referencedColumns: ["id", "workspace_id", "template_id"]
          },
          {
            foreignKeyName: "template_index_config_final_folio_field_workspace_fk"
            columns: ["final_folio_field_id", "workspace_id", "template_id"]
            isOneToOne: false
            referencedRelation: "template_fields"
            referencedColumns: ["id", "workspace_id", "template_id"]
          },
          {
            foreignKeyName: "template_index_config_initial_folio_field_workspace_fk"
            columns: ["initial_folio_field_id", "workspace_id", "template_id"]
            isOneToOne: false
            referencedRelation: "template_fields"
            referencedColumns: ["id", "workspace_id", "template_id"]
          },
          {
            foreignKeyName: "template_index_config_instrument_field_workspace_fk"
            columns: [
              "instrument_number_field_id",
              "workspace_id",
              "template_id",
            ]
            isOneToOne: false
            referencedRelation: "template_fields"
            referencedColumns: ["id", "workspace_id", "template_id"]
          },
          {
            foreignKeyName: "template_index_config_protocol_field_workspace_fk"
            columns: ["protocol_book_field_id", "workspace_id", "template_id"]
            isOneToOne: false
            referencedRelation: "template_fields"
            referencedColumns: ["id", "workspace_id", "template_id"]
          },
          {
            foreignKeyName: "template_index_config_template_workspace_fk"
            columns: ["template_id", "workspace_id"]
            isOneToOne: true
            referencedRelation: "templates"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "template_index_config_time_field_workspace_fk"
            columns: ["authorized_time_field_id", "workspace_id", "template_id"]
            isOneToOne: false
            referencedRelation: "template_fields"
            referencedColumns: ["id", "workspace_id", "template_id"]
          },
          {
            foreignKeyName: "template_index_configurations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string | null
          content_json: Json
          created_at: string
          description: string | null
          id: string
          include_in_notarial_index_by_default: boolean
          name: string
          owner_id: string
          status: string
          text_preview: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category?: string | null
          content_json?: Json
          created_at?: string
          description?: string | null
          id?: string
          include_in_notarial_index_by_default?: boolean
          name: string
          owner_id: string
          status?: string
          text_preview?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: string | null
          content_json?: Json
          created_at?: string
          description?: string | null
          id?: string
          include_in_notarial_index_by_default?: boolean
          name?: string
          owner_id?: string
          status?: string
          text_preview?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_activity: {
        Row: {
          actor_name_snapshot: string
          actor_role_snapshot: string
          actor_user_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          target_user_id: string | null
          workspace_id: string
        }
        Insert: {
          actor_name_snapshot: string
          actor_role_snapshot: string
          actor_user_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          target_user_id?: string | null
          workspace_id: string
        }
        Update: {
          actor_name_snapshot?: string
          actor_role_snapshot?: string
          actor_user_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          target_user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_activity_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_ai_settings: {
        Row: {
          ai_template_daily_limit_per_user: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_template_daily_limit_per_user?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ai_template_daily_limit_per_user?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_ai_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          updated_at?: string
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
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      notarial_index_entries: {
        Row: {
          act_name: string | null
          act_name_override: string | null
          act_name_snapshot: string | null
          authorized_at: string | null
          client_name: string | null
          document_id: string | null
          effective_index_date: string | null
          final_folio: string | null
          generated_parties: string | null
          has_metadata: boolean | null
          initial_folio: string | null
          instrument_number: number | null
          is_complete: boolean | null
          notarial_confirmed_at: string | null
          notarial_review_required: boolean | null
          owner_id: string | null
          parties: string | null
          parties_override: string | null
          period_half: string | null
          period_month: number | null
          period_year: number | null
          protocol_book: string | null
          template_id: string | null
          title: string | null
          updated_at: string | null
          version: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_template_workspace_fk"
            columns: ["template_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      receivable_entries: {
        Row: {
          amount_total: number | null
          balance_due: number | null
          client_id: string | null
          client_name: string | null
          concept: string | null
          created_at: string | null
          currency: string | null
          document_id: string | null
          document_title: string | null
          due_at: string | null
          id: string | null
          issued_at: string | null
          owner_id: string | null
          paid_amount: number | null
          status: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receivables_client_workspace_fk"
            columns: ["client_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "receivables_document_workspace_fk"
            columns: ["document_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "receivables_document_workspace_fk"
            columns: ["document_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "notarial_index_entries"
            referencedColumns: ["document_id", "workspace_id"]
          },
          {
            foreignKeyName: "receivables_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_workspace_invitation: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      assert_can_manage_target_member: {
        Args: { p_caller_role: string; p_target_role: string }
        Returns: undefined
      }
      begin_ai_template_generation: {
        Args: {
          p_actor_user_id: string
          p_default_daily_limit: number
          p_input_chars: number
          p_model: string
          p_provider: string
          p_schema_version: string
          p_source_type: string
          p_stale_after_seconds: number
          p_workspace_id: string
        }
        Returns: string
      }
      change_workspace_member_role: {
        Args: { p_role: string; p_user_id: string; p_workspace_id: string }
        Returns: undefined
      }
      finish_ai_template_generation: {
        Args: {
          p_attempts: number
          p_counts_toward_quota: boolean
          p_duration_ms: number
          p_error_code: string
          p_generation_id: string
          p_input_tokens: number
          p_output_tokens: number
          p_review_summary: Json
          p_status: string
          p_template_id: string
        }
        Returns: undefined
      }
      get_pending_workspace_invitation: {
        Args: never
        Returns: {
          role: string
          workspace_id: string
          workspace_name: string
        }[]
      }
      invite_workspace_member: {
        Args: { p_role: string; p_user_id: string }
        Returns: string
      }
      is_workspace_member: {
        Args: { p_roles?: string[]; p_workspace_id: string }
        Returns: boolean
      }
      list_workspace_activity: {
        Args: { p_limit?: number }
        Returns: {
          actor_name_snapshot: string
          actor_role_snapshot: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          target_email: string
        }[]
      }
      list_workspace_members: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          invited_by: string
          role: string
          status: string
          user_id: string
        }[]
      }
      log_document_word_generated: {
        Args: { p_document_id: string }
        Returns: undefined
      }
      log_notarial_index_export: {
        Args: {
          p_format: string
          p_from: string
          p_row_count: number
          p_to: string
        }
        Returns: undefined
      }
      reactivate_workspace_member: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: undefined
      }
      receivables_summary: {
        Args: {
          p_client?: string
          p_currency?: string
          p_doc_presence?: string
          p_document?: string
          p_due_from?: string
          p_due_to?: string
          p_issued_from?: string
          p_issued_to?: string
          p_search?: string
          p_status?: string
        }
        Returns: {
          balance: number
          count: number
          currency: string
          paid: number
          total: number
        }[]
      }
      register_receivable_payment: {
        Args: {
          p_amount: number
          p_method: string
          p_paid_at: string
          p_receivable_id: string
          p_reference: string
        }
        Returns: string
      }
      remove_workspace_member: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: undefined
      }
      resolve_actor_snapshot: {
        Args: { p_actor_user_id: string; p_workspace_id: string }
        Returns: Record<string, unknown>
      }
      save_template_index_configuration: {
        Args: {
          p_allow_empty: boolean
          p_fields: Json
          p_fixed_suffix: string
          p_party_separator: string
          p_template_id: string
        }
        Returns: string
      }
      save_template_index_mapping: {
        Args: {
          p_allow_empty: boolean
          p_fixed_suffix: string
          p_party_fields: Json
          p_party_separator: string
          p_simple_fields: Json
          p_template_id: string
        }
        Returns: string
      }
      save_template_index_mapping_with_block_source: {
        Args: {
          p_allow_empty: boolean
          p_authorized_time_option_block_id: string
          p_fixed_suffix: string
          p_party_fields: Json
          p_party_separator: string
          p_simple_fields: Json
          p_template_id: string
        }
        Returns: string
      }
      save_template_workspace: {
        Args: {
          p_content_json: Json
          p_description: string
          p_expected_updated_at: string
          p_fields: Json
          p_name: string
          p_status: string
          p_template_id: string
          p_text_preview: string
        }
        Returns: {
          template_id: string
          updated_at: string
        }[]
      }
      set_template_notarial_index_default: {
        Args: { p_include_by_default: boolean; p_template_id: string }
        Returns: string
      }
      suspend_workspace_member: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: undefined
      }
      void_receivable_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: undefined
      }
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

