"use client";
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function Scanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let stop: (() => void) | undefined;
    let done = false;
    reader
      .decodeFromConstraints({ video: { facingMode: "environment" } }, video.current!, (res) => {
        if (res && !done) { done = true; onCode(res.getText()); }
      })
      .then((c) => { stop = () => c.stop(); })
      .catch(() => setError("Caméra inaccessible (HTTPS ou autorisation requise)."));
    return () => stop?.();
  }, [onCode]);

  return (
    <div>
      <video ref={video} muted playsInline />
      {error && <p className="err">{error}</p>}
    </div>
  );
}
