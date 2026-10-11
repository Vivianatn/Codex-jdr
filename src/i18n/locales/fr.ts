/**
 * French UI strings — the reference locale. Every other locale must provide
 * the same shape (enforced by the `Messages` type).
 * Parametric strings are functions so their arguments are type-checked.
 */
export const fr = {
  app: {
    name: 'Codex',
    tagline: 'Le compagnon du Maître du Jeu',
    skipToContent: 'Aller au contenu',
  },
  common: {
    cancel: 'Annuler',
    confirm: 'Confirmer',
    create: 'Créer',
    save: 'Enregistrer',
    delete: 'Supprimer',
    rename: 'Renommer',
    open: 'Ouvrir',
    close: 'Fermer',
    back: 'Retour',
    moreActions: 'Plus d’actions',
    comingSoon: 'Bientôt disponible',
    name: 'Nom',
    description: 'Description',
    optional: 'facultatif',
  },
  modes: {
    label: 'Mode',
    prep: 'Préparation',
    play: 'En jeu',
  },
  nav: {
    campaigns: 'Campagnes',
    backToCampaigns: 'Retour aux campagnes',
    prepSections: 'Sections de préparation',
    dashboard: 'Tableau de bord',
    players: 'Joueurs',
    bestiary: 'Bestiaire',
    allies: 'Alliés et familiers',
    items: 'Objets',
    maps: 'Cartes',
    sessions: 'Sessions',
    quests: 'Quêtes',
    notes: 'Notes',
  },
  campaigns: {
    title: 'Tes campagnes',
    subtitle: 'Choisis une campagne à préparer ou à mener.',
    new: 'Nouvelle campagne',
    import: 'Importer',
    importHint: 'Importer une campagne depuis un fichier JSON',
    export: 'Exporter',
    emptyTitle: 'Aucune campagne pour l’instant',
    emptyBody:
      'Crée ta première campagne pour commencer, ou importe un fichier exporté depuis Codex.',
    namePlaceholder: 'La Crypte des Murmures',
    descriptionPlaceholder: 'Une phrase pour te rappeler de quoi parle cette campagne.',
    createDialogTitle: 'Nouvelle campagne',
    createDialogBody: 'Tu pourras tout modifier plus tard.',
    renameDialogTitle: 'Renommer la campagne',
    deleteDialogTitle: 'Supprimer la campagne ?',
    deleteDialogBody: (name: string) =>
      `« ${name} » et tout son contenu seront supprimés de cet appareil. Pense à l’exporter avant si tu veux la garder.`,
    lastOpened: (when: string) => `Ouverte ${when}`,
    neverOpened: 'Jamais ouverte',
    created: (name: string) => `Campagne « ${name} » créée`,
    renamed: 'Campagne renommée',
    deleted: (name: string) => `Campagne « ${name} » supprimée`,
    exported: 'Campagne exportée',
    imported: (name: string) => `Campagne « ${name} » importée`,
    importedAsCopy: (name: string) =>
      `Une campagne avec le même identifiant existe déjà : importée comme « ${name} »`,
    copySuffix: '(copie)',
    notFoundTitle: 'Campagne introuvable',
    notFoundBody: 'Elle a peut-être été supprimée. Retourne à la liste des campagnes.',
    nameRequired: 'Donne un nom à ta campagne.',
  },
  importErrors: {
    invalidJson: 'Ce fichier n’est pas un JSON valide.',
    wrongFormat: 'Ce fichier n’est pas une campagne Codex.',
    unsupportedVersion: (version: number) =>
      `Ce fichier vient d’une version de Codex plus récente (format ${version}). Mets Codex à jour pour l’importer.`,
    invalidCampaign: 'Les données de la campagne sont incomplètes ou corrompues.',
  },
  dashboard: {
    title: 'Tableau de bord',
    subtitle: 'Vue d’ensemble de la campagne.',
    nextStepsTitle: 'Pour bien commencer',
    nextSteps: [
      'Crée les fiches de tes joueurs avec l’assistant de première session.',
      'Remplis ton bestiaire avec quelques modèles d’ennemis.',
      'Prépare la carte de ta première séance.',
    ],
    playCta: 'Passer en jeu',
  },
  sections: {
    players: {
      emptyTitle: 'Aucun joueur',
      emptyBody:
        'L’assistant de création de personnage arrive bientôt : jets de caractéristiques animés, PV, compétences et export Discord.',
    },
    bestiary: {
      emptyTitle: 'Bestiaire vide',
      emptyBody:
        'Tu pourras y créer des modèles d’ennemis et les dupliquer en plusieurs exemplaires numérotés.',
    },
    allies: {
      emptyTitle: 'Aucun allié ni familier',
      emptyBody:
        'Les PNJ alliés et les familiers, avec leurs jauges de disposition et de loyauté, vivront ici.',
    },
    items: {
      emptyTitle: 'Aucun objet',
      emptyBody: 'Ta bibliothèque d’objets réutilisables : armes, armures, potions, trésors.',
    },
    maps: {
      emptyTitle: 'Aucune carte',
      emptyBody:
        'L’éditeur de plateau (grille, calques, brouillard, objets interactifs) arrive dans une prochaine phase.',
    },
    sessions: {
      emptyTitle: 'Aucune session',
      emptyBody: 'Chaque séance aura son journal automatique et un résumé exportable pour Discord.',
    },
    quests: {
      emptyTitle: 'Aucune quête',
      emptyBody: 'Suis les quêtes du groupe : statut, objectifs à cocher et récompenses.',
    },
    notes: {
      emptyTitle: 'Aucune note',
      emptyBody: 'Des notes de campagne liées entre elles avec [[nom]], et faciles à retrouver.',
    },
  },
  play: {
    mapRegion: 'Plateau de jeu',
    noMapTitle: 'Aucune carte en jeu',
    noMapBody: 'Prépare une carte dans Préparation › Cartes pour la retrouver ici.',
    goToMaps: 'Aller aux cartes',
    quickAccess: 'Accès rapide',
    party: 'Groupe',
    partyEmpty: 'Aucun joueur dans le groupe.',
    enemies: 'Ennemis présents',
    enemiesEmpty: 'Aucun ennemi. Ajoute-en depuis le bestiaire.',
    favorites: 'Favoris',
    favoritesEmpty: 'Épingle ici ce que tu utilises souvent.',
  },
  settings: {
    title: 'Paramètres',
    description: 'Ces réglages s’appliquent à cet appareil.',
    open: 'Ouvrir les paramètres',
    theme: 'Thème',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    themeSystem: 'Système',
    toggleTheme: 'Changer de thème',
    animations: 'Animations',
    animationsFull: 'Complètes',
    animationsReduced: 'Réduites',
    animationsOff: 'Désactivées',
    animationsHint: 'Le réglage « réduire les animations » de ton système est toujours respecté.',
    language: 'Langue',
    languageFrench: 'Français',
  },
  time: {
    justNow: 'à l’instant',
  },
  errors: {
    generic: 'Une erreur est survenue.',
  },
}

type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : T extends (...args: infer A) => string
      ? (...args: A) => string
      : { readonly [K in keyof T]: Widen<T[K]> }

export type Messages = Widen<typeof fr>
