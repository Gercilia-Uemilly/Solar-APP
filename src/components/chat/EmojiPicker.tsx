import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";

const EMOJI_LIST = [
  "😀", "😂", "😍", "🥰", "😎", "🤔", "👍", "👏",
  "🎉", "🔥", "❤️", "💯", "✅", "⭐", "🙏", "💪",
  "😅", "😢", "😡", "🤝", "👋", "🚀", "📌", "⚠️",
  "✨", "💡", "📎", "📄", "🗂️", "📢", "🔔", "⏰",
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export default function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
          <Smile size={18} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start" side="top">
        <div className="grid grid-cols-8 gap-1">
          {EMOJI_LIST.map(emoji => (
            <button
              key={emoji}
              onClick={() => { onSelect(emoji); setOpen(false); }}
              className="text-lg h-8 w-8 flex items-center justify-center rounded hover:bg-accent transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
