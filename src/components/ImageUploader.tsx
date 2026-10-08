import { useRef } from "react";
import { ImagePlus, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageUploaderProps {
  images: File[];
  onChange: (images: File[]) => void;
}

export default function ImageUploader({ images, onChange }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newImages = [...images, ...Array.from(files)];
    onChange(newImages);
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2" data-file-upload tabIndex={0} aria-label="Imagens para anexo">
      <label className="text-xs font-medium text-muted-foreground mb-1 block">📎 Imagens para Anexo</label>
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />
        <Button type="button" variant="outline" size="sm" className="flex-1 border-border text-xs" onClick={() => fileInputRef.current?.click()}>
          <ImagePlus size={14} className="mr-1" /> Galeria
        </Button>
        <Button type="button" variant="outline" size="sm" className="flex-1 border-border text-xs" onClick={() => cameraInputRef.current?.click()}>
          <Camera size={14} className="mr-1" /> Câmera
        </Button>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((file, i) => (
            <div key={i} className="relative rounded-lg overflow-hidden border border-border aspect-square bg-secondary">
              <img
                src={URL.createObjectURL(file)}
                alt={`Anexo ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
