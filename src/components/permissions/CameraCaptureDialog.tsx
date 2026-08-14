import { useEffect, useRef } from 'react';
import { Camera, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

export function CameraCaptureDialog({
  open,
  stream,
  onOpenChange,
  onCaptured,
}: {
  open: boolean;
  stream: MediaStream | null;
  onOpenChange: (open: boolean) => void;
  onCaptured: (dataUrl: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = video.current;
    if (element && stream) {
      element.srcObject = stream;
      void element.play().catch(() => undefined);
    }
    return () => {
      if (element) element.srcObject = null;
    };
  }, [stream]);

  function capture() {
    const source = video.current;
    if (!source?.videoWidth || !source.videoHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
    canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
    onCaptured(canvas.toDataURL('image/jpeg', 0.9));
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
      <DialogHeader className="px-4 pt-4">
        <DialogTitle>Take Photo</DialogTitle>
        <DialogDescription>Your camera is active only while this screen is open.</DialogDescription>
      </DialogHeader>
      <div className="mx-4 aspect-[3/4] overflow-hidden rounded-2xl bg-secondary">
        <video ref={video} autoPlay muted playsInline className="h-full w-full object-cover" />
      </div>
      <DialogFooter className="m-0">
        <Button variant="outline" onClick={() => onOpenChange(false)}><RotateCcw />Cancel</Button>
        <Button onClick={capture}><Camera />Capture Photo</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
