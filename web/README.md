# API du Launcher Mélancolique

Ce dossier contient les fichiers statiques publiés à la racine de
`https://api.abdelnaim.fr`.

- `launcher/config-launcher/config.json` configure le launcher.
- `launcher/news-launcher/news.json` contient les actualités.
- `files/index.html` décrit les instances disponibles.
- `files/manifests/*.json` liste les fichiers de chaque instance.
- `files/instances/` contient les fichiers distribués aux joueurs et reste
  volontairement hors de Git à cause de sa taille.

## Apparence d'une instance

Champs facultatifs d'une instance dans `files/index.html` :

- `icon` : URL d'une image carrée qui remplace l'icône de l'instance. Sans ce
  champ, le launcher affiche l'icône du chargeur (bloc d'herbe pour Vanilla,
  enclume pour Forge et NeoForge, tissu pour Fabric, patchwork pour Quilt).
- `background` : URL de l'illustration affichée en fond du panneau de
  l'instance (format paysage, 1600 px de large conseillé).
- `description` : phrase affichée sous le nom de l'instance.
