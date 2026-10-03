export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      absences: {
        Row: {
          child_id: string;
          created_by: string | null;
          id: string;
          make_up_eligible: boolean;
          occurrence_id: string;
          organisation_id: string;
          reason: string | null;
          reported_at: string;
        };
        Insert: {
          child_id: string;
          created_by?: string | null;
          id?: string;
          make_up_eligible?: boolean;
          occurrence_id: string;
          organisation_id: string;
          reason?: string | null;
          reported_at?: string;
        };
        Update: {
          child_id?: string;
          created_by?: string | null;
          id?: string;
          make_up_eligible?: boolean;
          occurrence_id?: string;
          organisation_id?: string;
          reason?: string | null;
          reported_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "absences_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "absences_organisation_id_child_id_fkey";
            columns: ["organisation_id", "child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "absences_organisation_id_occurrence_id_fkey";
            columns: ["organisation_id", "occurrence_id"];
            isOneToOne: false;
            referencedRelation: "class_occurrences";
            referencedColumns: ["organisation_id", "id"];
          },
        ];
      };
      attendance: {
        Row: {
          child_id: string;
          id: string;
          occurrence_id: string;
          organisation_id: string;
          recorded_at: string;
          recorded_by: string | null;
          status: string;
        };
        Insert: {
          child_id: string;
          id?: string;
          occurrence_id: string;
          organisation_id: string;
          recorded_at?: string;
          recorded_by?: string | null;
          status: string;
        };
        Update: {
          child_id?: string;
          id?: string;
          occurrence_id?: string;
          organisation_id?: string;
          recorded_at?: string;
          recorded_by?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_organisation_id_child_id_fkey";
            columns: ["organisation_id", "child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "attendance_organisation_id_occurrence_id_fkey";
            columns: ["organisation_id", "occurrence_id"];
            isOneToOne: false;
            referencedRelation: "class_occurrences";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor_user_id: string | null;
          after_json: Json | null;
          before_json: Json | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          organisation_id: string | null;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          after_json?: Json | null;
          before_json?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          organisation_id?: string | null;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          after_json?: Json | null;
          before_json?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          organisation_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_events_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      child_health: {
        Row: {
          allergies: string | null;
          child_id: string;
          medical_notes: string | null;
          organisation_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          allergies?: string | null;
          child_id: string;
          medical_notes?: string | null;
          organisation_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          allergies?: string | null;
          child_id?: string;
          medical_notes?: string | null;
          organisation_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "child_health_organisation_id_child_id_fkey";
            columns: ["organisation_id", "child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "child_health_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      child_restrictions: {
        Row: {
          added_at: string;
          added_by: string | null;
          child_id: string;
          details: string | null;
          id: string;
          kind: string;
          organisation_id: string;
          person_name: string;
          removed_at: string | null;
        };
        Insert: {
          added_at?: string;
          added_by?: string | null;
          child_id: string;
          details?: string | null;
          id?: string;
          kind: string;
          organisation_id: string;
          person_name: string;
          removed_at?: string | null;
        };
        Update: {
          added_at?: string;
          added_by?: string | null;
          child_id?: string;
          details?: string | null;
          id?: string;
          kind?: string;
          organisation_id?: string;
          person_name?: string;
          removed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "child_restrictions_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "child_restrictions_organisation_id_child_id_fkey";
            columns: ["organisation_id", "child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["organisation_id", "id"];
          },
        ];
      };
      children: {
        Row: {
          active: boolean;
          avatar_url: string | null;
          date_of_birth: string;
          family_id: string;
          first_name: string;
          id: string;
          import_batch_id: string | null;
          last_name: string;
          organisation_id: string;
        };
        Insert: {
          active?: boolean;
          avatar_url?: string | null;
          date_of_birth: string;
          family_id: string;
          first_name: string;
          id?: string;
          import_batch_id?: string | null;
          last_name: string;
          organisation_id: string;
        };
        Update: {
          active?: boolean;
          avatar_url?: string | null;
          date_of_birth?: string;
          family_id?: string;
          first_name?: string;
          id?: string;
          import_batch_id?: string | null;
          last_name?: string;
          organisation_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "children_family_fkey";
            columns: ["organisation_id", "family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "children_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
        ];
      };
      class_occurrences: {
        Row: {
          capacity_override: number | null;
          class_id: string;
          created_at: string;
          ends_at: string;
          id: string;
          organisation_id: string;
          starts_at: string;
          status: string;
        };
        Insert: {
          capacity_override?: number | null;
          class_id: string;
          created_at?: string;
          ends_at: string;
          id?: string;
          organisation_id: string;
          starts_at: string;
          status?: string;
        };
        Update: {
          capacity_override?: number | null;
          class_id?: string;
          created_at?: string;
          ends_at?: string;
          id?: string;
          organisation_id?: string;
          starts_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_occurrences_organisation_id_class_id_fkey";
            columns: ["organisation_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["organisation_id", "id"];
          },
        ];
      };
      classes: {
        Row: {
          active: boolean;
          capacity: number;
          duration_minutes: number;
          id: string;
          import_batch_id: string | null;
          instructor_id: string | null;
          level_id: string;
          location_id: string;
          name: string;
          organisation_id: string;
          price_per_lesson_cents: number | null;
          program_id: string;
          start_time: string;
          weekday: number;
        };
        Insert: {
          active?: boolean;
          capacity: number;
          duration_minutes: number;
          id?: string;
          import_batch_id?: string | null;
          instructor_id?: string | null;
          level_id: string;
          location_id: string;
          name: string;
          organisation_id: string;
          price_per_lesson_cents?: number | null;
          program_id: string;
          start_time: string;
          weekday: number;
        };
        Update: {
          active?: boolean;
          capacity?: number;
          duration_minutes?: number;
          id?: string;
          import_batch_id?: string | null;
          instructor_id?: string | null;
          level_id?: string;
          location_id?: string;
          name?: string;
          organisation_id?: string;
          price_per_lesson_cents?: number | null;
          program_id?: string;
          start_time?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "classes_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classes_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classes_organisation_id_instructor_id_fkey";
            columns: ["organisation_id", "instructor_id"];
            isOneToOne: false;
            referencedRelation: "staff_memberships";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "classes_organisation_id_level_id_fkey";
            columns: ["organisation_id", "level_id"];
            isOneToOne: false;
            referencedRelation: "levels";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "classes_organisation_id_location_id_fkey";
            columns: ["organisation_id", "location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "classes_organisation_id_program_id_fkey";
            columns: ["organisation_id", "program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "classes_program_id_level_id_fkey";
            columns: ["program_id", "level_id"];
            isOneToOne: false;
            referencedRelation: "levels";
            referencedColumns: ["program_id", "id"];
          },
        ];
      };
      email_deliveries: {
        Row: {
          attempts: number;
          created_at: string;
          dedupe_key: string | null;
          error: string | null;
          id: string;
          kind: string;
          locked_at: string | null;
          next_attempt_at: string;
          notification_id: string | null;
          organisation_id: string | null;
          payload: NonNullable<Json>;
          provider_id: string | null;
          recipient_user_id: string;
          sent_at: string | null;
          status: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          dedupe_key?: string | null;
          error?: string | null;
          id?: string;
          kind: string;
          locked_at?: string | null;
          next_attempt_at?: string;
          notification_id?: string | null;
          organisation_id?: string | null;
          payload?: NonNullable<Json>;
          provider_id?: string | null;
          recipient_user_id: string;
          sent_at?: string | null;
          status?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          dedupe_key?: string | null;
          error?: string | null;
          id?: string;
          kind?: string;
          locked_at?: string | null;
          next_attempt_at?: string;
          notification_id?: string | null;
          organisation_id?: string | null;
          payload?: NonNullable<Json>;
          provider_id?: string | null;
          recipient_user_id?: string;
          sent_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_deliveries_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_deliveries_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_deliveries_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      enrolments: {
        Row: {
          child_id: string;
          class_id: string;
          ends_at: string | null;
          id: string;
          import_batch_id: string | null;
          organisation_id: string;
          starts_at: string;
          status: string;
        };
        Insert: {
          child_id: string;
          class_id: string;
          ends_at?: string | null;
          id?: string;
          import_batch_id?: string | null;
          organisation_id: string;
          starts_at?: string;
          status?: string;
        };
        Update: {
          child_id?: string;
          class_id?: string;
          ends_at?: string | null;
          id?: string;
          import_batch_id?: string | null;
          organisation_id?: string;
          starts_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enrolments_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrolments_organisation_id_child_id_fkey";
            columns: ["organisation_id", "child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "enrolments_organisation_id_class_id_fkey";
            columns: ["organisation_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["organisation_id", "id"];
          },
        ];
      };
      families: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          import_batch_id: string | null;
          organisation_id: string;
          primary_contact_email: string | null;
          primary_contact_name: string | null;
          primary_contact_phone: string | null;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          id?: string;
          import_batch_id?: string | null;
          organisation_id: string;
          primary_contact_email?: string | null;
          primary_contact_name?: string | null;
          primary_contact_phone?: string | null;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          import_batch_id?: string | null;
          organisation_id?: string;
          primary_contact_email?: string | null;
          primary_contact_name?: string | null;
          primary_contact_phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "families_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "families_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      family_invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          code_hash: string;
          created_at: string;
          email: string;
          expires_at: string;
          family_id: string;
          id: string;
          invited_by: string | null;
          organisation_id: string;
          status: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          code_hash: string;
          created_at?: string;
          email: string;
          expires_at?: string;
          family_id: string;
          id?: string;
          invited_by?: string | null;
          organisation_id: string;
          status?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          code_hash?: string;
          created_at?: string;
          email?: string;
          expires_at?: string;
          family_id?: string;
          id?: string;
          invited_by?: string | null;
          organisation_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "family_invites_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_invites_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_invites_organisation_id_family_id_fkey";
            columns: ["organisation_id", "family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "family_invites_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      family_members: {
        Row: {
          family_id: string;
          id: string;
          is_primary_guardian: boolean;
          relationship: string;
          user_id: string;
        };
        Insert: {
          family_id: string;
          id?: string;
          is_primary_guardian?: boolean;
          relationship: string;
          user_id: string;
        };
        Update: {
          family_id?: string;
          id?: string;
          is_primary_guardian?: boolean;
          relationship?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "family_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      import_batches: {
        Row: {
          counts: NonNullable<Json>;
          created_at: string;
          created_by: string | null;
          file_names: string[];
          id: string;
          organisation_id: string;
          problems: NonNullable<Json>;
          undone_at: string | null;
        };
        Insert: {
          counts: NonNullable<Json>;
          created_at?: string;
          created_by?: string | null;
          file_names?: string[];
          id?: string;
          organisation_id: string;
          problems?: NonNullable<Json>;
          undone_at?: string | null;
        };
        Update: {
          counts?: NonNullable<Json>;
          created_at?: string;
          created_by?: string | null;
          file_names?: string[];
          id?: string;
          organisation_id?: string;
          problems?: NonNullable<Json>;
          undone_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "import_batches_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_batches_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_entries: {
        Row: {
          amount_cents: number;
          cancels_id: string | null;
          charge_key: string | null;
          child_id: string | null;
          class_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string;
          family_id: string;
          id: string;
          kind: string;
          lessons: number | null;
          method: string | null;
          online_payment_id: string | null;
          organisation_id: string;
          paid_on: string | null;
          term_id: string | null;
          unit_cents: number | null;
        };
        Insert: {
          amount_cents: number;
          cancels_id?: string | null;
          charge_key?: string | null;
          child_id?: string | null;
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description: string;
          family_id: string;
          id?: string;
          kind: string;
          lessons?: number | null;
          method?: string | null;
          online_payment_id?: string | null;
          organisation_id: string;
          paid_on?: string | null;
          term_id?: string | null;
          unit_cents?: number | null;
        };
        Update: {
          amount_cents?: number;
          cancels_id?: string | null;
          charge_key?: string | null;
          child_id?: string | null;
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          family_id?: string;
          id?: string;
          kind?: string;
          lessons?: number | null;
          method?: string | null;
          online_payment_id?: string | null;
          organisation_id?: string;
          paid_on?: string | null;
          term_id?: string | null;
          unit_cents?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_entries_cancels_id_fkey";
            columns: ["cancels_id"];
            isOneToOne: true;
            referencedRelation: "ledger_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_organisation_id_child_id_fkey";
            columns: ["organisation_id", "child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "ledger_entries_organisation_id_class_id_fkey";
            columns: ["organisation_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "ledger_entries_organisation_id_family_id_fkey";
            columns: ["organisation_id", "family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "ledger_entries_organisation_id_online_payment_id_fkey";
            columns: ["organisation_id", "online_payment_id"];
            isOneToOne: false;
            referencedRelation: "online_payments";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "ledger_entries_organisation_id_term_id_fkey";
            columns: ["organisation_id", "term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["organisation_id", "id"];
          },
        ];
      };
      levels: {
        Row: {
          active: boolean;
          id: string;
          name: string;
          organisation_id: string;
          program_id: string;
          sort_order: number;
        };
        Insert: {
          active?: boolean;
          id?: string;
          name: string;
          organisation_id: string;
          program_id: string;
          sort_order?: number;
        };
        Update: {
          active?: boolean;
          id?: string;
          name?: string;
          organisation_id?: string;
          program_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "levels_organisation_id_program_id_fkey";
            columns: ["organisation_id", "program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["organisation_id", "id"];
          },
        ];
      };
      locations: {
        Row: {
          active: boolean;
          address_line1: string | null;
          id: string;
          name: string;
          organisation_id: string;
          postcode: string | null;
          state: string | null;
          suburb: string | null;
          timezone: string;
        };
        Insert: {
          active?: boolean;
          address_line1?: string | null;
          id?: string;
          name: string;
          organisation_id: string;
          postcode?: string | null;
          state?: string | null;
          suburb?: string | null;
          timezone?: string;
        };
        Update: {
          active?: boolean;
          address_line1?: string | null;
          id?: string;
          name?: string;
          organisation_id?: string;
          postcode?: string | null;
          state?: string | null;
          suburb?: string | null;
          timezone?: string;
        };
        Relationships: [
          {
            foreignKeyName: "locations_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      makeup_bookings: {
        Row: {
          booked_at: string;
          cancelled_at: string | null;
          child_id: string;
          created_by: string | null;
          credit_id: string;
          id: string;
          organisation_id: string;
          status: string;
          target_occurrence_id: string;
        };
        Insert: {
          booked_at?: string;
          cancelled_at?: string | null;
          child_id: string;
          created_by?: string | null;
          credit_id: string;
          id?: string;
          organisation_id: string;
          status?: string;
          target_occurrence_id: string;
        };
        Update: {
          booked_at?: string;
          cancelled_at?: string | null;
          child_id?: string;
          created_by?: string | null;
          credit_id?: string;
          id?: string;
          organisation_id?: string;
          status?: string;
          target_occurrence_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "makeup_bookings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "makeup_bookings_organisation_id_child_id_fkey";
            columns: ["organisation_id", "child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "makeup_bookings_organisation_id_credit_id_fkey";
            columns: ["organisation_id", "credit_id"];
            isOneToOne: false;
            referencedRelation: "makeup_credits";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "makeup_bookings_organisation_id_target_occurrence_id_fkey";
            columns: ["organisation_id", "target_occurrence_id"];
            isOneToOne: false;
            referencedRelation: "class_occurrences";
            referencedColumns: ["organisation_id", "id"];
          },
        ];
      };
      makeup_credits: {
        Row: {
          child_id: string;
          expires_at: string;
          id: string;
          issued_at: string;
          organisation_id: string;
          reason: string;
          source_absence_id: string | null;
          source_occurrence_id: string | null;
          status: string;
        };
        Insert: {
          child_id: string;
          expires_at: string;
          id?: string;
          issued_at?: string;
          organisation_id: string;
          reason: string;
          source_absence_id?: string | null;
          source_occurrence_id?: string | null;
          status?: string;
        };
        Update: {
          child_id?: string;
          expires_at?: string;
          id?: string;
          issued_at?: string;
          organisation_id?: string;
          reason?: string;
          source_absence_id?: string | null;
          source_occurrence_id?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "makeup_credits_organisation_id_child_id_fkey";
            columns: ["organisation_id", "child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "makeup_credits_source_absence_id_fkey";
            columns: ["source_absence_id"];
            isOneToOne: false;
            referencedRelation: "absences";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "makeup_credits_source_occurrence_id_fkey";
            columns: ["source_occurrence_id"];
            isOneToOne: false;
            referencedRelation: "class_occurrences";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          organisation_id: string | null;
          payload_json: NonNullable<Json>;
          read_at: string | null;
          recipient_user_id: string;
          sent_at: string | null;
          status: string;
          type: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          organisation_id?: string | null;
          payload_json?: NonNullable<Json>;
          read_at?: string | null;
          recipient_user_id: string;
          sent_at?: string | null;
          status?: string;
          type: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organisation_id?: string | null;
          payload_json?: NonNullable<Json>;
          read_at?: string | null;
          recipient_user_id?: string;
          sent_at?: string | null;
          status?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      online_payments: {
        Row: {
          amount_cents: number;
          checkout_session_id: string | null;
          created_at: string;
          family_id: string;
          id: string;
          method: string | null;
          organisation_id: string;
          paid_at: string | null;
          payment_intent_id: string | null;
          platform_fee_cents: number;
          refunded_cents: number;
          started_by: string | null;
          status: string;
          stripe_account_id: string;
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          checkout_session_id?: string | null;
          created_at?: string;
          family_id: string;
          id?: string;
          method?: string | null;
          organisation_id: string;
          paid_at?: string | null;
          payment_intent_id?: string | null;
          platform_fee_cents: number;
          refunded_cents?: number;
          started_by?: string | null;
          status?: string;
          stripe_account_id: string;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          checkout_session_id?: string | null;
          created_at?: string;
          family_id?: string;
          id?: string;
          method?: string | null;
          organisation_id?: string;
          paid_at?: string | null;
          payment_intent_id?: string | null;
          platform_fee_cents?: number;
          refunded_cents?: number;
          started_by?: string | null;
          status?: string;
          stripe_account_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "online_payments_organisation_id_family_id_fkey";
            columns: ["organisation_id", "family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "online_payments_started_by_fkey";
            columns: ["started_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      organisations: {
        Row: {
          activity_type: string;
          created_at: string;
          id: string;
          lessons_in_term_only: boolean;
          name: string;
          owner_two_step_required: boolean;
          slug: string;
          status: string;
          timezone: string;
        };
        Insert: {
          activity_type: string;
          created_at?: string;
          id?: string;
          lessons_in_term_only?: boolean;
          name: string;
          owner_two_step_required?: boolean;
          slug: string;
          status?: string;
          timezone?: string;
        };
        Update: {
          activity_type?: string;
          created_at?: string;
          id?: string;
          lessons_in_term_only?: boolean;
          name?: string;
          owner_two_step_required?: boolean;
          slug?: string;
          status?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      payment_accounts: {
        Row: {
          charges_enabled: boolean;
          created_at: string;
          details_submitted: boolean;
          organisation_id: string;
          payouts_enabled: boolean;
          stripe_account_id: string;
          updated_at: string;
        };
        Insert: {
          charges_enabled?: boolean;
          created_at?: string;
          details_submitted?: boolean;
          organisation_id: string;
          payouts_enabled?: boolean;
          stripe_account_id: string;
          updated_at?: string;
        };
        Update: {
          charges_enabled?: boolean;
          created_at?: string;
          details_submitted?: boolean;
          organisation_id?: string;
          payouts_enabled?: boolean;
          stripe_account_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_accounts_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: true;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      policy_sets: {
        Row: {
          active: boolean;
          config_json: NonNullable<Json>;
          created_at: string;
          created_by: string | null;
          id: string;
          organisation_id: string;
          policy_type: string;
          version: number;
        };
        Insert: {
          active?: boolean;
          config_json?: NonNullable<Json>;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          organisation_id: string;
          policy_type: string;
          version: number;
        };
        Update: {
          active?: boolean;
          config_json?: NonNullable<Json>;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          organisation_id?: string;
          policy_type?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "policy_sets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "policy_sets_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      programs: {
        Row: {
          active: boolean;
          id: string;
          name: string;
          organisation_id: string;
          type: string;
        };
        Insert: {
          active?: boolean;
          id?: string;
          name: string;
          organisation_id: string;
          type?: string;
        };
        Update: {
          active?: boolean;
          id?: string;
          name?: string;
          organisation_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "programs_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      progress_records: {
        Row: {
          assessed_at: string;
          assessed_by: string | null;
          child_id: string;
          id: string;
          organisation_id: string;
          skill_id: string;
          status: string;
        };
        Insert: {
          assessed_at?: string;
          assessed_by?: string | null;
          child_id: string;
          id?: string;
          organisation_id: string;
          skill_id: string;
          status: string;
        };
        Update: {
          assessed_at?: string;
          assessed_by?: string | null;
          child_id?: string;
          id?: string;
          organisation_id?: string;
          skill_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "progress_records_assessed_by_fkey";
            columns: ["assessed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "progress_records_organisation_id_child_id_fkey";
            columns: ["organisation_id", "child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "progress_records_organisation_id_skill_id_fkey";
            columns: ["organisation_id", "skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["organisation_id", "id"];
          },
        ];
      };
      reenrolment_asks: {
        Row: {
          answer: string | null;
          answered_at: string | null;
          answered_by: string | null;
          child_id: string;
          class_id: string;
          created_at: string;
          emailed_at: string | null;
          enrolment_id: string;
          id: string;
          offered_class_id: string | null;
          organisation_id: string;
          outcome: string | null;
          term_id: string;
        };
        Insert: {
          answer?: string | null;
          answered_at?: string | null;
          answered_by?: string | null;
          child_id: string;
          class_id: string;
          created_at?: string;
          emailed_at?: string | null;
          enrolment_id: string;
          id?: string;
          offered_class_id?: string | null;
          organisation_id: string;
          outcome?: string | null;
          term_id: string;
        };
        Update: {
          answer?: string | null;
          answered_at?: string | null;
          answered_by?: string | null;
          child_id?: string;
          class_id?: string;
          created_at?: string;
          emailed_at?: string | null;
          enrolment_id?: string;
          id?: string;
          offered_class_id?: string | null;
          organisation_id?: string;
          outcome?: string | null;
          term_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reenrolment_asks_answered_by_fkey";
            columns: ["answered_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reenrolment_asks_enrolment_id_fkey";
            columns: ["enrolment_id"];
            isOneToOne: false;
            referencedRelation: "enrolments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reenrolment_asks_organisation_id_child_id_fkey";
            columns: ["organisation_id", "child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "reenrolment_asks_organisation_id_class_id_fkey";
            columns: ["organisation_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "reenrolment_asks_organisation_id_offered_class_id_fkey";
            columns: ["organisation_id", "offered_class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "reenrolment_asks_organisation_id_term_id_fkey";
            columns: ["organisation_id", "term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["organisation_id", "id"];
          },
        ];
      };
      sensitive_views: {
        Row: {
          child_id: string;
          id: string;
          organisation_id: string;
          viewed_at: string;
          viewer_role: string;
          viewer_user_id: string | null;
        };
        Insert: {
          child_id: string;
          id?: string;
          organisation_id: string;
          viewed_at?: string;
          viewer_role: string;
          viewer_user_id?: string | null;
        };
        Update: {
          child_id?: string;
          id?: string;
          organisation_id?: string;
          viewed_at?: string;
          viewer_role?: string;
          viewer_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sensitive_views_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sensitive_views_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sensitive_views_viewer_user_id_fkey";
            columns: ["viewer_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      skills: {
        Row: {
          active: boolean;
          description: string | null;
          id: string;
          level_id: string;
          name: string;
          organisation_id: string;
          sort_order: number;
        };
        Insert: {
          active?: boolean;
          description?: string | null;
          id?: string;
          level_id: string;
          name: string;
          organisation_id: string;
          sort_order?: number;
        };
        Update: {
          active?: boolean;
          description?: string | null;
          id?: string;
          level_id?: string;
          name?: string;
          organisation_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "skills_organisation_id_level_id_fkey";
            columns: ["organisation_id", "level_id"];
            isOneToOne: false;
            referencedRelation: "levels";
            referencedColumns: ["organisation_id", "id"];
          },
        ];
      };
      staff_memberships: {
        Row: {
          id: string;
          organisation_id: string;
          role: string;
          status: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          organisation_id: string;
          role: string;
          status?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          organisation_id?: string;
          role?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_memberships_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      terms: {
        Row: {
          applied_at: string | null;
          asked_at: string | null;
          asked_by: string | null;
          created_at: string;
          ends_on: string;
          id: string;
          name: string;
          organisation_id: string;
          reply_by: string | null;
          starts_on: string;
        };
        Insert: {
          applied_at?: string | null;
          asked_at?: string | null;
          asked_by?: string | null;
          created_at?: string;
          ends_on: string;
          id?: string;
          name: string;
          organisation_id: string;
          reply_by?: string | null;
          starts_on: string;
        };
        Update: {
          applied_at?: string | null;
          asked_at?: string | null;
          asked_by?: string | null;
          created_at?: string;
          ends_on?: string;
          id?: string;
          name?: string;
          organisation_id?: string;
          reply_by?: string | null;
          starts_on?: string;
        };
        Relationships: [
          {
            foreignKeyName: "terms_asked_by_fkey";
            columns: ["asked_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "terms_organisation_id_fkey";
            columns: ["organisation_id"];
            isOneToOne: false;
            referencedRelation: "organisations";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          auth_id: string;
          created_at: string;
          email: string;
          id: string;
          lesson_reminders: boolean;
          name: string;
          phone: string | null;
        };
        Insert: {
          auth_id: string;
          created_at?: string;
          email: string;
          id?: string;
          lesson_reminders?: boolean;
          name?: string;
          phone?: string | null;
        };
        Update: {
          auth_id?: string;
          created_at?: string;
          email?: string;
          id?: string;
          lesson_reminders?: boolean;
          name?: string;
          phone?: string | null;
        };
        Relationships: [];
      };
      vacancy_offers: {
        Row: {
          booking_id: string | null;
          child_id: string;
          code_hash: string;
          created_at: string;
          expires_at: string;
          id: string;
          occurrence_id: string;
          offered_by: string | null;
          organisation_id: string;
          responded_at: string | null;
          status: string;
        };
        Insert: {
          booking_id?: string | null;
          child_id: string;
          code_hash: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          occurrence_id: string;
          offered_by?: string | null;
          organisation_id: string;
          responded_at?: string | null;
          status?: string;
        };
        Update: {
          booking_id?: string | null;
          child_id?: string;
          code_hash?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          occurrence_id?: string;
          offered_by?: string | null;
          organisation_id?: string;
          responded_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vacancy_offers_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "makeup_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vacancy_offers_offered_by_fkey";
            columns: ["offered_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vacancy_offers_organisation_id_child_id_fkey";
            columns: ["organisation_id", "child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["organisation_id", "id"];
          },
          {
            foreignKeyName: "vacancy_offers_organisation_id_occurrence_id_fkey";
            columns: ["organisation_id", "occurrence_id"];
            isOneToOne: false;
            referencedRelation: "class_occurrences";
            referencedColumns: ["organisation_id", "id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invite: { Args: { p_code: string }; Returns: string };
      add_account_line: {
        Args: {
          p_amount_cents: number;
          p_child?: string;
          p_family: string;
          p_kind: string;
          p_reason: string;
        };
        Returns: string;
      };
      add_child_restriction: {
        Args: { p_child: string; p_details: string; p_kind: string; p_person: string };
        Returns: string;
      };
      answer_term_ask: { Args: { p_answer: string; p_ask: string }; Returns: undefined };
      apply_terms_at: { Args: { p_now: string }; Returns: number };
      ask_families: { Args: { p_reply_by: string; p_term: string }; Returns: number };
      attach_checkout_session: {
        Args: { p_payment: string; p_session: string };
        Returns: undefined;
      };
      book_makeup: { Args: { p_credit: string; p_occurrence: string }; Returns: string };
      can_pay_online: { Args: { p_org: string }; Returns: boolean };
      cancel_ledger_entry: { Args: { p_entry: string; p_reason: string }; Returns: string };
      cancel_lessons: { Args: { p_date: string; p_location: string }; Returns: number };
      cancel_makeup: { Args: { p_booking: string }; Returns: boolean };
      check_makeup: { Args: { p_credit: string; p_occurrence: string }; Returns: string[] };
      child_safety: { Args: { p_child: string }; Returns: Json };
      child_safety_views: {
        Args: { p_child: string };
        Returns: {
          viewed_at: string;
          viewer_name: string;
          viewer_role: string;
        }[];
      };
      claim_email_deliveries: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          created_at: string;
          dedupe_key: string | null;
          error: string | null;
          id: string;
          kind: string;
          locked_at: string | null;
          next_attempt_at: string;
          notification_id: string | null;
          organisation_id: string | null;
          payload: NonNullable<Json>;
          provider_id: string | null;
          recipient_user_id: string;
          sent_at: string | null;
          status: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "email_deliveries";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_offer: {
        Args: { p_code: string };
        Returns: {
          booking_id: string;
          outcome: string;
        }[];
      };
      create_term_fees: { Args: { p_term: string }; Returns: number };
      decline_offer: { Args: { p_code: string }; Returns: boolean };
      delete_family: { Args: { p_confirm: string; p_family: string }; Returns: string[] };
      delete_term: { Args: { p_term: string }; Returns: undefined };
      export_family: { Args: { p_family: string }; Returns: Json };
      family_balances: {
        Args: { p_org: string };
        Returns: {
          balance_cents: number;
          display_name: string;
          family_id: string;
        }[];
      };
      family_parents: {
        Args: { p_family: string };
        Returns: {
          email: string;
          is_primary_guardian: boolean;
          name: string;
          user_id: string;
        }[];
      };
      fill_tally: {
        Args: { p_days?: number; p_org: string };
        Returns: {
          families: number;
          makeups_delivered: number;
          offers_claimed: number;
        }[];
      };
      finish_email_delivery: {
        Args: { p_error?: string; p_id: string; p_outcome: string; p_provider_id?: string };
        Returns: undefined;
      };
      import_school: {
        Args: {
          p_classes: Json;
          p_commit: boolean;
          p_file_names: string[];
          p_org: string;
          p_read_problems?: Json;
          p_students: Json;
        };
        Returns: Json;
      };
      import_summary: { Args: { p_batch: string }; Returns: Json };
      invite_details: {
        Args: { p_code: string };
        Returns: {
          email: string;
          family: string;
          school: string;
          status: string;
        }[];
      };
      invite_parent: { Args: { p_email: string; p_family: string }; Returns: string };
      makeup_options: {
        Args: { p_credit: string };
        Returns: {
          class_id: string;
          class_name: string;
          ends_at: string;
          free_places: number;
          instructor_first_name: string;
          level_name: string;
          location_name: string;
          occurrence_id: string;
          starts_at: string;
          timezone: string;
        }[];
      };
      makeup_policy: { Args: { p_org: string }; Returns: Json };
      mark_notifications_read: { Args: Record<PropertyKey, never>; Returns: undefined };
      my_term_asks: {
        Args: Record<PropertyKey, never>;
        Returns: {
          answer: string;
          child_first_name: string;
          class_location: string;
          class_name: string;
          class_start: string;
          class_weekday: number;
          id: string;
          offered_class_name: string;
          offered_location: string;
          offered_start: string;
          offered_weekday: number;
          reply_by: string;
          school: string;
          starts_on: string;
          term_name: string;
        }[];
      };
      offer_details: {
        Args: { p_code: string };
        Returns: {
          child_first_name: string;
          child_id: string;
          class_name: string;
          ends_at: string;
          expires_at: string;
          instructor_first_name: string;
          level_name: string;
          location_name: string;
          offer_id: string;
          starts_at: string;
          status: string;
          timezone: string;
        }[];
      };
      offer_spot: { Args: { p_child: string; p_occurrence: string }; Returns: string };
      offer_term_move: { Args: { p_ask: string; p_class: string }; Returns: undefined };
      open_spots: {
        Args: { p_days?: number; p_org: string };
        Returns: {
          class_id: string;
          occurrence_id: string;
          offers_claimed: number;
          offers_open: number;
          spots: number;
          starts_at: string;
        }[];
      };
      owner_two_step_needed: { Args: Record<PropertyKey, never>; Returns: boolean };
      prepare_term_asks: { Args: { p_term: string }; Returns: number };
      preview_cancel_lessons: {
        Args: { p_date: string; p_location: string };
        Returns: {
          children: number;
          credits: number;
          families: number;
          lessons: number;
          makeups: number;
        }[];
      };
      queue_lesson_reminders_at: { Args: { p_now: string }; Returns: number };
      record_attendance: {
        Args: { p_child_id: string; p_occurrence_id: string; p_status: string };
        Returns: undefined;
      };
      record_online_refund: {
        Args: { p_account: string; p_payment_intent: string; p_refunded_cents: number };
        Returns: number;
      };
      record_payment: {
        Args: {
          p_amount_cents: number;
          p_family: string;
          p_method: string;
          p_note?: string;
          p_paid_on: string;
        };
        Returns: string;
      };
      record_progress: {
        Args: { p_child_id: string; p_skill_id: string; p_status: string };
        Returns: undefined;
      };
      record_sign_in: {
        Args: { p_email: string; p_ip: string; p_succeeded: boolean };
        Returns: undefined;
      };
      remind_term_families: { Args: { p_term: string }; Returns: number };
      remove_child_restriction: { Args: { p_restriction: string }; Returns: undefined };
      remove_staff_member: { Args: { p_membership_id: string }; Returns: undefined };
      report_absence: {
        Args: { p_child: string; p_occurrence: string; p_reason?: string };
        Returns: {
          absence_id: string;
          credit_expires_at: string;
          credit_id: string;
          no_credit_reason: string;
        }[];
      };
      restore_staff_member: { Args: { p_membership_id: string }; Returns: undefined };
      revoke_invite: { Args: { p_invite: string }; Returns: undefined };
      safety_flags: {
        Args: { p_children: string[] };
        Returns: {
          child_id: string;
          has_health: boolean;
          has_restriction: boolean;
        }[];
      };
      save_child_health: {
        Args: { p_allergies: string; p_child: string; p_medical_notes: string };
        Returns: undefined;
      };
      save_makeup_policy: { Args: { p_config: Json; p_org: string }; Returns: number };
      save_payment_account: {
        Args: {
          p_account: string;
          p_charges: boolean;
          p_details: boolean;
          p_org: string;
          p_payouts: boolean;
        };
        Returns: string;
      };
      save_term: {
        Args: {
          p_ends_on: string;
          p_name: string;
          p_org: string;
          p_starts_on: string;
          p_term?: string;
        };
        Returns: string;
      };
      set_lesson_reminders: { Args: { p_on: boolean }; Returns: undefined };
      set_lessons_in_term_only: { Args: { p_on: boolean; p_org: string }; Returns: undefined };
      settle_online_payment: {
        Args: {
          p_account: string;
          p_amount_cents: number;
          p_method?: string;
          p_payment: string;
          p_payment_intent?: string;
          p_session: string;
          p_status: string;
        };
        Returns: string;
      };
      setup_progress: { Args: { p_org: string }; Returns: Json };
      sign_in_allowed: { Args: { p_email: string; p_ip: string }; Returns: boolean };
      start_online_payment: {
        Args: { p_family: string };
        Returns: {
          amount_cents: number;
          payment_id: string;
          platform_fee_cents: number;
          school_name: string;
          stripe_account_id: string;
        }[];
      };
      term_summary: {
        Args: { p_term: string };
        Returns: {
          capacity: number;
          class_id: string;
          free_next_term: number;
          leaving: number;
          moving_in: number;
          moving_out: number;
          staying: number;
          waiting: number;
        }[];
      };
      undo_import: { Args: { p_batch: string }; Returns: undefined };
      update_payment_account: {
        Args: { p_account: string; p_charges: boolean; p_details: boolean; p_payouts: boolean };
        Returns: boolean;
      };
      vacancy_candidates: {
        Args: { p_occurrence: string };
        Returns: {
          child_id: string;
          credit_expires_at: string;
          family_name: string;
          first_name: string;
          last_name: string;
          missed_at: string;
          offer_automatic: boolean;
          offer_expires_at: string;
          offer_status: string;
        }[];
      };
      withdraw_absence: { Args: { p_absence: string }; Returns: undefined };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
