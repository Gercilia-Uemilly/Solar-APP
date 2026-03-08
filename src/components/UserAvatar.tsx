import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  userId?: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  editable?: boolean;
  onAvatarChange?: (url: string | null) => void;
  className?: string;
}

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
};

const iconSizeMap = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
};

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function getAvatarColor(name?: string | null): string {
  if (!name) return "bg-primary/20 text-primary";
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const colors = [
    "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    "bg-amber-500/20 text-amber-600 dark:text-amber-400",
    "bg-rose-500/20 text-rose-600 dark:text-rose-400",
    "bg-violet-500/20 text-violet-600 dark:text-violet-400",
    "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400",
    "bg-orange-500/20 text-orange-600 dark:text-orange-400",
  ];
  return colors[hash % colors.length];
}

export default function UserAvatar({
  userId,
  fullName,
  avatarUrl,
  size = "md",
  editable = false,
  onAvatarChange,
  className,
}: UserAvatarProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    if (!userId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/avatar.${ext}`;

      // Remove old avatar files first
      const { data: existing } = await supabase.storage.from("avatars").list(userId);
      if (existing?.length) {
        await supabase.storage.from("avatars").remove(existing.map((f) => `${userId}/${f.name}`));
      }

      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      // Use signed URL (bucket is private)
      const { data: signedData, error: signedErr } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signedErr) throw signedErr;
      const signedUrl = signedData.signedUrl;

      // Store the path (not the signed URL) so we can regenerate signed URLs later
      await supabase.from("profiles").update({ avatar_url: path } as any).eq("id", userId);
      onAvatarChange?.(signedUrl);
      toast({ title: "Foto atualizada!" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  };

  const handleRemove = async () => {
    if (!userId) return;
    setUploading(true);
    try {
      const { data: existing } = await supabase.storage.from("avatars").list(userId);
      if (existing?.length) {
        await supabase.storage.from("avatars").remove(existing.map((f) => `${userId}/${f.name}`));
      }
      await supabase.from("profiles").update({ avatar_url: null } as any).eq("id", userId);
      onAvatarChange?.(null);
      toast({ title: "Foto removida" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  };

  const initials = getInitials(fullName);
  const colorClass = getAvatarColor(fullName);

  return (
    <div className={cn("relative inline-flex group", className)}>
      <Avatar className={cn(sizeMap[size], "ring-2 ring-border shadow-sm")}>
        {avatarUrl ? (
          <AvatarImage src={avatarUrl} alt={fullName || "Avatar"} className="object-cover" />
        ) : null}
        <AvatarFallback className={cn("font-semibold", colorClass)}>
          {uploading ? <Loader2 size={iconSizeMap[size]} className="animate-spin" /> : initials}
        </AvatarFallback>
      </Avatar>

      {editable && !uploading && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Alterar foto"
          >
            <Camera size={iconSizeMap[size]} className="text-white" />
          </button>
          {avatarUrl && (
            <button
              onClick={handleRemove}
              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              title="Remover foto"
            >
              <X size={10} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
