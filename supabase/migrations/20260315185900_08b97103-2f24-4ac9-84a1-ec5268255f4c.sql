
-- WhatsApp connections (one per operator)
CREATE TABLE public.whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  instance_name TEXT NOT NULL,
  instance_id TEXT,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  qr_code TEXT,
  api_url TEXT,
  api_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own whatsapp connection" ON public.whatsapp_connections
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all connections" ON public.whatsapp_connections
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- WhatsApp conversations
CREATE TABLE public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE NOT NULL,
  remote_jid TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to UUID,
  demanda_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read conversations" ON public.whatsapp_conversations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users manage conversations" ON public.whatsapp_conversations
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- WhatsApp messages
CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE NOT NULL,
  message_id TEXT,
  direction TEXT NOT NULL DEFAULT 'incoming',
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  sender_name TEXT,
  sender_phone TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  ai_suggested_response TEXT,
  ai_analysis JSONB,
  sent_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read messages" ON public.whatsapp_messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users insert messages" ON public.whatsapp_messages
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users update messages" ON public.whatsapp_messages
  FOR UPDATE TO authenticated USING (true);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;

-- Triggers for updated_at
CREATE TRIGGER update_whatsapp_connections_updated_at
  BEFORE UPDATE ON public.whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
