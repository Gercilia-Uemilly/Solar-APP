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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          acao: string
          criado_em: string | null
          detalhes: Json | null
          id: string
          registro_id: string | null
          tabela: string | null
          user_id: string
          user_nome: string | null
        }
        Insert: {
          acao: string
          criado_em?: string | null
          detalhes?: Json | null
          id?: string
          registro_id?: string | null
          tabela?: string | null
          user_id: string
          user_nome?: string | null
        }
        Update: {
          acao?: string
          criado_em?: string | null
          detalhes?: Json | null
          id?: string
          registro_id?: string | null
          tabela?: string | null
          user_id?: string
          user_nome?: string | null
        }
        Relationships: []
      }
      base_conhecimento: {
        Row: {
          bairro: string | null
          categoria: string | null
          created_at: string
          data_publicacao: string | null
          descricao: string | null
          fonte: string | null
          id: string
          link: string | null
          modelo: boolean
          orgao: string | null
          palavras_chave: string[] | null
          titulo: string
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          categoria?: string | null
          created_at?: string
          data_publicacao?: string | null
          descricao?: string | null
          fonte?: string | null
          id?: string
          link?: string | null
          modelo?: boolean
          orgao?: string | null
          palavras_chave?: string[] | null
          titulo: string
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          categoria?: string | null
          created_at?: string
          data_publicacao?: string | null
          descricao?: string | null
          fonte?: string | null
          id?: string
          link?: string | null
          modelo?: boolean
          orgao?: string | null
          palavras_chave?: string[] | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      clippings: {
        Row: {
          author_id: string
          author_nome: string | null
          created_at: string
          data_publicacao: string | null
          descricao: string | null
          estrategico: boolean
          fonte: string
          id: string
          link: string | null
          observacoes: string | null
          respondido: boolean
          sentimento: string
          tema: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          author_id: string
          author_nome?: string | null
          created_at?: string
          data_publicacao?: string | null
          descricao?: string | null
          estrategico?: boolean
          fonte?: string
          id?: string
          link?: string | null
          observacoes?: string | null
          respondido?: boolean
          sentimento?: string
          tema?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          author_nome?: string | null
          created_at?: string
          data_publicacao?: string | null
          descricao?: string | null
          estrategico?: boolean
          fonte?: string
          id?: string
          link?: string | null
          observacoes?: string | null
          respondido?: boolean
          sentimento?: string
          tema?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      lembretes: {
        Row: {
          created_at: string
          criado_por: string
          data_hora: string
          descricao: string | null
          destinatarios: string[] | null
          google_event_id: string | null
          id: string
          lido_por: string[] | null
          recorrencia: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          criado_por: string
          data_hora: string
          descricao?: string | null
          destinatarios?: string[] | null
          google_event_id?: string | null
          id?: string
          lido_por?: string[] | null
          recorrencia?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          data_hora?: string
          descricao?: string | null
          destinatarios?: string[] | null
          google_event_id?: string | null
          id?: string
          lido_por?: string[] | null
          recorrencia?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      mensagem_reacoes: {
        Row: {
          created_at: string
          emoji: string
          id: string
          mensagem_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          mensagem_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          mensagem_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagem_reacoes_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens: {
        Row: {
          conteudo: string
          created_at: string | null
          de_user_id: string
          id: string
          lida: boolean | null
          para_user_id: string | null
        }
        Insert: {
          conteudo: string
          created_at?: string | null
          de_user_id: string
          id?: string
          lida?: boolean | null
          para_user_id?: string | null
        }
        Update: {
          conteudo?: string
          created_at?: string | null
          de_user_id?: string
          id?: string
          lida?: boolean | null
          para_user_id?: string | null
        }
        Relationships: []
      }
      modelos_oficio: {
        Row: {
          assunto: string | null
          conteudo: string | null
          criado_em: string | null
          criado_por: string
          criado_por_nome: string | null
          descricao: string | null
          id: string
          nome: string
          publico: boolean | null
          secretaria: string | null
        }
        Insert: {
          assunto?: string | null
          conteudo?: string | null
          criado_em?: string | null
          criado_por: string
          criado_por_nome?: string | null
          descricao?: string | null
          id?: string
          nome: string
          publico?: boolean | null
          secretaria?: string | null
        }
        Update: {
          assunto?: string | null
          conteudo?: string | null
          criado_em?: string | null
          criado_por?: string
          criado_por_nome?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          publico?: boolean | null
          secretaria?: string | null
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          criada_em: string | null
          id: string
          lida: boolean | null
          mensagem: string
          oficio_id: string | null
          titulo: string
          user_id: string
        }
        Insert: {
          criada_em?: string | null
          id?: string
          lida?: boolean | null
          mensagem: string
          oficio_id?: string | null
          titulo: string
          user_id: string
        }
        Update: {
          criada_em?: string | null
          id?: string
          lida?: boolean | null
          mensagem?: string
          oficio_id?: string | null
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      oficio_anexos: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string
          oficio_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string
          oficio_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          oficio_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "oficio_anexos_oficio_id_fkey"
            columns: ["oficio_id"]
            isOneToOne: false
            referencedRelation: "oficios"
            referencedColumns: ["id"]
          },
        ]
      }
      oficio_numeracao: {
        Row: {
          ano: number
          id: string
          numero: number
          oficio_id: string | null
          origem_numero: string
          reservado_em: string | null
          reservado_por: string | null
          reservado_por_nome: string | null
          status: string
          usado_em: string | null
          usado_por: string | null
          usado_por_nome: string | null
        }
        Insert: {
          ano?: number
          id?: string
          numero: number
          oficio_id?: string | null
          origem_numero?: string
          reservado_em?: string | null
          reservado_por?: string | null
          reservado_por_nome?: string | null
          status?: string
          usado_em?: string | null
          usado_por?: string | null
          usado_por_nome?: string | null
        }
        Update: {
          ano?: number
          id?: string
          numero?: number
          oficio_id?: string | null
          origem_numero?: string
          reservado_em?: string | null
          reservado_por?: string | null
          reservado_por_nome?: string | null
          status?: string
          usado_em?: string | null
          usado_por?: string | null
          usado_por_nome?: string | null
        }
        Relationships: []
      }
      oficios: {
        Row: {
          ano: number | null
          assunto: string
          author_id: string
          bairro: string | null
          cargo_destinatario: string | null
          codigo_z: string | null
          contato_solicitante: string | null
          conteudo: string | null
          created_at: string
          data_geracao: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_by_name: string | null
          destinatario: string
          endereco_completo: string | null
          id: string
          last_edited_at: string | null
          last_edited_by: string | null
          last_edited_by_name: string | null
          linha_telefonica: string | null
          link_pdf_drive: string | null
          local_demanda: string | null
          marcador: string | null
          numero: string | null
          numero_protocolo: string | null
          operador_nome: string | null
          origem: string | null
          protocolado_em: string | null
          resposta_cidadao: string | null
          secretaria_identificada: string | null
          solicitante: string | null
          status: string
          tipo_demanda: string | null
          updated_at: string
          uploaded_at: string | null
          uploaded_by_email: string | null
          uploaded_by_name: string | null
          urgencia: string | null
        }
        Insert: {
          ano?: number | null
          assunto?: string
          author_id: string
          bairro?: string | null
          cargo_destinatario?: string | null
          codigo_z?: string | null
          contato_solicitante?: string | null
          conteudo?: string | null
          created_at?: string
          data_geracao?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_name?: string | null
          destinatario?: string
          endereco_completo?: string | null
          id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          last_edited_by_name?: string | null
          linha_telefonica?: string | null
          link_pdf_drive?: string | null
          local_demanda?: string | null
          marcador?: string | null
          numero?: string | null
          numero_protocolo?: string | null
          operador_nome?: string | null
          origem?: string | null
          protocolado_em?: string | null
          resposta_cidadao?: string | null
          secretaria_identificada?: string | null
          solicitante?: string | null
          status?: string
          tipo_demanda?: string | null
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by_email?: string | null
          uploaded_by_name?: string | null
          urgencia?: string | null
        }
        Update: {
          ano?: number | null
          assunto?: string
          author_id?: string
          bairro?: string | null
          cargo_destinatario?: string | null
          codigo_z?: string | null
          contato_solicitante?: string | null
          conteudo?: string | null
          created_at?: string
          data_geracao?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_name?: string | null
          destinatario?: string
          endereco_completo?: string | null
          id?: string
          last_edited_at?: string | null
          last_edited_by?: string | null
          last_edited_by_name?: string | null
          linha_telefonica?: string | null
          link_pdf_drive?: string | null
          local_demanda?: string | null
          marcador?: string | null
          numero?: string | null
          numero_protocolo?: string | null
          operador_nome?: string | null
          origem?: string | null
          protocolado_em?: string | null
          resposta_cidadao?: string | null
          secretaria_identificada?: string | null
          solicitante?: string | null
          status?: string
          tipo_demanda?: string | null
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by_email?: string | null
          uploaded_by_name?: string | null
          urgencia?: string | null
        }
        Relationships: []
      }
      oficios_backup: {
        Row: {
          backup_em: string | null
          dados: Json
          id: string
          oficio_id: string
        }
        Insert: {
          backup_em?: string | null
          dados: Json
          id?: string
          oficio_id: string
        }
        Update: {
          backup_em?: string | null
          dados?: Json
          id?: string
          oficio_id?: string
        }
        Relationships: []
      }
      preferencias_usuario: {
        Row: {
          cor_primaria: string | null
          cor_secundaria: string | null
          densidade: string | null
          id: string
          sidebar_compacta: boolean | null
          tamanho_fonte: string | null
          tema: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cor_primaria?: string | null
          cor_secundaria?: string | null
          densidade?: string | null
          id?: string
          sidebar_compacta?: boolean | null
          tamanho_fonte?: string | null
          tema?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cor_primaria?: string | null
          cor_secundaria?: string | null
          densidade?: string | null
          id?: string
          sidebar_compacta?: boolean | null
          tamanho_fonte?: string | null
          tema?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          aprovado_em: string | null
          aprovado_por: string | null
          avatar_url: string | null
          celular: string | null
          celular_verificado: boolean | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          status: string | null
          telefone1: string | null
          telefone2: string | null
          telefone3: string | null
          usa_2fa: boolean | null
          username: string | null
        }
        Insert: {
          active?: boolean
          aprovado_em?: string | null
          aprovado_por?: string | null
          avatar_url?: string | null
          celular?: string | null
          celular_verificado?: boolean | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          status?: string | null
          telefone1?: string | null
          telefone2?: string | null
          telefone3?: string | null
          usa_2fa?: boolean | null
          username?: string | null
        }
        Update: {
          active?: boolean
          aprovado_em?: string | null
          aprovado_por?: string | null
          avatar_url?: string | null
          celular?: string | null
          celular_verificado?: boolean | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          status?: string | null
          telefone1?: string | null
          telefone2?: string | null
          telefone3?: string | null
          usa_2fa?: boolean | null
          username?: string | null
        }
        Relationships: []
      }
      scripts: {
        Row: {
          author_id: string
          categoria: string
          conteudo: string
          created_at: string
          favorito: boolean
          id: string
          tags: string[] | null
          titulo: string
          updated_at: string
        }
        Insert: {
          author_id: string
          categoria?: string
          conteudo: string
          created_at?: string
          favorito?: boolean
          id?: string
          tags?: string[] | null
          titulo: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          categoria?: string
          conteudo?: string
          created_at?: string
          favorito?: boolean
          id?: string
          tags?: string[] | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      suggestion_interactions: {
        Row: {
          action: string
          context_assunto: string | null
          context_bairro: string | null
          created_at: string
          id: string
          source_id: string
          source_type: string
          user_id: string
        }
        Insert: {
          action: string
          context_assunto?: string | null
          context_bairro?: string | null
          created_at?: string
          id?: string
          source_id: string
          source_type: string
          user_id: string
        }
        Update: {
          action?: string
          context_assunto?: string | null
          context_bairro?: string | null
          created_at?: string
          id?: string
          source_id?: string
          source_type?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          subject: string
          type: string
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          subject: string
          type?: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          subject?: string
          type?: string
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      user_drive_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          drive_folder_id: string | null
          google_email: string
          id: string
          refresh_token: string
          token_expiry: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          drive_folder_id?: string | null
          google_email: string
          id?: string
          refresh_token: string
          token_expiry: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          drive_folder_id?: string | null
          google_email?: string
          id?: string
          refresh_token?: string
          token_expiry?: string
          updated_at?: string | null
          user_id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      user_sessions: {
        Row: {
          id: string
          ip_address: string | null
          logged_in_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_connections: {
        Row: {
          api_key: string | null
          api_url: string | null
          created_at: string
          id: string
          instance_id: string | null
          instance_name: string
          phone_number: string | null
          qr_code: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          instance_name: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          instance_name?: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          assigned_to: string | null
          connection_id: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          demanda_id: string | null
          id: string
          last_message_at: string | null
          remote_jid: string
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          connection_id: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          demanda_id?: string | null
          id?: string
          last_message_at?: string | null
          remote_jid: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          connection_id?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          demanda_id?: string | null
          id?: string
          last_message_at?: string | null
          remote_jid?: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          ai_analysis: Json | null
          ai_suggested_response: string | null
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          id: string
          media_type: string | null
          media_url: string | null
          message_id: string | null
          sender_name: string | null
          sender_phone: string | null
          sent_by: string | null
          status: string
        }
        Insert: {
          ai_analysis?: Json | null
          ai_suggested_response?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string
          direction?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sent_by?: string | null
          status?: string
        }
        Update: {
          ai_analysis?: Json | null
          ai_suggested_response?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_id?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sent_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      backup_diario_oficios: { Args: never; Returns: undefined }
      gerar_numero_protocolo: { Args: { p_ano: number }; Returns: string }
      get_email_by_username: { Args: { _username: string }; Returns: string }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_user_active: { Args: { _user_id: string }; Returns: boolean }
      is_user_approved: { Args: { _user_id: string }; Returns: boolean }
      liberar_numero: {
        Args: { p_ano: number; p_numero: number; p_user_id: string }
        Returns: boolean
      }
      liberar_reservas_expiradas: { Args: never; Returns: undefined }
      reservar_proximo_numero:
        | {
            Args: { p_ano: number; p_user_id: string; p_user_nome: string }
            Returns: number
          }
        | {
            Args: {
              p_ano: number
              p_min_numero?: number
              p_user_id: string
              p_user_nome: string
            }
            Returns: number
          }
      resetar_numeracao_anual: { Args: never; Returns: undefined }
      usar_numero: {
        Args: {
          p_ano: number
          p_numero: number
          p_oficio_id: string
          p_user_id: string
          p_user_nome: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    },
  },
} as const
