"use client";
export default function LogoutButton() {
  return (
    <button className="btn" title="Se déconnecter" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}>
      ⏻ <span>Quitter</span>
    </button>
  );
}
