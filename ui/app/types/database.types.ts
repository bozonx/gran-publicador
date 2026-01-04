export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      project_members: {
        Row: {
          project_id: string
          created_at: string | null
          id: string
          role: Database['public']['Enums']['project_role'] | null
          user_id: string
        }
        Insert: {
          project_id: string
          created_at?: string | null
          id?: string
          role?: Database['public']['Enums']['project_role'] | null
          user_id: string
        }
        Update: {
          project_id?: string
          created_at?: string | null
          id?: string
          role?: Database['public']['Enums']['project_role'] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'project_members_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'project_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          owner_id: string
          created_at: string | null
          updated_at: string | null
          archived_at: string | null
          archived_by: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          owner_id: string
          created_at?: string | null
          updated_at?: string | null
          archived_at?: string | null
          archived_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          owner_id?: string
          created_at?: string | null
          updated_at?: string | null
          archived_at?: string | null
          archived_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'projects_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      channels: {
        Row: {
          project_id: string
          created_at: string | null
          credentials: Json | null
          id: string
          channel_identifier: string
          is_active: boolean | null
          name: string
          social_media: Database['public']['Enums']['social_media_enum']
          updated_at: string | null
          archived_at: string | null
          archived_by: string | null
        }
        Insert: {
          project_id: string
          created_at?: string | null
          credentials?: Json | null
          id?: string
          channel_identifier: string
          is_active?: boolean | null
          name: string
          social_media: Database['public']['Enums']['social_media_enum']
          updated_at?: string | null
          archived_at?: string | null
          archived_by?: string | null
        }
        Update: {
          project_id?: string
          created_at?: string | null
          credentials?: Json | null
          id?: string
          channel_identifier?: string
          is_active?: boolean | null
          name?: string
          social_media?: Database['public']['Enums']['social_media_enum']
          updated_at?: string | null
          archived_at?: string | null
          archived_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'channels_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      publications: {
        Row: {
          id: string
          project_id: string
          author_id: string | null
          title: string | null
          content: string
          media_files: string
          tags: string | null
          status: Database['public']['Enums']['post_status_enum'] | null
          meta: string
          created_at: string
          updated_at: string
          archived_at: string | null
          archived_by: string | null
        }
        Insert: {
          id?: string
          project_id: string
          author_id?: string | null
          title?: string | null
          content: string
          media_files?: string
          tags?: string | null
          status?: Database['public']['Enums']['post_status_enum'] | null
          meta?: string
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          archived_by?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          author_id?: string | null
          title?: string | null
          content?: string
          media_files?: string
          tags?: string | null
          status?: Database['public']['Enums']['post_status_enum'] | null
          meta?: string
          created_at?: string
          updated_at?: string
          archived_at?: string | null
          archived_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'publications_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'publications_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      posts: {
        Row: {
          id: string
          channel_id: string
          author_id: string | null
          content: string
          social_media: Database['public']['Enums']['social_media_enum']
          post_type: Database['public']['Enums']['post_type_enum']
          title: string | null
          description: string | null
          author_comment: string | null
          tags: string[] | null
          post_date: string | null
          status: Database['public']['Enums']['post_status_enum'] | null
          scheduled_at: string | null
          published_at: string | null
          meta: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          channel_id: string
          author_id?: string | null
          content: string
          social_media: Database['public']['Enums']['social_media_enum']
          post_type: Database['public']['Enums']['post_type_enum']
          title?: string | null
          description?: string | null
          author_comment?: string | null
          tags?: string[] | null
          post_date?: string | null
          status?: Database['public']['Enums']['post_status_enum'] | null
          scheduled_at?: string | null
          published_at?: string | null
          meta?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          channel_id?: string
          author_id?: string | null
          content?: string
          social_media?: Database['public']['Enums']['social_media_enum']
          post_type?: Database['public']['Enums']['post_type_enum']
          title?: string | null
          description?: string | null
          author_comment?: string | null
          tags?: string[] | null
          post_date?: string | null
          status?: Database['public']['Enums']['post_status_enum'] | null
          scheduled_at?: string | null
          published_at?: string | null
          meta?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'posts_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'posts_channel_id_fkey'
            columns: ['channel_id']
            isOneToOne: false
            referencedRelation: 'channels'
            referencedColumns: ['id']
          },
        ]
      }
      users: {
        Row: {
          id: string
          telegram_id: number | null

          telegram_username: string | null
          full_name: string | null
          avatar_url: string | null
          is_admin: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          telegram_id?: number | null

          telegram_username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          is_admin?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          telegram_id?: number | null

          telegram_username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          is_admin?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_or_create_telegram_user: {
        Args: {
          p_telegram_id: number
          p_username?: string
          p_first_name?: string
          p_last_name?: string
        }
        Returns: {
          id: string
          telegram_id: number | null

          telegram_username: string | null
          full_name: string | null
          avatar_url: string | null
          is_admin: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'users'
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      project_role: 'owner' | 'admin' | 'editor' | 'viewer'
      post_status_enum: 'draft' | 'scheduled' | 'published' | 'failed'
      post_type_enum: 'post' | 'article' | 'news' | 'video' | 'short'
      social_media_enum:
      | 'telegram'
      | 'instagram'
      | 'vk'
      | 'youtube'
      | 'tiktok'
      | 'x'
      | 'facebook'
      | 'site'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
  ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
    Row: infer R
  }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema['Tables']
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema['Tables']
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema['Enums']
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
  ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema['CompositeTypes']
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
  ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      project_role: ['owner', 'admin', 'editor', 'viewer'],
      post_status_enum: ['draft', 'scheduled', 'published', 'failed'],
      post_type_enum: ['post', 'article', 'news', 'video', 'short'],
      social_media_enum: [
        'telegram',
        'instagram',
        'vk',
        'youtube',
        'tiktok',
        'x',
        'facebook',
        'site',
      ],
    },
  },
} as const
