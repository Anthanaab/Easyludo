import { cred } from "./settings";

// Jeton d'application eBay (clés gratuites), partagé entre la recherche de prix et la recherche par code-barres.
let tok: { v: string; exp: number } | null = null;
export async function ebayToken(): Promise<string | null> {
  const id = cred("EBAY_CLIENT_ID"), secret = cred("EBAY_CLIENT_SECRET");
  if (!id || !secret) return null;
  if (!tok || tok.exp < Date.now()) {
    const t = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64") },
      body: "grant_type=client_credentials&scope=" + encodeURIComponent("https://api.ebay.com/oauth/api_scope"),
    });
    if (!t.ok) return null;
    const j = await t.json();
    tok = { v: j.access_token, exp: Date.now() + (j.expires_in - 300) * 1000 };
  }
  return tok.v;
}
