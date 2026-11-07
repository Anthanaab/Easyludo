export default {
  serverExternalPackages: ["better-sqlite3"],
  // L'application n'utilise pas <Image> : l'optimiseur d'images (surface d'attaque inutile) est désactivé
  images: { unoptimized: true },
};
