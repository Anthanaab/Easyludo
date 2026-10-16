"use client";
import { useState } from "react";
import { decodePhoto } from "@/lib/decodeBarcode";

export default function PhotoScan({ onCode, primary }: { onCode: (code: string) => void; primary?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const code = await decodePhoto(file);
      if (code) onCode(code);
      else setErr("Aucun code-barres lu. Rapproche-toi, cadre bien les barres, avec assez de lumière, et réessaie.");
    } catch { setErr("Photo illisible, réessaie."); }
    setBusy(false);
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label className={`btn ${primary ? "primary" : ""}`} style={{ justifyContent: "center", padding: 12, cursor: busy ? "wait" : "pointer" }}>
        {busy ? "Lecture de la photo…" : "📸 Photographier le code-barres"}
        {/* L'appareil photo natif s'ouvre : aucune exigence HTTPS */}
        <input type="file" accept="image/*" capture="environment" hidden disabled={busy}
          onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {err && <span className="err">{err}</span>}
    </div>
  );
}
