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
      atendimentos: {
        Row: {
          canal: string
          cidadao_nome: string
          created_at: string
          descricao_original: string | null
          fontes: Json | null
          id: string
          resposta_editada: string | null
          resposta_gerada: string | null
          resumo_demanda: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          canal?: string
          cidadao_nome?: string
          created_at?: string
          descricao_original?: string | null
          fontes?: Json | null
          id?: string
          resposta_editada?: string | null
          resposta_gerada?: string | null
          resumo_demanda?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          canal?: string
          cidadao_nome?: string
          created_at?: string
          descricao_original?: string | null
          fontes?: Json | null
          id?: string
          resposta_editada?: string | null
          resposta_gerada?: string | null
          resumo_demanda?: string | null
          updated_at?: string
          user_id?: string | null
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
      cidades: {
        Row: {
          canal_online: string | null
          criado_em: string
          id: string
          nome: string
          observacao: string | null
          porta_entrada: string | null
          prefeito: string | null
          uf: string
        }
        Insert: {
          canal_online?: string | null
          criado_em?: string
          id?: string
          nome: string
          observacao?: string | null
          porta_entrada?: string | null
          prefeito?: string | null
          uf?: string
        }
        Update: {
          canal_online?: string | null
          criado_em?: string
          id?: string
          nome?: string
          observacao?: string | null
          porta_entrada?: string | null
          prefeito?: string | null
          uf?: string
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
      contact_history: {
        Row: {
          contact_id: string
          created_at: string
          dados: Json | null
          descricao: string
          id: string
          oficio_id: string | null
          tipo: string
          user_id: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          dados?: Json | null
          descricao: string
          id?: string
          oficio_id?: string | null
          tipo: string
          user_id?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          dados?: Json | null
          descricao?: string
          id?: string
          oficio_id?: string | null
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_history_oficio_id_fkey"
            columns: ["oficio_id"]
            isOneToOne: false
            referencedRelation: "oficios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_reminders: {
        Row: {
          avisado_em: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          feito: boolean
          feito_em: string | null
          id: string
          lembrar_em: string
          responsavel_id: string | null
          texto: string
        }
        Insert: {
          avisado_em?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          feito?: boolean
          feito_em?: string | null
          id?: string
          lembrar_em: string
          responsavel_id?: string | null
          texto: string
        }
        Update: {
          avisado_em?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          feito?: boolean
          feito_em?: string | null
          id?: string
          lembrar_em?: string
          responsavel_id?: string | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_reminders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_reminders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_reminders_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tag_assignments: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tag_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tag_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "contact_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          cor: string | null
          created_at: string
          created_by: string | null
          id: string
          nome: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          arquivado_em: string | null
          bairro: string | null
          codigo_jr: string | null
          conferir_nono_digito: boolean
          created_at: string
          created_by: string | null
          empresa: string | null
          id: string
          nome: string | null
          observacoes: string | null
          origem: string
          responsavel_id: string | null
          status_atendimento: string
          telefone_e164: string | null
          ultima_msg_recebida_em: string | null
          ultima_resposta_em: string | null
          updated_at: string
          wa_lid: string | null
        }
        Insert: {
          arquivado_em?: string | null
          bairro?: string | null
          codigo_jr?: string | null
          conferir_nono_digito?: boolean
          created_at?: string
          created_by?: string | null
          empresa?: string | null
          id?: string
          nome?: string | null
          observacoes?: string | null
          origem?: string
          responsavel_id?: string | null
          status_atendimento?: string
          telefone_e164?: string | null
          ultima_msg_recebida_em?: string | null
          ultima_resposta_em?: string | null
          updated_at?: string
          wa_lid?: string | null
        }
        Update: {
          arquivado_em?: string | null
          bairro?: string | null
          codigo_jr?: string | null
          conferir_nono_digito?: boolean
          created_at?: string
          created_by?: string | null
          empresa?: string | null
          id?: string
          nome?: string | null
          observacoes?: string | null
          origem?: string
          responsavel_id?: string | null
          status_atendimento?: string
          telefone_e164?: string | null
          ultima_msg_recebida_em?: string | null
          ultima_resposta_em?: string | null
          updated_at?: string
          wa_lid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dossie_operador: {
        Row: {
          aguardando_confirmacao: boolean
          atualizado_em: string
          criado_em: string
          dados_extraidos: Json | null
          id: string
          itens: Json
          oficio_id: string | null
          operador_telefone: string
          status: string
        }
        Insert: {
          aguardando_confirmacao?: boolean
          atualizado_em?: string
          criado_em?: string
          dados_extraidos?: Json | null
          id?: string
          itens?: Json
          oficio_id?: string | null
          operador_telefone: string
          status?: string
        }
        Update: {
          aguardando_confirmacao?: boolean
          atualizado_em?: string
          criado_em?: string
          dados_extraidos?: Json | null
          id?: string
          itens?: Json
          oficio_id?: string | null
          operador_telefone?: string
          status?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          component_stack: string | null
          created_at: string
          error_message: string
          error_stack: string | null
          id: string
          url: string | null
          user_id: string | null
        }
        Insert: {
          component_stack?: string | null
          created_at?: string
          error_message: string
          error_stack?: string | null
          id?: string
          url?: string | null
          user_id?: string | null
        }
        Update: {
          component_stack?: string | null
          created_at?: string
          error_message?: string
          error_stack?: string | null
          id?: string
          url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      fz_agendamentos: {
        Row: {
          contact_id: string | null
          created_at: string
          created_by: string | null
          enviado_em: string | null
          erro: string | null
          id: string
          linha: string | null
          numero_linha: string | null
          quando: string
          status: string
          telefone_e164: string
          texto: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          enviado_em?: string | null
          erro?: string | null
          id?: string
          linha?: string | null
          numero_linha?: string | null
          quando: string
          status?: string
          telefone_e164: string
          texto: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          enviado_em?: string | null
          erro?: string | null
          id?: string
          linha?: string | null
          numero_linha?: string | null
          quando?: string
          status?: string
          telefone_e164?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "fz_agendamentos_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fz_agendamentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fz_fila: {
        Row: {
          chave: string | null
          contact_id: string | null
          criado_em: string
          id: string
          linha: string | null
          nome: string | null
          oficio_id: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          resumo: string | null
          telefone_e164: string | null
          tipo: string
        }
        Insert: {
          chave?: string | null
          contact_id?: string | null
          criado_em?: string
          id?: string
          linha?: string | null
          nome?: string | null
          oficio_id?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          resumo?: string | null
          telefone_e164?: string | null
          tipo: string
        }
        Update: {
          chave?: string | null
          contact_id?: string | null
          criado_em?: string
          id?: string
          linha?: string | null
          nome?: string | null
          oficio_id?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          resumo?: string | null
          telefone_e164?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fz_fila_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fz_fila_oficio_id_fkey"
            columns: ["oficio_id"]
            isOneToOne: false
            referencedRelation: "oficios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fz_fila_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fz_papeis: {
        Row: {
          papel: string
          updated_at: string
          user_id: string
        }
        Insert: {
          papel: string
          updated_at?: string
          user_id: string
        }
        Update: {
          papel?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fz_papeis_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fz_pastas: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          nome: string
          ordem: number
          tag_ids: string[]
          telefones: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          ordem?: number
          tag_ids?: string[]
          telefones?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          ordem?: number
          tag_ids?: string[]
          telefones?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "fz_pastas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fz_sequencia_partes: {
        Row: {
          audio_id: string | null
          id: string
          intervalo_s: number
          midia_id: string | null
          ordem: number
          sequencia_id: string
          texto: string | null
          tipo: string
        }
        Insert: {
          audio_id?: string | null
          id?: string
          intervalo_s?: number
          midia_id?: string | null
          ordem?: number
          sequencia_id: string
          texto?: string | null
          tipo: string
        }
        Update: {
          audio_id?: string | null
          id?: string
          intervalo_s?: number
          midia_id?: string | null
          ordem?: number
          sequencia_id?: string
          texto?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fz_sequencia_partes_midia_id_fkey"
            columns: ["midia_id"]
            isOneToOne: false
            referencedRelation: "media_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fz_sequencia_partes_sequencia_id_fkey"
            columns: ["sequencia_id"]
            isOneToOne: false
            referencedRelation: "fz_sequencias"
            referencedColumns: ["id"]
          },
        ]
      }
      fz_sequencias: {
        Row: {
          arquivado_em: string | null
          atalho: string | null
          created_at: string
          created_by: string | null
          id: string
          pasta: string
          titulo: string
        }
        Insert: {
          arquivado_em?: string | null
          atalho?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          pasta?: string
          titulo: string
        }
        Update: {
          arquivado_em?: string | null
          atalho?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          pasta?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fz_sequencias_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_job_errors: {
        Row: {
          created_at: string
          id: string
          job_id: string
          linha: number | null
          motivo: string
          valor: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          linha?: number | null
          motivo: string
          valor?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          linha?: number | null
          motivo?: string
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_job_errors_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          arquivo_nome: string | null
          atualizados: number
          created_at: string
          duplicados: number
          finished_at: string | null
          id: string
          ignorados: number
          invalidos: number
          novos: number
          status: string
          tipo: string
          total_linhas: number
          user_id: string
        }
        Insert: {
          arquivo_nome?: string | null
          atualizados?: number
          created_at?: string
          duplicados?: number
          finished_at?: string | null
          id?: string
          ignorados?: number
          invalidos?: number
          novos?: number
          status?: string
          tipo: string
          total_linhas?: number
          user_id?: string
        }
        Update: {
          arquivo_nome?: string | null
          atualizados?: number
          created_at?: string
          duplicados?: number
          finished_at?: string | null
          id?: string
          ignorados?: number
          invalidos?: number
          novos?: number
          status?: string
          tipo?: string
          total_linhas?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      login_attempts: {
        Row: {
          created_at: string
          id: string
          identifier: string
          ip_address: string | null
          motivo: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          ip_address?: string | null
          motivo?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          ip_address?: string | null
          motivo?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      media_library: {
        Row: {
          arquivado_em: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          created_by: string | null
          id: string
          mime_type: string | null
          pasta: string
          storage_path: string | null
          tamanho_bytes: number | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          arquivado_em?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mime_type?: string | null
          pasta?: string
          storage_path?: string | null
          tamanho_bytes?: number | null
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          arquivado_em?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mime_type?: string | null
          pasta?: string
          storage_path?: string | null
          tamanho_bytes?: number | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_library_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      oficio_respostas: {
        Row: {
          arquivo_nome: string
          arquivo_path: string | null
          arquivo_url: string
          conteudo_extraido: string | null
          created_at: string
          data_resposta: string | null
          id: string
          match_confianca: number | null
          match_metodo: string | null
          match_status: string | null
          mime_type: string | null
          oficio_id: string
          orgao_respondente: string | null
          resumo_ia: string | null
          sha256: string | null
          tamanho_bytes: number | null
          tipo_origem: string
          updated_at: string
          uploaded_by: string | null
          uploaded_by_nome: string | null
        }
        Insert: {
          arquivo_nome: string
          arquivo_path?: string | null
          arquivo_url: string
          conteudo_extraido?: string | null
          created_at?: string
          data_resposta?: string | null
          id?: string
          match_confianca?: number | null
          match_metodo?: string | null
          match_status?: string | null
          mime_type?: string | null
          oficio_id: string
          orgao_respondente?: string | null
          resumo_ia?: string | null
          sha256?: string | null
          tamanho_bytes?: number | null
          tipo_origem?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_nome?: string | null
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string | null
          arquivo_url?: string
          conteudo_extraido?: string | null
          created_at?: string
          data_resposta?: string | null
          id?: string
          match_confianca?: number | null
          match_metodo?: string | null
          match_status?: string | null
          mime_type?: string | null
          oficio_id?: string
          orgao_respondente?: string | null
          resumo_ia?: string | null
          sha256?: string | null
          tamanho_bytes?: number | null
          tipo_origem?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oficio_respostas_oficio_id_fkey"
            columns: ["oficio_id"]
            isOneToOne: false
            referencedRelation: "oficios"
            referencedColumns: ["id"]
          },
        ]
      }
      oficio_status_history: {
        Row: {
          alterado_em: string
          alterado_por: string | null
          alterado_por_nome: string | null
          estimado: boolean
          id: string
          oficio_id: string
          status_anterior: string | null
          status_novo: string
        }
        Insert: {
          alterado_em?: string
          alterado_por?: string | null
          alterado_por_nome?: string | null
          estimado?: boolean
          id?: string
          oficio_id: string
          status_anterior?: string | null
          status_novo: string
        }
        Update: {
          alterado_em?: string
          alterado_por?: string | null
          alterado_por_nome?: string | null
          estimado?: boolean
          id?: string
          oficio_id?: string
          status_anterior?: string | null
          status_novo?: string
        }
        Relationships: [
          {
            foreignKeyName: "oficio_status_history_oficio_id_fkey"
            columns: ["oficio_id"]
            isOneToOne: false
            referencedRelation: "oficios"
            referencedColumns: ["id"]
          },
        ]
      }
      oficios: {
        Row: {
          ano: number | null
          arquivo_externo_at: string | null
          arquivo_externo_nome: string | null
          arquivo_externo_por: string | null
          arquivo_externo_tipo: string | null
          arquivo_externo_url: string | null
          assunto: string
          author_id: string
          bairro: string | null
          cargo_destinatario: string | null
          cidade: string
          codigo_z: string | null
          contato_id: string | null
          contato_solicitante: string | null
          conteudo: string | null
          created_at: string
          data_geracao: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_by_name: string | null
          destinatario: string
          editing_by: string | null
          editing_by_name: string | null
          editing_since: string | null
          email_enviado_em: string | null
          email_enviado_por: string | null
          email_id: string | null
          endereco_completo: string | null
          esfera: string
          ia_gerada: boolean
          ia_pendente: boolean
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
          orgao_copia_id: string | null
          orgao_destino_id: string | null
          origem: string | null
          prazo_retorno: string | null
          protocolado_em: string | null
          respondido_em: string | null
          resposta_cidadao: string | null
          secretaria_identificada: string | null
          solicitante: string | null
          status: string
          telefone_recebimento: string | null
          tipo_demanda: string | null
          total_respostas: number
          updated_at: string
          uploaded_at: string | null
          uploaded_by_email: string | null
          uploaded_by_name: string | null
          urgencia: string | null
          versao: string | null
        }
        Insert: {
          ano?: number | null
          arquivo_externo_at?: string | null
          arquivo_externo_nome?: string | null
          arquivo_externo_por?: string | null
          arquivo_externo_tipo?: string | null
          arquivo_externo_url?: string | null
          assunto?: string
          author_id: string
          bairro?: string | null
          cargo_destinatario?: string | null
          cidade?: string
          codigo_z?: string | null
          contato_id?: string | null
          contato_solicitante?: string | null
          conteudo?: string | null
          created_at?: string
          data_geracao?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_name?: string | null
          destinatario?: string
          editing_by?: string | null
          editing_by_name?: string | null
          editing_since?: string | null
          email_enviado_em?: string | null
          email_enviado_por?: string | null
          email_id?: string | null
          endereco_completo?: string | null
          esfera?: string
          ia_gerada?: boolean
          ia_pendente?: boolean
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
          orgao_copia_id?: string | null
          orgao_destino_id?: string | null
          origem?: string | null
          prazo_retorno?: string | null
          protocolado_em?: string | null
          respondido_em?: string | null
          resposta_cidadao?: string | null
          secretaria_identificada?: string | null
          solicitante?: string | null
          status?: string
          telefone_recebimento?: string | null
          tipo_demanda?: string | null
          total_respostas?: number
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by_email?: string | null
          uploaded_by_name?: string | null
          urgencia?: string | null
          versao?: string | null
        }
        Update: {
          ano?: number | null
          arquivo_externo_at?: string | null
          arquivo_externo_nome?: string | null
          arquivo_externo_por?: string | null
          arquivo_externo_tipo?: string | null
          arquivo_externo_url?: string | null
          assunto?: string
          author_id?: string
          bairro?: string | null
          cargo_destinatario?: string | null
          cidade?: string
          codigo_z?: string | null
          contato_id?: string | null
          contato_solicitante?: string | null
          conteudo?: string | null
          created_at?: string
          data_geracao?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_by_name?: string | null
          destinatario?: string
          editing_by?: string | null
          editing_by_name?: string | null
          editing_since?: string | null
          email_enviado_em?: string | null
          email_enviado_por?: string | null
          email_id?: string | null
          endereco_completo?: string | null
          esfera?: string
          ia_gerada?: boolean
          ia_pendente?: boolean
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
          orgao_copia_id?: string | null
          orgao_destino_id?: string | null
          origem?: string | null
          prazo_retorno?: string | null
          protocolado_em?: string | null
          respondido_em?: string | null
          resposta_cidadao?: string | null
          secretaria_identificada?: string | null
          solicitante?: string | null
          status?: string
          telefone_recebimento?: string | null
          tipo_demanda?: string | null
          total_respostas?: number
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by_email?: string | null
          uploaded_by_name?: string | null
          urgencia?: string | null
          versao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oficios_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oficios_orgao_copia_id_fkey"
            columns: ["orgao_copia_id"]
            isOneToOne: false
            referencedRelation: "orgaos_publicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oficios_orgao_destino_id_fkey"
            columns: ["orgao_destino_id"]
            isOneToOne: false
            referencedRelation: "orgaos_publicos"
            referencedColumns: ["id"]
          },
        ]
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
      orgaos_publicos: {
        Row: {
          assuntos: string[]
          ativo: boolean
          cidade_id: string | null
          conferido_em: string | null
          criado_em: string
          email: string | null
          endereco: string | null
          esfera: string
          fonte: string | null
          id: string
          nome: string
          responsavel: string | null
          sigla: string | null
          situacao: string
          telefone: string | null
        }
        Insert: {
          assuntos?: string[]
          ativo?: boolean
          cidade_id?: string | null
          conferido_em?: string | null
          criado_em?: string
          email?: string | null
          endereco?: string | null
          esfera?: string
          fonte?: string | null
          id?: string
          nome: string
          responsavel?: string | null
          sigla?: string | null
          situacao?: string
          telefone?: string | null
        }
        Update: {
          assuntos?: string[]
          ativo?: boolean
          cidade_id?: string | null
          conferido_em?: string | null
          criado_em?: string
          email?: string | null
          endereco?: string | null
          esfera?: string
          fonte?: string | null
          id?: string
          nome?: string
          responsavel?: string | null
          sigla?: string | null
          situacao?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orgaos_publicos_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
        ]
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
      roteamento: {
        Row: {
          categoria: string
          cidade_id: string
          id: string
          orgao_copia_id: string | null
          orgao_destino_id: string | null
        }
        Insert: {
          categoria: string
          cidade_id: string
          id?: string
          orgao_copia_id?: string | null
          orgao_destino_id?: string | null
        }
        Update: {
          categoria?: string
          cidade_id?: string
          id?: string
          orgao_copia_id?: string | null
          orgao_destino_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roteamento_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roteamento_orgao_copia_id_fkey"
            columns: ["orgao_copia_id"]
            isOneToOne: false
            referencedRelation: "orgaos_publicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roteamento_orgao_destino_id_fkey"
            columns: ["orgao_destino_id"]
            isOneToOne: false
            referencedRelation: "orgaos_publicos"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          atalho: string | null
          author_id: string
          categoria: string
          conteudo: string
          created_at: string
          favorito: boolean
          id: string
          ordem: number
          subcategoria: string
          tags: string[] | null
          titulo: string
          updated_at: string
        }
        Insert: {
          atalho?: string | null
          author_id: string
          categoria?: string
          conteudo: string
          created_at?: string
          favorito?: boolean
          id?: string
          ordem?: number
          subcategoria?: string
          tags?: string[] | null
          titulo: string
          updated_at?: string
        }
        Update: {
          atalho?: string | null
          author_id?: string
          categoria?: string
          conteudo?: string
          created_at?: string
          favorito?: boolean
          id?: string
          ordem?: number
          subcategoria?: string
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
      support_tickets: {
        Row: {
          ai_response: string | null
          category: string
          created_at: string
          description: string
          escalated_at: string | null
          id: string
          screenshot_url: string | null
          status: string
          updated_at: string
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          ai_response?: string | null
          category?: string
          created_at?: string
          description: string
          escalated_at?: string | null
          id?: string
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          ai_response?: string | null
          category?: string
          created_at?: string
          description?: string
          escalated_at?: string | null
          id?: string
          screenshot_url?: string | null
          status?: string
          updated_at?: string
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
      versoes_oficio: {
        Row: {
          arquivo_nome: string
          arquivo_tipo: string | null
          arquivo_url: string
          criado_em: string
          criado_por: string
          criado_por_nome: string | null
          descricao: string | null
          id: string
          oficio_id: string
        }
        Insert: {
          arquivo_nome: string
          arquivo_tipo?: string | null
          arquivo_url: string
          criado_em?: string
          criado_por: string
          criado_por_nome?: string | null
          descricao?: string | null
          id?: string
          oficio_id: string
        }
        Update: {
          arquivo_nome?: string
          arquivo_tipo?: string | null
          arquivo_url?: string
          criado_em?: string
          criado_por?: string
          criado_por_nome?: string | null
          descricao?: string | null
          id?: string
          oficio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "versoes_oficio_oficio_id_fkey"
            columns: ["oficio_id"]
            isOneToOne: false
            referencedRelation: "oficios"
            referencedColumns: ["id"]
          },
        ]
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
      demanda_counts: {
        Row: {
          tipo_demanda: string | null
          total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      backup_diario_oficios: { Args: never; Returns: undefined }
      buscar_audio_tema: { Args: { p_tema: string }; Returns: string }
      buscar_base_conhecimento: {
        Args: { p_query: string }
        Returns: {
          categoria: string
          descricao: string
          link: string
          titulo: string
        }[]
      }
      criar_oficio_whatsapp: {
        Args: {
          p_assunto: string
          p_bairro: string
          p_contato: string
          p_conteudo: string
          p_local: string
          p_secretaria: string
          p_solicitante: string
          p_tipo: string
        }
        Returns: string
      }
      cron_token_valid: { Args: { p_token: string }; Returns: boolean }
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
      registrar_atendimento_whatsapp: {
        Args: {
          p_mensagem: string
          p_nome: string
          p_resposta: string
          p_resumo: string
        }
        Returns: string
      }
      reservar_proximo_numero: {
        Args: {
          p_ano: number
          p_min_numero?: number
          p_user_id: string
          p_user_nome: string
        }
        Returns: number
      }
      resetar_numeracao_anual: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
      app_role: ["admin", "user"],
    },
  },
} as const
