import "./globals.css";
import Link from "next/link";
import type { Metadata, Viewport } from "next";
import { isAuthed } from "@/lib/session";
import LogoutButton from "@/components/LogoutButton";

export const metadata: Metadata = { title: "EasyLudo", description: "Ludothèque de jeux vidéo" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAuthed();
  return (
    <html lang="fr">
      <body>
        <header className="bar">
          <Link href="/" className="logo"><i>🎮</i>EasyLudo</Link>
          {authed && <nav className="nav">
            <Link href="/settings" className="btn">⚙️ <span>Paramètres</span></Link>
            <Link href="/add" className="btn primary add">+ Ajouter</Link>
          <LogoutButton />
          </nav>}
        </header>
        <main>{children}</main>
        {authed && <Link href="/add" className="fab" aria-label="Ajouter">+</Link>}
        <footer className="foot">
          Données fournies par <a href="https://www.wikidata.org" target="_blank" rel="noreferrer">Wikidata</a>,{" "}
          <a href="https://rawg.io" target="_blank" rel="noreferrer">RAWG</a>, IGDB et Libretro
        </footer>
      </body>
    </html>
  );
}
