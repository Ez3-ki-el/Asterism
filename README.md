# Asterism

![Asterism](og.png)

Asterism est une carte interactive des artistes proches les uns des autres, dans l'esprit de l'ancien TuneGlue Music Map. On cherche un artiste, on ouvre sa fiche, et on explore le graphe de proche en proche. Les données viennent de l'API publique de Deezer.

Un astérisme est une figure d'étoiles reconnaissable, comme la Grande Ourse. C'est ce que dessinent des artistes reliés entre eux, et c'est aussi le nom du signe typographique ⁂ qui a inspiré le logo.

Un seul fichier de page, `index.html`. Pas de build, pas de serveur, pas de clé d'API : tout se passe dans le navigateur.

## Fonctions

- **Recherche** d'un artiste, ou bouton **Surprends-moi** (genre Deezer au hasard, puis deux sauts parmi les artistes liés).
- **Fiche fixe** au clic sur un nœud : Explorer, Écouter, Top 5 titres. La barre de lecture se déplace pour avancer dans l'extrait de 30 secondes, et un anneau pulse autour de l'avatar qui joue.
- **Focus** : n'afficher qu'un nœud et ses voisins à 1, 2 ou 3 sauts.
- **Menu contextuel** (clic droit ou appui long) : explorer, écouter, focus, épingler, élaguer les feuilles, supprimer.
- **Annuler et rétablir** pour les suppressions comme pour les ajouts.
- **Écoute au survol**, en option, désactivée par défaut.
- Mode **clair ou sombre**, qui suit le système, et usage tactile.

## Raccourcis

| Action | Souris | Clavier | Tactile |
| --- | --- | --- | --- |
| Ouvrir la fiche | clic | | tap |
| Explorer un nœud | double-clic | | double-tap |
| Menu du nœud | clic droit | | appui long |
| Supprimer le nœud sélectionné | | Suppr | |
| Annuler, rétablir | | Ctrl+Z, Ctrl+Y | |
| Fermer fiche et menu | | Échap | |

L'adresse de la page mémorise l'artiste de départ : `.../#Radiohead` ouvre directement la carte de Radiohead.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | La page entière : styles, script et balises de référencement. |
| `og.png` | Image d'aperçu pour le partage (1200 x 630), sans photo d'artiste. |
| `logo.svg` | Le logo seul, qui s'adapte au mode clair ou sombre. |
| `sitemap.xml` | Plan du site, à déclarer dans la Search Console. |
| `.nojekyll` | Désactive le traitement Jekyll de GitHub Pages, inutile ici. |

## Publier sur GitHub Pages

La page est statique, il suffit de la servir telle quelle.

Avec l'interface web : créer le dépôt `Asterism`, y pousser ce dossier, puis **Settings > Pages > Build and deployment**, source **Deploy from a branch**, branche `main`, dossier `/ (root)`.

Avec la CLI `gh`, depuis ce dossier :

```
git init -b main
git add .
git commit -m "Première version"
gh repo create Asterism --public --source . --push
gh api -X POST "repos/{owner}/{repo}/pages" -f "source[branch]=main" -f "source[path]=/"
```

Le site est ensuite disponible à l'adresse `https://<compte>.github.io/Asterism/` au bout d'une ou deux minutes. Si le compte ou le nom du dépôt changent, il faut mettre à jour cette adresse à quatre endroits : la balise `canonical`, les balises Open Graph et Twitter, les données structurées de `index.html`, et `sitemap.xml`.

## Référencement

Ce qui est en place :

- Titre, description, adresse canonique, balises Open Graph et Twitter, données structurées `WebApplication`, couleur de thème claire et sombre.
- Un texte réel dans l'écran d'accueil, visible par tous les visiteurs, avec un seul `h1`.
- Une image de partage et un plan du site.

À faire après la publication :

1. Vérifier le site dans la [Google Search Console](https://search.google.com/search-console) (propriété de type « préfixe d'URL », méthode « balise HTML »), puis y déclarer `sitemap.xml`.
2. Faire de même dans les outils pour webmasters de Bing.
3. Obtenir quelques liens entrants : c'est ce qui compte le plus pour un petit outil de niche.

Limites à connaître :

- Un `robots.txt` placé dans ce dépôt serait ignoré : les robots ne le cherchent qu'à la racine du domaine `github.io`. Il n'y en a donc pas ici.
- Les adresses du type `#Radiohead` ne sont pas indexées, car Google ignore ce qui suit le `#`. La page ne peut pas se classer sur des requêtes comme « artistes similaires à Radiohead » : cela demanderait des pages statiques par artiste, ce qui est un autre chantier.

## Notes techniques

- **Deezer** : les appels passent en JSONP (`output=jsonp`), parce que l'API ne renvoie pas d'en-têtes CORS. Rien n'est stocké côté serveur.
- **Quota** : Deezer limite à environ 50 requêtes toutes les 5 secondes par adresse IP. Chaque visiteur a donc son propre quota.
- **d3** : chargé depuis jsDelivr en version figée (`d3@7.9.0`).
- **Stockage local** : le thème (`mg-theme`) et l'option d'écoute au survol (`mg-hover`).
- **Dépendance fragile** : le mode JSONP de Deezer n'est pas garanti dans la durée. Si Deezer le retirait, il faudrait passer par un petit proxy.
- **Typographie** : piles de polices système (serif pour les titres, monospace pour les données). Aucune police externe n'est chargée.

## Mentions

Projet indépendant, sans lien avec Deezer. Les noms, images et extraits audio appartiennent à Deezer et aux ayants droit. Vérifier les conditions d'utilisation de l'API Deezer avant tout usage au-delà d'une démonstration personnelle.

Licence : à choisir par l'auteur du dépôt.
