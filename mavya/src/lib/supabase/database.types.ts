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
      children: {
        Row: {
          active: boolean;
          avatar_url: string | null;
          date_of_birth: string;
          family_id: string;
          first_name: string;
          id: string;
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
          instructor_id: string | null;
          level_id: string;
          location_id: string;
          name: string;
          organisation_id: string;
          program_id: string;
          start_time: string;
          weekday: number;
        };
        Insert: {
          active?: boolean;
          capacity: number;
          duration_minutes: number;
          id?: string;
          instructor_id?: string | null;
          level_id: string;
          location_id: string;
          name: string;
          organisation_id: string;
          program_id: string;
          start_time: string;
          weekday: number;
        };
        Update: {
          active?: boolean;
          capacity?: number;
          duration_minutes?: number;
          id?: string;
          instructor_id?: string | null;
          level_id?: string;
          location_id?: string;
          name?: string;
          organisation_id?: string;
          program_id?: string;
          start_time?: string;
          weekday?: number;
        };
        Relationships: [
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
      enrolments: {
        Row: {
          child_id: string;
          class_id: string;
          ends_at: string | null;
          id: string;
          organisation_id: string;
          starts_at: string;
          status: string;
        };
        Insert: {
          child_id: string;
          class_id: string;
          ends_at?: string | null;
          id?: string;
          organisation_id: string;
          starts_at?: string;
          status?: string;
        };
        Update: {
          child_id?: string;
          class_id?: string;
          ends_at?: string | null;
          id?: string;
          organisation_id?: string;
          starts_at?: string;
          status?: string;
        };
        Relationships: [
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
          organisation_id: string;
          primary_contact_email: string | null;
          primary_contact_name: string | null;
          primary_contact_phone: string | null;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          id?: string;
          organisation_id: string;
          primary_contact_email?: string | null;
          primary_contact_name?: string | null;
          primary_contact_phone?: string | null;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          organisation_id?: string;
          primary_contact_email?: string | null;
          primary_contact_name?: string | null;
          primary_contact_phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "families_organisation_id_fkey";
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
      organisations: {
        Row: {
          activity_type: string;
          created_at: string;
          id: string;
          name: string;
          slug: string;
          status: string;
          timezone: string;
        };
        Insert: {
          activity_type: string;
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          status?: string;
          timezone?: string;
        };
        Update: {
          activity_type?: string;
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          status?: string;
          timezone?: string;
        };
        Relationships: [];
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
      users: {
        Row: {
          auth_id: string;
          created_at: string;
          email: string;
          id: string;
          name: string;
          phone: string | null;
        };
        Insert: {
          auth_id: string;
          created_at?: string;
          email: string;
          id?: string;
          name?: string;
          phone?: string | null;
        };
        Update: {
          auth_id?: string;
          created_at?: string;
          email?: string;
          id?: string;
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
      book_makeup: { Args: { p_credit: string; p_occurrence: string }; Returns: string };
      cancel_lessons: { Args: { p_date: string; p_location: string }; Returns: number };
      cancel_makeup: { Args: { p_booking: string }; Returns: boolean };
      check_makeup: { Args: { p_credit: string; p_occurrence: string }; Returns: string[] };
      claim_offer: {
        Args: { p_code: string };
        Returns: {
          booking_id: string;
          outcome: string;
        }[];
      };
      decline_offer: { Args: { p_code: string }; Returns: boolean };
      fill_tally: {
        Args: { p_days?: number; p_org: string };
        Returns: {
          families: number;
          makeups_delivered: number;
          offers_claimed: number;
        }[];
      };
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
      record_attendance: {
        Args: { p_child_id: string; p_occurrence_id: string; p_status: string };
        Returns: undefined;
      };
      record_progress: {
        Args: { p_child_id: string; p_skill_id: string; p_status: string };
        Returns: undefined;
      };
      record_sign_in: {
        Args: { p_email: string; p_ip: string; p_succeeded: boolean };
        Returns: undefined;
      };
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
      save_makeup_policy: { Args: { p_config: Json; p_org: string }; Returns: number };
      sign_in_allowed: { Args: { p_email: string; p_ip: string }; Returns: boolean };
      vacancy_candidates: {
        Args: { p_occurrence: string };
        Returns: {
          child_id: string;
          credit_expires_at: string;
          family_name: string;
          first_name: string;
          last_name: string;
          missed_at: string;
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
