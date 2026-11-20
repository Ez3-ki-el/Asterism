/* Asterism : Langue : dictionnaire anglais, traduction du HTML statique, bascule FR / EN.
   Scripts classiques (pas de modules) charges dans l ordre par index.html : ils partagent la portee globale,
   ce qui permet d ouvrir index.html directement depuis le disque. */
'use strict';

/* ---------- Langue : dictionnaire anglais (les cles sont les textes francais) et bascule FR / EN ---------- */
EN = {
  /* page */
  'Cette page a besoin de JavaScript pour fonctionner.': 'This page needs JavaScript to work.',
  'Asterism : carte des artistes similaires (dig musical)': 'Asterism: map of similar artists (music digging)',
  'Asterism est une carte interactive des artistes similaires. Cherche un artiste, ouvre sa fiche, explore ses voisins et écoute un extrait de 30 secondes : chaque clic dessine un peu plus la constellation. Pour essayer :': 'Asterism is an interactive map of similar artists. Search for an artist, open its card, explore its neighbours and listen to a 30-second preview: each click draws a little more of the constellation. To try:',
  'Surprends-moi': 'Surprise me',
  'Chercher un artiste': 'Search for an artist',
  'Asterism, retour à l\'accueil': 'Asterism, back to home',
  'Langue': 'Language',
  'English': 'Français',
  /* reglages */
  'Réglages': 'Settings', 'Affichage': 'Display', 'Écoute': 'Listening', 'Sources': 'Sources', 'Carte': 'Map',
  'Distance des liens': 'Link distance',
  'Score minimal': 'Minimum score',
  'Score d\'affinité minimal': 'Minimum affinity score',
  'Titres du top': 'Top tracks',
  'Nombre de titres affichés dans le top': 'Number of tracks shown in the top',
  'Petits artistes': 'Small artists',
  'Popularité maximale : estompe les artistes plus écoutés': 'Maximum popularity: fades out artists with more listeners',
  'Écoute au survol': 'Play on hover',
  'Sources étendues': 'Extended sources',
  'expérimental': 'experimental',
  'Artistes similaires (Deezer)': 'Similar artists (Deezer)',
  'Collaboration': 'Collaboration',
  'Même label': 'Same label',
  'Même artiste ou groupe': 'Same artist or band',
  'Confirmé par plusieurs sources': 'Confirmed by several sources',
  'Décocher un type masque ses liens, et les scores se recalculent avec les types cochés.': 'Unchecking a type hides its links, and scores are recalculated with the checked types.',
  'Annuler': 'Undo', 'Rétablir': 'Redo', 'Recentrer': 'Re-center', 'Tout effacer': 'Clear all',
  'Copier le lien': 'Copy link', 'Image PNG': 'PNG image',
  'Mode sombre': 'Dark mode', 'Mode clair': 'Light mode',
  'Tout': 'All', '1 saut': '1 hop', '2 sauts': '2 hops', '3 sauts': '3 hops',
  '{n} masqués': '{n} hidden', '{n} masqué': '{n} hidden',
  /* fiche */
  'Fermer': 'Close', 'Réduire ou agrandir la fiche': 'Collapse or expand the card',
  'Le score combine les preuves de chaque source (Deezer, ListenBrainz, collaboration, label, projets) : plus elles concordent, plus il monte. Un lien porté par une seule source reste modeste.': 'The score combines the evidence from each source (Deezer, ListenBrainz, collaboration, label, projects): the more they agree, the higher it climbs. A link backed by a single source stays modest.',
  '{n} fans': '{n} fans', '{n} liens': '{n} links', '{n} lien': '{n} link',
  '{vc} liens affichés sur {n}': '{vc} of {n} links shown',
  'Chargement': 'Loading', 'Exploré': 'Explored', 'Explorer': 'Explore', 'Écouter': 'Listen',
  'Reprendre': 'Resume', 'Pause': 'Pause', 'Lire': 'Play',
  'Masquer': 'Hide', 'Masquer le top': 'Hide top', 'Top {n}': 'Top {n}', 'Top {n} titres': 'Top {n} tracks',
  'Deezer ne propose aucun artiste lié.': 'Deezer has no related artist.',
  'Deezer ne propose que {n} artistes liés.': 'Deezer only lists {n} related artists.',
  'Deezer ne propose que {n} artiste lié.': 'Deezer only lists {n} related artist.',
  'Extraits : Apple (absents chez Deezer).': 'Previews: Apple (none on Deezer).',
  'Aucun extrait disponible': 'No preview available',
  'repli Apple : {m}': 'Apple fallback: {m}',
  'aucun titre au nom exact chez Apple': 'no track under the exact name at Apple',
  'injoignable ({m})': 'unreachable ({m})',
  'erreur réseau': 'network error', 'delai depasse': 'timed out', 'reseau': 'network error',
  'Les sources étendues (expérimental) peuvent en trouver d’autres. ': 'Extended sources (experimental) may find more. ',
  'Essayer': 'Try',
  'Lecture bloquée par le navigateur': 'Playback blocked by the browser',
  '{label} : fiche de l’artiste (lien direct)': '{label}: artist page (direct link)',
  '{label} : rechercher {name} (un homonyme peut apparaître)': '{label}: search for {name} (a namesake may show up)',
  'Liens et compatibilité ({n})': 'Links and compatibility ({n})',
  '+ {n} autres liens moins compatibles': '+ {n} other less compatible links',
  /* score */
  'Rang {n} sur 20': 'Rank {n} of 20', 'Lien réciproque': 'Reciprocal link',
  '{n} % du meilleur voisin': '{n} % of the best neighbour', 'Rang {n} chez ListenBrainz': 'Rank {n} at ListenBrainz',
  '{n} titres en commun': '{n} shared tracks', '{n} titre en commun': '{n} shared track',
  'Label : {names}': 'Label: {names}', 'Genres comparables à {n} %': 'Genres {n} % comparable',
  'Même style (MusicBrainz)': 'Same style (MusicBrainz)',
  'Même artiste ou groupe (MusicBrainz)': 'Same artist or band (MusicBrainz)',
  '{s} est membre de {o}': '{s} is a member of {o}', '{s} est un sous-groupe de {o}': '{s} is a subgroup of {o}',
  '{s} a fondé {o}': '{s} founded {o}', '{s} et {o} : même personne': '{s} and {o}: same person',
  '{s} et {o} : collaboration': '{s} and {o}: collaboration', '{a} et {b} : {n} %': '{a} and {b}: {n} %',
  /* sources etendues */
  'Sources étendues en cours : les nouveaux artistes arrivent ensemble.': 'Extended sources running: new artists will appear together.',
  'Sources étendues : {done} sur {total} terminées ({name}), les nouveaux artistes apparaissent ensemble…': 'Extended sources: {done} of {total} done ({name}), new artists will appear together…',
  'Sources étendues : recherche en cours (collaborations, labels, ListenBrainz, MusicBrainz), les nouveaux artistes apparaissent ensemble…': 'Extended sources: searching (collaborations, labels, ListenBrainz, MusicBrainz), new artists will appear together…',
  'Sources étendues : {n} liens ajoutés': 'Extended sources: {n} links added',
  'Sources étendues : {n} lien ajouté': 'Extended sources: {n} link added',
  'Sources étendues : aucun lien ajouté': 'Extended sources: no link added',
  'Collaborations': 'Collaborations', 'Labels': 'Labels', 'Projets (MusicBrainz)': 'Projects (MusicBrainz)',
  'indisponibles': 'unavailable', 'indisponible': 'unavailable',
  '{n} écartés (genre différent ou sans photo)': '{n} discarded (different genre or no photo)',
  '{n} retrouvés par le style MusicBrainz': '{n} recovered through MusicBrainz style',
  'style MusicBrainz indisponible, réessaie plus tard': 'MusicBrainz style unavailable, try again later',
  'artiste absent de MusicBrainz': 'artist not in MusicBrainz', 'aucun voisin': 'no neighbours',
  'aucune relation enregistrée': 'no relation on record', 'relations sans équivalent Deezer': 'relations with no Deezer match',
  'Confirmés par plusieurs sources': 'Confirmed by several sources',
  'collaborations': 'collaborations', 'labels': 'labels',
  /* menu, statuts, partage */
  'Nœud supprimé': 'Node removed', '{n} nœuds supprimés': '{n} nodes removed',
  'Focus sur ce nœud': 'Focus on this node', 'Quitter le focus': 'Exit focus',
  'Épingler': 'Pin', 'Libérer': 'Unpin', 'Enrichir (sources étendues)': 'Enrich (extended sources)',
  'Élaguer les feuilles ({n})': 'Prune leaves ({n})', 'Supprimer le nœud': 'Delete node',
  'Clique sur un nœud pour choisir le centre du focus': 'Click a node to choose the focus centre',
  'Carte effacée': 'Map cleared', 'Recherche d’un artiste…': 'Looking for an artist…',
  'aucun artiste trouvé, réessaie': 'no artist found, try again',
  'Aucun artiste lié pour {name}': 'No related artist for {name}',
  'Aucun artiste trouvé pour {name}': 'No artist found for {name}',
  'Erreur Deezer : {m}': 'Deezer error: {m}',
  '{n} artistes, {k} liens': '{n} artists, {k} links',
  'Carte partagée chargée : {n} artistes': 'Shared map loaded: {n} artists',
  'Lien de partage illisible': 'Share link unreadable',
  'Rien à partager : la carte est vide': 'Nothing to share: the map is empty',
  'Carte trop grande pour un lien : utilise l’image PNG': 'Map too large for a link: use the PNG image',
  'Lien copié : {n} artistes, {k} liens': 'Link copied: {n} artists, {k} links',
  'Copie ce lien :': 'Copy this link:', 'Partage impossible : {m}': 'Sharing failed: {m}',
  'Rien à exporter : la carte est vide': 'Nothing to export: the map is empty',
  'Export impossible': 'Export failed', 'Image enregistrée': 'Image saved',
  'Export impossible : images protégées par le navigateur': 'Export failed: images protected by the browser',
  'Zoom avant': 'Zoom in', 'Zoom arrière': 'Zoom out', 'Aide': 'Help', 'Comment ça marche': 'How it works',
  'Souris ou doigt': 'Mouse or touch', 'Clavier': 'Keyboard', 'Clic': 'Click',
  'Ouvre la fiche de l’artiste': 'Opens the artist card', 'Double-clic': 'Double-click',
  'Affiche ses voisins (bouton « Explorer »)': 'Shows its neighbours ("Explore" button)',
  'Clic droit, appui long': 'Right-click, long press', 'Menu : épingler, focus, supprimer…': 'Menu: pin, focus, delete…',
  'Glisser un artiste': 'Drag an artist', 'Le déplace': 'Moves it',
  'Glisser le fond, molette, pincement': 'Drag the background, wheel, pinch', 'Déplace et zoome la carte': 'Pans and zooms the map',
  'Survol d’un lien': 'Hover a link', 'Score de compatibilité': 'Compatibility score',
  'Flèches': 'Arrow keys', 'Passer à l’artiste voisin dans cette direction': 'Jump to the nearest artist in that direction',
  'Entrée': 'Enter', 'Explorer l’artiste sélectionné': 'Explore the selected artist', 'Échap': 'Esc',
  'Fermer la fiche ou l’aide': 'Close the card or this help', 'Suppr': 'Del', 'Supprimer l’artiste sélectionné': 'Delete the selected artist',
  'Zoomer, dézoomer': 'Zoom in, zoom out', 'Annuler, rétablir': 'Undo, redo', 'Afficher cette aide': 'Show this help',
  'Touche deux fois un artiste pour voir ses voisins. Appui long : menu.': 'Double-tap an artist to see its neighbours. Long press: menu.',
  'Double-clique un artiste pour voir ses voisins. « ? » ouvre l’aide.': 'Double-click an artist to see its neighbours. "?" opens help.',
  'Recherche étendue : {name}': 'Extended search: {name}', 'en cours': 'running', 'terminé': 'done', '+ {n} autres': '+ {n} more',
  'Les nouveaux artistes apparaîtront tous ensemble à la fin.': 'New artists will all appear together at the end.',
  'En écoute': 'Now playing', 'En pause': 'Paused', 'Lecteur': 'Player', 'Ouvrir la fiche': 'Open the card',
  'Mes écoutes': 'My listening', 'Aimés': 'Liked', 'Écoutés': 'Listened',
  'Mettre en avant mes écoutes': 'Highlight my listening', 'Aucun artiste de cette catégorie sur la carte': 'No artist of this category on the map', 'Aucun artiste dans cette catégorie.': 'No artist in this category.',
  'Aucun artiste marqué. Dans la fiche d’un artiste, choisis « À écouter », « Aimé » ou « Écouté ».': 'No artist marked yet. On an artist card, choose "To listen", "Liked" or "Listened".',
  'Ouvrir {name} sur la carte': 'Open {name} on the map', 'Retirer de la liste': 'Remove from the list',
  'Gardé dans ce navigateur uniquement.': 'Kept in this browser only.', 'Exporter en texte': 'Export as text', 'À écouter': 'To listen', 'Aimé': 'Liked', 'Écouté': 'Listened',
  'Exporter mes écoutes': 'Export my listening', 'Aucune écoute marquée pour l’instant': 'Nothing marked yet',
  '{n} artistes exportés': '{n} artists exported',
  'Écouter ses voisins': 'Play its neighbours', 'Écoute de la carte': 'Map listening',
  'Écoute de la carte : {name}': 'Map listening: {name}', 'Écoute de la carte terminée': 'Map listening finished',
  'Aucun voisin à écouter': 'No neighbour to play', 'Précédent': 'Previous', 'Suivant': 'Next', 'Arrêter': 'Stop',
  'Discographie': 'Discography',
  'Afficher les {n} autres sorties': 'Show the {n} other releases',
  '+ {n} sorties d’un autre genre (homonyme ou featuring possible)': '+ {n} releases in another genre (namesake or featuring likely)',
  'Autre genre, homonyme ou featuring possible :': 'Another genre, namesake or featuring likely:', 'Discographie ({n})': 'Discography ({n})', 'Aucun album chez Deezer': 'No album on Deezer',
  'Aucun extrait pour cet album': 'No preview for this album', 'Album': 'Album', 'EP': 'EP', 'Single': 'Single', 'Compilation': 'Compilation',
  'Identité et liens (Wikidata)': 'Identity and links (Wikidata)',
  'Genres': 'Genres', 'Pays': 'Country', 'Naissance': 'Born', 'Formé en': 'Formed in', 'Décès': 'Died',
  'Site officiel': 'Official website', 'Wikipédia': 'Wikipedia',
  '{label} : fiche de l’artiste (lien exact)': '{label}: artist page (exact link)'
};

/* Traduit le texte et les attributs du HTML statique ; l'original francais est memorise sur chaque noeud pour revenir en arriere.
   Les zones reconstruites par le code (fiche, statut, menu, infobulle, resultats, valeurs des curseurs) sont traitees a part. */
var I18N_SKIP = '#card, #player, #status, #ltip, #menu, #results, .v, #theme, #theme2, #lang, #lang2, script, style, noscript, svg';
function trKey(t) { return t.replace(/\s+/g, ' ').trim(); }
function trDom(root) {
  var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [], nd;
  while ((nd = w.nextNode())) list.push(nd);
  list.forEach(function (t) {
    if (t.parentElement && t.parentElement.closest(I18N_SKIP)) return;
    if (t._fr === undefined) {
      if (!/[A-Za-zÀ-ÿ]/.test(t.nodeValue)) return;
      t._fr = t.nodeValue;
    }
    var lead = /^\s*/.exec(t._fr)[0], trail = /\s*$/.exec(t._fr)[0];
    t.nodeValue = lead + T(trKey(t._fr)) + trail;
  });
  root.querySelectorAll('[aria-label],[placeholder],[title],[alt]').forEach(function (e) {
    if (e.closest(I18N_SKIP)) return;
    e._fra = e._fra || {};
    ['aria-label', 'placeholder', 'title', 'alt'].forEach(function (a) {
      if (!e.hasAttribute(a)) return;
      if (e._fra[a] === undefined) e._fra[a] = e.getAttribute(a);
      e.setAttribute(a, T(trKey(e._fra[a])));
    });
  });
}
function langLabel() {
  document.querySelectorAll('#lang span').forEach(function (sp) { sp.classList.toggle('on', sp.getAttribute('data-l') === LANG); });
  el('lang').setAttribute('aria-label', T('Langue'));
  el('lang').setAttribute('title', T('Langue'));
  el('lang2').textContent = LANG === 'fr' ? 'English' : 'Français';
}
var CARD_NOTE_FR = 'Le score combine les preuves de chaque source (Deezer, ListenBrainz, collaboration, label, projets) : plus elles concordent, plus il monte. Un lien porté par une seule source reste modeste.';
function applyLang() {
  document.documentElement.lang = LANG;
  document.title = T('Asterism : carte des artistes similaires (dig musical)');
  trDom(document.body);
  el('cclose').setAttribute('aria-label', T('Fermer'));
  el('cmin').setAttribute('aria-label', T('Réduire ou agrandir la fiche'));
  el('clinks').querySelector('.lknote').textContent = T(CARD_NOTE_FR);
  el('focusv').textContent = T(FOCUS_LABELS[focusDepth]);
  themeLabel(); langLabel();
  refresh(); renderCard(); updateFanLabel(); renderProg(); renderMyList();
}
function setLang(l) {
  LANG = l;
  hideNodeTip();
  try { localStorage.setItem('mg-lang', l); } catch (e) { dbg('ignore', e); }
  applyLang();
}
el('lang').addEventListener('click', function () { setLang(LANG === 'fr' ? 'en' : 'fr'); });
el('lang2').addEventListener('click', function () { setLang(LANG === 'fr' ? 'en' : 'fr'); });
