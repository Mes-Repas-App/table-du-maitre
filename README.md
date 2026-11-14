# Table du Maître · D&D 5e

Application web de suivi de campagne D&D 5e : création de personnages, PNJ et monstres, et gestion complète des combats sur carte.

## Lancer le projet

Prérequis : [Node.js](https://nodejs.org) 18 ou plus récent.

```bash
npm install
npm run dev
```

Puis ouvrez l'adresse affichée (généralement http://localhost:5173).

Pour produire une version optimisée déployable sur n'importe quel hébergement statique :

```bash
npm run build
```

Le résultat se trouve dans `dist/`.

## Fonctionnalités

### Personnages, PNJ et monstres
- Fiche complète modifiable : nom, race, classe (ou FP pour les monstres), historique, niveau, les 6 caractéristiques avec modificateurs calculés, PV / PV max / PV temporaires, CA, vitesse, initiative, attaques et notes.
- Bonus de maîtrise calculé (niveau ou FP), jets de sauvegarde et 18 compétences (clic : maîtrise, puis expertise), perception passive.
- Ressources limitées (emplacements de sorts, Ki, Rage…) récupérées au repos court ou long.
- Image personnalisée par clic sur le portrait (redimensionnée et compressée automatiquement).
- 19 états (charmé, paralysé, empoisonné…) + épuisement à 6 niveaux + états personnalisés. **La règle complète, dans l'édition choisie, s'affiche au survol (ou au toucher / focus clavier) de chaque état.**
- Dégâts / soins rapides, PV temporaires (absorbés en premier, non cumulables), rappel du JS de concentration (DD plafonné à 30 en 2024), jets contre la mort à 0 PV, purge des états, duplication d'entité.
- **Dés de vie** (déduits de la classe ou choisis) à dépenser pendant un repos court ; repos long : PV, ressources, emplacements de sorts et dés de vie (tous en 2024, la moitié en 2014).
- Recherche (sans tenir compte des accents) et tri des listes.
- Onglet **Sorts** : caractéristique d'incantation (DD et bonus d'attaque calculés), emplacements par niveau, liste de sorts. « Lancer » consomme le plus petit emplacement disponible (ou un niveau supérieur au choix) et active la concentration si besoin.
- Onglet **Inventaire** : bourse (pc, pa, pe, po, pp) avec total en or, objets avec quantité, objets magiques et harmonisation limitée à 3.
- Onglet **Profil & relations** : XP, langues, sens, résistances, immunités, vulnérabilités ; relations avec les autres fiches (allié, rival, famille…) et ce que les autres en pensent. Inspiration (étoile) dans l'en-tête de la fiche des PJ.
- **Bestiaire SRD** (onglet Monstres) : recherche en ligne des monstres du SRD 5.2 (règles 2024) ou 5.1 (règles 2014) selon la campagne (noms anglais, via Open5e), ou import d'un fichier JSON ; la fiche est remplie automatiquement, attaques comprises.

### Sessions et monde
- **Sessions**, en trois onglets :
  - **Préparation** : scènes, secrets et indices, PNJ et lieux à jouer (reliés aux vraies fiches et lieux), à cocher au fil de la partie ; « en scène » transforme un élément en scène du déroulé ; les éléments non joués se reportent dans une nouvelle session.
  - **Déroulé** : la session racontée scène par scène — type (scène, combat, dialogue, découverte, voyage, note), récit détaillé, **images** (agrandissables et montrables aux joueurs), **liens** vers personnages, PNJ, monstres, lieux et quêtes ; scènes réordonnables et repliables.
  - **Bilan** : résumé (repris en « Précédemment… » à la session suivante), personnages présents, tout ce qui a été croisé, XP à partager, trésor, pistes pour la suite.
  - Date réelle et date dans le monde du jeu. Chaque fiche, lieu et quête liste les sessions où il apparaît.
- **Monde** : quêtes (statut, lieu, commanditaire, récompense, objectifs à cocher), lieux imbriqués (région → ville → taverne) avec type et icône, fil d'Ariane, occupants (PNJ, monstres, personnages) et quêtes du lieu, et documents (lettres, cartes, portraits). Bouton « Montrer aux joueurs » pour les afficher sur l'écran joueurs : le MJ garde un **écran de projection** avec les commandes (pivoter, dessiner en couleur au doigt ou à la souris, effacer), et les joueurs voient le résultat en direct, sans les boutons.
- **Noms** : le nom d'un élément (fiche, lieu, quête, session, rencontre) est souligné en pointillés avec un crayon ; pour un élément neuf, il est déjà sélectionné : il suffit de taper.
- **Recherche globale** dans toute la campagne (fiches, objets, sorts, sessions, monde, combats).

### Combats
- Création de rencontres avec carte importée (n'importe quelle image) et grille à cases carrées réglable ; les pions suivent la taille des cases (P, M, G = 2×2, TG = 3×3…).
- Plusieurs pions d'un même monstre ou PNJ (« Gobelin 2 », « Gobelin 3 »…) : **chaque pion a ses propres PV et états**, la fiche sert de modèle. Les PJ, eux, partagent PV et états avec leur fiche.
- Clic sur un pion → panneau contextuel : dégâts / soins en un clic, états, ressources, initiative, taille, « caché aux joueurs », accès à la fiche.
- Tracker d'initiative : lancement automatique pour les monstres et PNJ (les PJ gardent l'initiative saisie), égalités départagées par la DEX, tours et rounds. Touche **N** = tour suivant, **Échap** = fermer.
- **Effets à durée limitée** (Bénédiction 10 rounds, Hâte…) : décomptés au début du tour du combattant choisi (par défaut celui qui joue, souvent le lanceur) ; à 0, l'effet disparaît et l'état associé (ex. « Ralenti ») est retiré.
- **Difficulté de la rencontre** (Guide du maître 2024) : XP des adversaires comparés au budget du groupe (faible, modérée, élevée), mise à jour pendant que vous ajoutez des monstres.
- **Attaques cliquables** : une ligne « Épée longue : +5, 1d8+3 » donne un bouton de jet d'attaque et un de dégâts ; un 20 naturel double les dés des dégâts suivants.
- **Outils de carte** : règle de mesure (en cases et en mètres), gabarits sphère et cône à la taille voulue, avec le nombre de pions touchés.
- **Dégâts de zone** : un jet de dégâts, un JS par cible (moitié si réussi), multiplicateur ajustable (résistance, vulnérabilité) ; lancé depuis un gabarit, les cibles sont déjà cochées.
- **Brouillard de guerre** : se révèle ou se remet au pinceau ; translucide pour le MJ, opaque pour les joueurs, qui ne voient pas les pions cachés dessous.
- **Écran joueurs** : bouton qui ouvre une seconde fenêtre (à placer sur un écran ou une TV) affichant la carte, les gabarits, l'ordre d'initiative et les pions visibles, sans les PV des monstres, ainsi que les documents montrés par le MJ.
- Journal horodaté de la rencontre ; lanceur de dés (d4 → d100, formules comme `2d6+3`, avantage / désavantage) dont les résultats s'ajoutent au journal du combat ouvert.

### Campagnes et sauvegarde
- Plusieurs campagnes séparées : le menu à côté du titre permet d'en créer, d'en changer, de les renommer ou de les supprimer.
- **Règles 2024 par défaut** (Manuel des joueurs 2024) ; une campagne peut passer aux règles 2014 depuis ce même menu. Cela change les textes des états, l'épuisement, le JS de concentration, les dés de vie au repos long et le bestiaire.
- **Annuler** (bouton ↶ ou Ctrl+Z) : revient sur les 50 dernières modifications ; les gestes rapprochés (glisser un pion, taper un nom) comptent pour une seule étape.
- Sauvegarde automatique dans le navigateur (IndexedDB : plusieurs centaines de Mo, cartes et portraits compris). Une ancienne sauvegarde est reprise automatiquement. En cas d'échec, un bandeau rouge propose d'exporter.
- Bouton **Sauvegarder** (ou Ctrl+S) : enregistre tout de suite, dans le navigateur et dans le dossier de sauvegarde s'il y en a un ; une fenêtre confirme où la campagne a été enregistrée.
- Export / import en fichier JSON (boutons dans l'en-tête) pour changer de machine ou faire des sauvegardes. Un fichier importé devient une **nouvelle campagne** (rien n'est écrasé) ; les anciens fichiers sont acceptés.
- **Copies de secours automatiques** : au plus une par heure, les 10 dernières gardées par campagne (menu de campagne → « Copies de secours… »). Un bandeau rappelle d'exporter si le dernier export date de plus d'une semaine (sauf si un dossier de sauvegarde est actif).
- **Dossier de sauvegarde** (bouton dossier dans l'en-tête) : vos campagnes enregistrées en fichiers dans le dossier de votre choix. Voir ci-dessous.

### Hors ligne
- Une fois l'appli ouverte une première fois avec une connexion, elle et ses polices fonctionnent sans Internet. Elle peut aussi être installée comme une application (menu du navigateur → « Installer » ou « Ajouter à l'écran d'accueil »).
- Connecté, la page est toujours chargée à jour. En développement (`npm run dev`), le mode hors ligne est désactivé.

## Dossier de sauvegarde

Bouton **dossier** dans l'en-tête → **Choisir un dossier…** : chaque campagne y est enregistrée dans son propre fichier JSON (nommé d'après la campagne), mis à jour 2 secondes après chaque modification. Ces fichiers s'importent aussi avec le bouton **Importer**.

- **Rien n'est jamais écrasé** : l'appli n'écrit que dans ses propres fichiers (reconnus par un identifiant propre à ce navigateur). Un fichier d'un autre appareil, ou un export manuel, est seulement lu.
- **Si le dossier contient déjà des sauvegardes** au moment où vous le choisissez, l'appli les liste. Pour une campagne qui existe déjà ici, vous choisissez entre **la mettre à jour** et l'ajouter comme nouvelle campagne ; les autres deviennent de **nouvelles campagnes** (suffixe « (importée) » si le nom existe déjà). Vous pouvez aussi ne rien importer.
- **Plusieurs appareils** (ordinateur et téléphone sur le même dossier Drive, par exemple) : chaque campagne porte un identifiant commun qui la suit d'un appareil à l'autre. À l'ouverture de l'appli et au retour sur l'onglet, si un autre appareil a enregistré une version **plus récente** d'une de vos campagnes, l'appli propose de la **mettre à jour**. La version remplacée part dans les copies de secours, et Ctrl+Z annule la mise à jour de la campagne ouverte. Une campagne qui porte seulement le même nom (deux « Ma campagne » différentes, par exemple) n'est jamais remplacée d'office : elle est proposée en nouvelle campagne, avec la mise à jour en option.
- **Importer** (fichier JSON) : si la campagne existe déjà ici, l'appli propose de la mettre à jour au lieu d'en créer une copie.
- **Supprimer une campagne** retire aussi son fichier du dossier (jamais ceux des autres appareils).
- **Chercher des sauvegardes à importer** (même menu) relance cette recherche à tout moment, par exemple après avoir copié dans le dossier une sauvegarde d'un autre appareil. Une sauvegarde déjà importée n'est reproposée que si le fichier a changé depuis.
- Astuce : choisissez un dossier synchronisé (Google Drive pour ordinateur : « Mon Drive » sur le lecteur G:, OneDrive, Dropbox…) pour avoir aussi une copie en ligne.
- **Navigateurs** : possible avec **Chrome** ou **Edge** (et Chrome sur Android). Firefox et Safari ne permettent pas de choisir un dossier : utilisez alors **Exporter** / **Importer**.
- Après un redémarrage du navigateur, celui-ci peut redemander l'autorisation d'accès au dossier : un bandeau propose **Autoriser**, en un clic.

## Tests

```bash
npm test
```

Vérifie les règles centrales (PV, tours d'initiative, formules de dés, effets à durée, difficulté des rencontres, import des anciens formats) et le dossier de sauvegarde (aucun fichier d'un autre appareil n'est jamais écrasé).

## Structure du projet

```
table-du-maitre/
├── index.html
├── vite.config.js
├── package.json
├── public/                       # Icône, manifeste et service worker (hors ligne)
└── src/
    ├── main.jsx                  # Point d'entrée React
    ├── App.jsx                   # Onglets, en-tête, orchestration
    ├── index.css                 # Thème (variables CSS) + Tailwind
    ├── data/
    │   ├── reference.js          # États 5e, races, classes, compétences  ← ajoutez ici vos races maison
    │   └── srd.js                # Conversion des monstres du SRD 5.1 (Open5e)
    ├── utils/
    │   └── helpers.js            # Règles (PV, tours, dés), import, images
    ├── hooks/
    │   └── useCampaign.js        # Campagnes, annulation, IndexedDB, export/import JSON
    └── components/
        ├── ui/                   # Briques réutilisables (info-bulle, portrait, barre de PV…)
        ├── campaign/             # Sessions, Monde, recherche globale, copies de secours
        ├── entities/             # Fiches, sorts, inventaire, relations, bestiaire SRD
        └── combat/               # Combats, carte, attaques, dégâts de zone, écran joueurs
```

## Personnaliser vos races et historiques

Ouvrez `src/data/reference.js` et complétez les tableaux `RACES`, `CLASSES` et `BACKGROUNDS`. Ce sont des listes de suggestions : la saisie reste libre dans les fiches, vous pouvez donc aussi taper n'importe quelle valeur directement.

Pour ajouter un état permanent à la liste (ex. un effet récurrent de votre campagne), ajoutez une entrée au tableau `CONDITIONS` avec `id`, `label`, `icon` et `desc` (la description affichée au survol).

## Pile technique

- [React 18](https://react.dev) + [Vite](https://vite.dev)
- [Tailwind CSS 4](https://tailwindcss.com) pour les utilitaires de mise en page
- [lucide-react](https://lucide.dev) pour les icônes
- Aucune base de données ni serveur : tout fonctionne dans le navigateur.
