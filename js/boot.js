/* Asterism : Demarrage : taille du canevas, langue, carte partagee ou artiste de l adresse.
   Scripts classiques (pas de modules) charges dans l ordre par index.html : ils partagent la portee globale,
   ce qui permet d ouvrir index.html directement depuis le disque. */
'use strict';

resize();
applyLang();
if (/^#s=[uz]\./.test(location.hash)) loadShared(location.hash.slice(3));
else if (location.hash.length > 1) searchAndAdd(decodeURIComponent(location.hash.slice(1)));
