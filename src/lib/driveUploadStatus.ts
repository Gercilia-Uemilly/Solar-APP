export function isDriveAuthRequired(payload: any) {
  return Boolean(payload?.needsAuth || payload?.needsReauth);
}

export function getDriveAuthDescription(payload: any) {
  if (payload?.needsReauth) {
    return "Permissões expiradas. Reconecte sua conta em Configurações → Google Drive.";
  }

  return "Vá em Configurações → Google Drive → Conectar para vincular sua conta.";
}

export function getDriveErrorMessage(payload: any, fallback = "Erro ao enviar para o Drive") {
  return payload?.error || payload?.message || fallback;
}