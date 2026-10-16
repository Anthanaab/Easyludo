import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

// Lit un code-barres sur une photo (appareil photo natif : fonctionne aussi en HTTP, contrairement au flux caméra en direct).
// Les photos de téléphone sont très grandes : on essaie plusieurs tailles, la plus lisible n'est pas toujours la plus grande.
export async function decodePhoto(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Image illisible"));
      i.src = url;
    });
    const hints = new Map<DecodeHintType, unknown>([
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39]],
      [DecodeHintType.TRY_HARDER, true],
    ]);
    const reader = new BrowserMultiFormatReader(hints);
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    // Tailles essayées (0 = taille réelle), chacune à l'endroit puis tournée de 90° (boîte photographiée de côté)
    for (const max of [1600, 1000, 2400, 0]) {
      const scale = max ? Math.min(1, max / longest) : 1;
      const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
      for (const turn of [false, true]) {
        const canvas = document.createElement("canvas");
        canvas.width = turn ? h : w;
        canvas.height = turn ? w : h;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        if (turn) { ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(Math.PI / 2); ctx.drawImage(img, -w / 2, -h / 2, w, h); }
        else ctx.drawImage(img, 0, 0, w, h);
        try { return reader.decodeFromCanvas(canvas).getText(); } catch { /* essai suivant */ }
      }
    }
    return null;
  } finally { URL.revokeObjectURL(url); }
}
