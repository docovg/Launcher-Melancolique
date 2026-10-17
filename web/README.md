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

- `icon` : nom d'une icône intégrée (`castle`, `cog`, `sword`, `pickaxe`,
  `tree`, `compass`, `star`, `flask`, `block`, `anvil`, `spool`, `quilt`) ou URL
  d'une image carrée. Sans ce champ, le launcher choisit une icône d'après le
  nom de l'instance, sinon d'après son chargeur.
- `background` : URL de l'illustration affichée en fond du panneau de
  l'instance (format paysage, 1600 px de large conseillé).
- `description` : phrase affichée sous le nom de l'instance.
