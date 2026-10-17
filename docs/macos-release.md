# Publier le launcher sur macOS

Une application macOS distribuée hors de l'App Store doit être signée avec un certificat
`Developer ID Application`, puis notariée par Apple. Sans ces deux étapes, Gatekeeper affiche
le message indiquant qu'Apple ne peut pas vérifier l'absence de logiciel malveillant.

## Prérequis

- une adhésion active à l'Apple Developer Program ;
- un certificat `Developer ID Application` exporté avec sa clé privée au format `.p12` ;
- un mot de passe d'application créé sur le compte Apple utilisé pour la notarisation.

## Secrets GitHub Actions

Dans **Settings > Secrets and variables > Actions**, ajouter :

| Secret | Valeur |
| --- | --- |
| `MAC_CSC_LINK` | contenu Base64 du fichier `.p12` |
| `MAC_CSC_KEY_PASSWORD` | mot de passe du fichier `.p12` |
| `APPLE_ID` | adresse du compte Apple Developer |
| `APPLE_APP_SPECIFIC_PASSWORD` | mot de passe d'application Apple |
| `APPLE_TEAM_ID` | identifiant d'équipe Apple de 10 caractères |

Pour encoder le certificat :

```bash
base64 -i DeveloperIDApplication.p12 | pbcopy
```

Le workflow refuse maintenant de produire une release macOS si un de ces secrets manque. Après
le build, il vérifie aussi la signature, l'acceptation Gatekeeper et le ticket de notarisation.

`npm run build` applique la même protection sur un Mac local. Pour tester uniquement le packaging
sans certificat, utiliser `npm run build:unsigned`. L'artefact ainsi créé ne doit pas être distribué :
Gatekeeper le bloquera après son téléchargement.

## Vérification locale d'une release

Après avoir monté le DMG et copié l'application :

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/Launcher Melancolique.app"
spctl --assess --type execute --verbose=4 "/Applications/Launcher Melancolique.app"
xcrun stapler validate "/Applications/Launcher Melancolique.app"
```

`spctl` doit indiquer `accepted` et une source `Notarized Developer ID`.
