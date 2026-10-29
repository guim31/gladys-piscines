# Piscines en temps réel

L'**affluence et l'ouverture des piscines municipales** de villes françaises, lues en direct sur
leurs portails open data : les piscines de l'Eurométropole de Strasbourg et celles de la ville de
Bordeaux. **Sans compte ni clé.**

Intégration non officielle, sans lien avec les villes, les métropoles ni les exploitants des
piscines. Développée sans accès aux équipements : les sources ont été vérifiées en direct le
29/10/2026 (de nuit, piscines fermées), vos retours sont les bienvenus.

## Ce que vous obtenez

- Un **appareil par piscine** que vous ajoutez : ouverte ou fermée, personnes présentes, capacité
  et taux d'occupation, niveau d'affluence, horaires du jour et âge de la donnée (selon la ville).
- Un **widget** « Piscines » : vos piscines sur une ligne chacune, avec l'affluence et l'heure de
  fermeture, en vert, orange ou rouge selon la fréquentation.
- Quatre **déclencheurs de scène** : la piscine ouvre, la piscine ferme, l'affluence passe
  au-dessus d'un seuil, l'affluence redescend sous un seuil.
- Une **action de scène** : l'état de vos piscines en une phrase prête à envoyer.

## Prérequis

- Gladys Assistant **5.3.0** ou plus récent.
- Un accès à Internet depuis Gladys : les données viennent des portails open data des villes.
- Aucun compte, aucune clé d'API.

## Installation

1. Dans Gladys, ouvrez **Intégrations → Installer depuis GitHub**.
2. Collez l'adresse `https://github.com/guim31/gladys-piscines` et validez.
3. Ouvrez l'intégration une fois installée : l'onglet **Configuration** s'affiche.

## Configuration

### Réglages

| Réglage                     | Effet                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------- |
| Villes                      | les villes dont les piscines sont proposées dans l'onglet Découverte               |
| Rafraîchissement            | toutes les 3, 5 (par défaut) ou 10 minutes                                         |
| Langue des noms et messages | langue des noms de fonctionnalités, des textes, du widget et des phrases de scènes |

Les noms des fonctionnalités sont figés à l'ajout de l'appareil : choisissez la langue avant.

### Ajouter des piscines

1. Cochez une ou plusieurs villes, puis enregistrez.
2. Ouvrez l'onglet **Découverte** : les piscines de ces villes y apparaissent, sous la forme
   « Ville · Piscine ».
3. Ajoutez à Gladys celles qui vous intéressent. Leurs valeurs arrivent aussitôt.

Les piscines ajoutées sont les **piscines suivies** : ce sont elles que le widget, les déclencheurs
et l'action de scène proposent. Une piscine ajoutée reste lue même si vous décochez ensuite sa
ville.

### Vérifier

L'action **État** de l'onglet Configuration liste les villes lues, le nombre de piscines trouvées,
l'heure de la dernière lecture, la dernière erreur éventuelle et le nombre de piscines ajoutées.

## Appareils

Chaque piscine ajoutée est un appareil en lecture seule. Ses fonctionnalités dépendent de ce que
publie la ville :

| Fonctionnalité      | Type Gladys     | Valeur                                                | Strasbourg | Bordeaux |
| ------------------- | --------------- | ----------------------------------------------------- | ---------- | -------- |
| Ouverte             | binaire         | 1 ouverte, 0 fermée                                   | oui        | non      |
| Personnes présentes | compteur        | personnes dans la piscine                             | oui        | oui      |
| Capacité            | compteur        | personnes admises en même temps                       | non        | oui      |
| Taux d'occupation   | niveau (%)      | personnes présentes / capacité                        | non        | oui      |
| Affluence           | texte           | fluide, chargée, très chargée, saturée, ou « fermée » | oui        | non      |
| Horaires du jour    | texte           | par exemple « 07:00–14:30, 16:00–20:00 »              | oui        | non      |
| Âge de la donnée    | durée (minutes) | ancienneté du comptage, d'après l'heure de la ville   | oui        | oui      |

**Aucune valeur n'est inventée** : Strasbourg ne publie pas de comptage quand une piscine est
fermée (la nuit notamment). Le nombre de personnes n'est alors pas mis à jour (la dernière valeur reste affichée), et l'**Affluence**
indique « fermée ». L'affluence est le niveau publié par l'exploitant (vert, orange, rouge, noir),
qui tient compte des bassins ouverts.

Bordeaux compte par zone : l'intégration additionne les zones d'une même piscine, sans les gradins
(spectateurs). Bordeaux ne publie ni l'état ouverte/fermée ni les horaires.

Au-delà de **45 minutes** sans mise à jour par la ville, la donnée est considérée **périmée**.

## Widget du tableau de bord

Ajoutez le widget **Piscines** à un tableau de bord. Il affiche une ligne par piscine suivie (dix
au plus), sous le nom que vous lui avez donné dans Gladys, par exemple « 85 pers. · fluide ·
jusqu'à 20:00 », ou « fermée · ouvre à 07:00 ». Dans ses réglages : les piscines affichées (vide :
toutes) et l'affichage des horaires.

Couleurs : le niveau de l'exploitant à Strasbourg (**vert** fluide, **orange** chargée, **rouge**
très chargée ou saturée) ; le taux d'occupation à Bordeaux (**orange** dès 70 %, **rouge** dès
90 %) ; **gris** quand la piscine est fermée, sans comptage ou que la donnée est périmée.

## Déclencheurs de scène

| Déclencheur                    | Se produit quand                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------- |
| La piscine ouvre               | la piscine passe de fermée à ouverte (Strasbourg)                                 |
| La piscine ferme               | la piscine passe d'ouverte à fermée (Strasbourg)                                  |
| Affluence au-dessus d'un seuil | le nombre de personnes dépasse le seuil choisi (20, 50, 100, 150, 200, 300)       |
| Affluence sous un seuil        | le nombre de personnes d'une piscine ouverte redescend au seuil choisi ou dessous |

Le champ **Piscines** filtre les piscines concernées ; vide, n'importe quelle piscine suivie. Les
variables disponibles dans les actions suivantes : piscine, ville, personnes présentes, taux
d'occupation (0 si inconnu).

Les déclencheurs comparent deux lectures successives : rien ne se déclenche au retour d'une panne
du portail, ni sur une donnée périmée. À la réouverture, le comptage repart de zéro. À Bordeaux, qui ne publie pas l'état ouverte/fermée, la chute à 0 de la fermeture ne déclenche pas « Affluence sous un seuil ». Un nombre qui oscille autour d'un seuil déclenche à chaque passage.

## Action de scène

**Obtenir l'affluence des piscines** : vos piscines suivies (ou celles choisies) en une phrase.
Résultats :

- `sentence` : « Piscine du Wacken : 85 personnes (fluide), ouverte jusqu'à 20:00. Piscine de
  Hautepierre : fermée. » ;
- `open_count` : nombre de piscines ouvertes (villes qui publient l'état) ;
- `people` : total des personnes présentes.

La phrase suit la langue choisie dans la configuration.

## Exemples de scènes

- **Avant d'aller nager** : un bouton ou une heure fixe, action « Obtenir l'affluence des
  piscines », puis « Envoyer un message » avec `sentence`.
- **Créneau calme** : déclencheur « Affluence sous un seuil » (votre piscine, seuil 50), puis une
  notification « C'est le moment d'y aller ».
- **Piscine ouverte** : déclencheur « La piscine ouvre » le samedi matin, puis un message.

## Données et rafraîchissement

| Ville      | Portail                                       | Jeu de données                                | Licence         |
| ---------- | --------------------------------------------- | --------------------------------------------- | --------------- |
| Strasbourg | data.strasbourg.eu (Opendatasoft)             | Fréquentation en temps réel des piscines      | Licence Ouverte |
| Bordeaux   | opendata.bordeaux-metropole.fr (Opendatasoft) | Fréquentation temps réel des piscines (ville) | Licence Ouverte |

Une requête par ville et par lecture, quelques kilo-octets. Les villes mettent à jour leurs
données toutes les 5 à 10 minutes ; à 5 minutes, cela fait 288 requêtes par jour et par ville,
bien en dessous des quotas des portails pour un usage anonyme. Seules les villes cochées et celles
des piscines ajoutées sont lues.

## Dépannage

- **Aucune piscine dans Découverte** : vérifiez qu'une ville est cochée et enregistrée, puis
  lancez l'action **État**. Une erreur « HTTP 503 » ou « timeout » vient du portail de la ville :
  réessayez plus tard.
- **« donnée périmée » dans le widget** : la ville ne met plus à jour cette piscine depuis plus de
  45 minutes.
- **Pas de nombre de personnes** : la piscine est fermée, ou la ville ne publie pas de comptage en
  ce moment. Rien n'est inventé.
- **Pas de fonctionnalité « Ouverte » ni d'horaires** : la ville ne les publie pas (Bordeaux).
- Pour plus de détails, passez `LOG_LEVEL=debug` : chaque lecture est alors journalisée.

## Limites

- Seules Strasbourg et Bordeaux publient aujourd'hui l'affluence de leurs piscines en temps réel.
  Nantes, Toulouse, Paris, Rennes ou Montpellier ne publient que des données statiques (adresses,
  équipements) : elles pourront être ajoutées si un flux en direct apparaît.
- Les chiffres sont ceux des exploitants (comptage des entrées et sorties) : ils peuvent différer
  de la réalité, surtout en fin de journée.
- Strasbourg ne donne pas de capacité, donc pas de taux d'occupation.
- Lecture seule : aucune réservation ni paiement.

## Crédits

- Données : Eurométropole de Strasbourg et Bordeaux Métropole, sous Licence Ouverte (Etalab).
- Construite à partir du
  [modèle officiel d'intégration](https://github.com/GladysAssistant/integration-template-js).
