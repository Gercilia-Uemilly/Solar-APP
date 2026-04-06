import { useState, useRef, useCallback } from "react";
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
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const ext = fileName.split(".").pop() || "png";
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
      resolve(new File([blob!], fileName, { type: mime }));
    }, fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") ? "image/jpeg" : "image/png", 0.92);
  });
}

export default function ImageCropDialog({ open, onClose, imageSrc, fileName, onCropped }: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [rotation, setRotation] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleConfirm = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return;
    const file = await getCroppedBlob(imgRef.current, completedCrop, fileName);
    onCropped(file);
    onClose();
  }, [completedCrop, fileName, onCropped, onClose]);

  const rotate = () => setRotation((r) => (r + 90) % 360);

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
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Recortar"
                className="max-w-full"
                style={{ transform: `rotate(${rotation}deg)` }}
              />
            </ReactCrop>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={rotate}>
              <RotateCw size={14} className="mr-1" /> Girar
            </Button>
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
