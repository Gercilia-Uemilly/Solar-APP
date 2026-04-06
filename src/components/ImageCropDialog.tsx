import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crop as CropIcon, RotateCw, Check, X } from "lucide-react";

interface ImageCropDialogProps {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  fileName: string;
  onCropped: (croppedFile: File) => void;
}

/**
 * Loads an image as a local blob URL to avoid cross-origin tainted canvas issues.
 */
async function toLocalBlobUrl(src: string): Promise<string> {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return src; // fallback
  }
}

function getCroppedBlob(image: HTMLImageElement, crop: PixelCrop, fileName: string): Promise<File> {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );
  const isJpeg = /\.(jpe?g)$/i.test(fileName);
  const mime = isJpeg ? "image/jpeg" : "image/png";
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Falha ao recortar"));
      resolve(new File([blob], fileName, { type: mime }));
    }, mime, 0.92);
  });
}

export default function ImageCropDialog({ open, onClose, imageSrc, fileName, onCropped }: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [localSrc, setLocalSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Convert remote URL to local blob to avoid tainted canvas
  useEffect(() => {
    if (!open || !imageSrc) { setLocalSrc(null); return; }
    let revoke = "";
    toLocalBlobUrl(imageSrc).then((url) => {
      revoke = url;
      setLocalSrc(url);
    });
    return () => {
      if (revoke && revoke.startsWith("blob:")) URL.revokeObjectURL(revoke);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setLocalSrc(null);
    };
  }, [open, imageSrc]);

  const handleConfirm = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return;
    try {
      const file = await getCroppedBlob(imgRef.current, completedCrop, fileName);
      onCropped(file);
      onClose();
    } catch (e: any) {
      console.error("Crop error:", e);
    }
  }, [completedCrop, fileName, onCropped, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <CropIcon size={16} /> Recortar imagem
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <div className="max-h-[60vh] overflow-auto rounded border border-border">
            {localSrc ? (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
              >
                <img
                  ref={imgRef}
                  src={localSrc}
                  alt="Recortar"
                  className="max-w-full"
                />
              </ReactCrop>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando...</div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              <X size={14} className="mr-1" /> Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={!completedCrop}>
              <Check size={14} className="mr-1" /> Aplicar recorte
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
