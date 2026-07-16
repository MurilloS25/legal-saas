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
      clients: {
        Row: {
          created_at: string
          exact_address: string
          full_name: string
          id: string
          identification_number: string
          identification_type: string
          marital_status: string
          nationality: string
          occupation: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exact_address: string
          full_name: string
          id?: string
          identification_number: string
          identification_type: string
          marital_status: string
          nationality: string
          occupation: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exact_address?: string
          full_name?: string
          id?: string
          identification_number?: string
          identification_type?: string
          marital_status?: string
          nationality?: string
          occupation?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_activity: {
        Row: {
          actor_user_id: string
          created_at: string
          document_id: string
          event_type: string
          id: string
          metadata: Json
          owner_id: string
          summary: string | null
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          document_id: string
          event_type: string
          id?: string
          metadata?: Json
          owner_id: string
          summary?: string | null
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          document_id?: string
          event_type?: string
          id?: string
          metadata?: Json
          owner_id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_activity_document_owner_fk"
            columns: ["document_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "document_activity_document_owner_fk"
            columns: ["document_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "notarial_index_entries"
            referencedColumns: ["document_id", "owner_id"]
          },
        ]
      }
      document_metadata: {
        Row: {
          client_id: string | null
          created_at: string
          created_for_index: boolean
          created_for_receivable: boolean
          document_type: string
          generated_at: string | null
          id: string
          owner_id: string
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_for_index?: boolean
          created_for_receivable?: boolean
          document_type: string
          generated_at?: string | null
          id?: string
          owner_id: string
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_for_index?: boolean
          created_for_receivable?: boolean
          document_type?: string
          generated_at?: string | null
          id?: string
          owner_id?: string
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_metadata_client_owner_fk"
            columns: ["client_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "document_metadata_template_owner_fk"
            columns: ["template_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      document_notarial_metadata: {
        Row: {
          act_name_override: string | null
          act_name_snapshot: string | null
          authorized_at: string | null
          created_at: string
          document_id: string
          final_folio: string | null
          generated_parties: string | null
          id: string
          initial_folio: string | null
          instrument_number: number | null
          notes: string | null
          owner_id: string
          parties_override: string | null
          protocol_book: string | null
          updated_at: string
          version: number
        }
        Insert: {
          act_name_override?: string | null
          act_name_snapshot?: string | null
          authorized_at?: string | null
          created_at?: string
          document_id: string
          final_folio?: string | null
          generated_parties?: string | null
          id?: string
          initial_folio?: string | null
          instrument_number?: number | null
          notes?: string | null
          owner_id: string
          parties_override?: string | null
          protocol_book?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          act_name_override?: string | null
          act_name_snapshot?: string | null
          authorized_at?: string | null
          created_at?: string
          document_id?: string
          final_folio?: string | null
          generated_parties?: string | null
          id?: string
          initial_folio?: string | null
          instrument_number?: number | null
          notes?: string | null
          owner_id?: string
          parties_override?: string | null
          protocol_book?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "dnm_document_owner_fk"
            columns: ["document_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "dnm_document_owner_fk"
            columns: ["document_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "notarial_index_entries"
            referencedColumns: ["document_id", "owner_id"]
          },
        ]
      }
      document_settings: {
        Row: {
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
        }
        Insert: {
          created_at?: string
          font_family: string
          font_size: number
          id?: string
          line_spacing: number
          margin_bottom_cm: number
          margin_left_cm: number
          margin_right_cm: number
          margin_top_cm: number
          owner_id: string
          updated_at?: string
        }
        Update: {
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
        }
        Relationships: []
      }
      documents: {
        Row: {
          client_id: string | null
          created_at: string
          field_values: Json
          id: string
          owner_id: string
          rendered_content: string
          status: string
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          field_values?: Json
          id?: string
          owner_id: string
          rendered_content?: string
          status?: string
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          field_values?: Json
          id?: string
          owner_id?: string
          rendered_content?: string
          status?: string
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_owner_fk"
            columns: ["client_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "documents_template_owner_fk"
            columns: ["template_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id", "owner_id"]
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
        }
        Relationships: []
      }
      notarial_index_exports: {
        Row: {
          created_at: string
          format: string
          from_date: string | null
          id: string
          owner_id: string
          row_count: number
          to_date: string | null
        }
        Insert: {
          created_at?: string
          format: string
          from_date?: string | null
          id?: string
          owner_id: string
          row_count?: number
          to_date?: string | null
        }
        Update: {
          created_at?: string
          format?: string
          from_date?: string | null
          id?: string
          owner_id?: string
          row_count?: number
          to_date?: string | null
        }
        Relationships: []
      }
      notarial_records: {
        Row: {
          act_or_contract: string
          created_at: string
          deed_date: string
          deed_number: string
          deed_time: string
          document_metadata_id: string
          final_folio: string
          id: string
          initial_folio: string
          owner_id: string
          parties: string
          period_half: string
          period_month: number
          period_year: number
          updated_at: string
          volume: string
        }
        Insert: {
          act_or_contract: string
          created_at?: string
          deed_date: string
          deed_number: string
          deed_time: string
          document_metadata_id: string
          final_folio: string
          id?: string
          initial_folio: string
          owner_id: string
          parties: string
          period_half: string
          period_month: number
          period_year: number
          updated_at?: string
          volume: string
        }
        Update: {
          act_or_contract?: string
          created_at?: string
          deed_date?: string
          deed_number?: string
          deed_time?: string
          document_metadata_id?: string
          final_folio?: string
          id?: string
          initial_folio?: string
          owner_id?: string
          parties?: string
          period_half?: string
          period_month?: number
          period_year?: number
          updated_at?: string
          volume?: string
        }
        Relationships: [
          {
            foreignKeyName: "notarial_records_document_metadata_owner_fk"
            columns: ["document_metadata_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "document_metadata"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      receivable_activity: {
        Row: {
          actor_user_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          owner_id: string
          receivable_id: string
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          owner_id: string
          receivable_id: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          owner_id?: string
          receivable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ra_receivable_owner_fk"
            columns: ["receivable_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "receivable_entries"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "ra_receivable_owner_fk"
            columns: ["receivable_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id", "owner_id"]
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
        }
        Relationships: [
          {
            foreignKeyName: "rp_receivable_owner_fk"
            columns: ["receivable_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "receivable_entries"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "rp_receivable_owner_fk"
            columns: ["receivable_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      receivables: {
        Row: {
          amount_total: number
          client_id: string
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
        }
        Insert: {
          amount_total: number
          client_id: string
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
        }
        Update: {
          amount_total?: number
          client_id?: string
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
        }
        Relationships: [
          {
            foreignKeyName: "receivables_client_owner_fk"
            columns: ["client_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "receivables_document_owner_fk"
            columns: ["document_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "receivables_document_owner_fk"
            columns: ["document_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "notarial_index_entries"
            referencedColumns: ["document_id", "owner_id"]
          },
        ]
      }
      template_fields: {
        Row: {
          created_at: string
          field_key: string
          field_type: string
          id: string
          label: string
          owner_id: string
          required: boolean
          role_key: string | null
          sort_order: number
          source: string | null
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_key: string
          field_type: string
          id?: string
          label: string
          owner_id: string
          required?: boolean
          role_key?: string | null
          sort_order?: number
          source?: string | null
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_key?: string
          field_type?: string
          id?: string
          label?: string
          owner_id?: string
          required?: boolean
          role_key?: string | null
          sort_order?: number
          source?: string | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_fields_template_owner_fk"
            columns: ["template_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id", "owner_id"]
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
        }
        Relationships: [
          {
            foreignKeyName: "template_index_fields_configuration_fk"
            columns: ["configuration_id", "owner_id", "template_id"]
            isOneToOne: false
            referencedRelation: "template_index_configurations"
            referencedColumns: ["id", "owner_id", "template_id"]
          },
          {
            foreignKeyName: "template_index_fields_template_field_fk"
            columns: ["template_field_id", "owner_id", "template_id"]
            isOneToOne: false
            referencedRelation: "template_fields"
            referencedColumns: ["id", "owner_id", "template_id"]
          },
        ]
      }
      template_index_configurations: {
        Row: {
          allow_empty: boolean
          created_at: string
          fixed_suffix: string | null
          id: string
          is_complete: boolean
          owner_id: string
          party_separator: string
          template_id: string
          updated_at: string
        }
        Insert: {
          allow_empty?: boolean
          created_at?: string
          fixed_suffix?: string | null
          id?: string
          is_complete?: boolean
          owner_id: string
          party_separator?: string
          template_id: string
          updated_at?: string
        }
        Update: {
          allow_empty?: boolean
          created_at?: string
          fixed_suffix?: string | null
          id?: string
          is_complete?: boolean
          owner_id?: string
          party_separator?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_index_config_template_owner_fk"
            columns: ["template_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id", "owner_id"]
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
          name: string
          owner_id: string
          status: string
          text_preview: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          content_json?: Json
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          status?: string
          text_preview?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          content_json?: Json
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          status?: string
          text_preview?: string | null
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
          final_folio: string | null
          generated_parties: string | null
          has_metadata: boolean | null
          initial_folio: string | null
          instrument_number: number | null
          is_complete: boolean | null
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
        }
        Relationships: [
          {
            foreignKeyName: "documents_template_owner_fk"
            columns: ["template_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id", "owner_id"]
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
        }
        Relationships: [
          {
            foreignKeyName: "receivables_client_owner_fk"
            columns: ["client_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "receivables_document_owner_fk"
            columns: ["document_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "receivables_document_owner_fk"
            columns: ["document_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "notarial_index_entries"
            referencedColumns: ["document_id", "owner_id"]
          },
        ]
      }
    }
    Functions: {
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

