// Carte des fresques et lieux patrimoniaux - CCPA
// Réalisé avec Leaflet (https://leafletjs.com/) et Leaflet.markercluster
// (https://github.com/Leaflet/Leaflet.markercluster)

// Token Mapbox pour le fond de carte (créé sur mapbox.com)
var MAPBOX_TOKEN = "pk.eyJ1IjoiY3VsdHVyZWNjcGEiLCJhIjoiY21yc2lyN3NlMGkzZTJ4c2dwMWFvMDc2MCJ9.XqIK_WhCEds_ZhMw1pfoiQ";

// Création de la carte centrée sur le territoire de la CCPA
var carte = L.map('map', { zoomControl: true }).setView([45.89, 5.29], 11);

// Ajout du fond de carte (tuiles Mapbox)
L.tileLayer(
  'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=' + MAPBOX_TOKEN,
  {
    tileSize: 512,
    zoomOffset: -1,
    maxZoom: 19,
    attribution: '© Mapbox © OpenStreetMap'
  }
).addTo(carte);

// Cluster qui permet de rassembler les points proches
var groupeMarqueurs = L.markerClusterGroup({
  showCoverageOnHover: false,
  maxClusterRadius: 45, // rayon de regroupement
  iconCreateFunction: function (cluster) {
    return L.divIcon({
      html: '<div class="cluster-bulle">' + cluster.getChildCount() + '</div>',
      className: '',
      iconSize: [36, 36]
    });
  }
});
carte.addLayer(groupeMarqueurs);

// Couleurs de chaque type de fresque
var couleurs = {
  "Fresque participative CCPA":       "#27ae60",
  "Musée urbain d'Ambérieu-en-Bugey": "#8e44ad",
  "Festival Khroma":                  "#e67e22",
  "Fresque hors projet CCPA":         "#2980b9",
  "Fresque historique":               "#c0392b"
};

// Lieux patrimoniaux
var couleurLieuNeutre = "#34495e";

var pictogrammesLieux = {
  "Patrimoine culturel":              "🏛️",
  "Point d'information touristique":  "ℹ️",
  "Patrimoine naturel":               "🌳"
};

// Variables où sont stockées les données une fois chargées
var toutesLesFresques = [];
var tousLesLieux = [];

// Conserve les marqueurs des fresques affichées afin de récupérer leurs
// coordonnées et recentrer automatiquement la carte sur les résultats filtrés.
var registreMarqueursFresques = {};

// Vue de départ de la carte, réutilisée par le bouton "Réinitialiser"
var VUE_INITIALE = { centre: [45.89, 5.29], zoom: 11 };

// Compteur pour savoir quand les 3 fichiers .geojson sont chargés,
// afin de cacher le message "Chargement..." à ce moment-là.
var nbFichiersCharges = 0;
function unFichierDePlusEstCharge() {
  nbFichiersCharges = nbFichiersCharges + 1;
  if (nbFichiersCharges >= 3) {
    document.getElementById('chargement').style.display = 'none';
  }
}

// Contour du territoire de la CCPA, affiché en pointillés
fetch('territoire.geojson')
  .then(function (reponse) { return reponse.json(); })
  .then(function (donnees) {
    L.geoJSON(donnees, {
      interactive: false,
      style: {
        color: "#145692",
        weight: 2.5,
        dashArray: "6,6",
        fill: false
      }
    }).addTo(carte);
    unFichierDePlusEstCharge();
  })
  .catch(function (erreur) {
    console.log("Erreur de chargement du contour du territoire :", erreur);
    unFichierDePlusEstCharge();
  });

// Fresques
fetch('fresques.geojson')
  .then(function (reponse) { return reponse.json(); })
  .then(function (donnees) {
    toutesLesFresques = donnees.features;
    remplirFiltreCommune();
    remplirFiltreArtiste();
    dessinerLaCarte();
    unFichierDePlusEstCharge();
  })
  .catch(function (erreur) {
    console.log("Erreur de chargement des fresques :", erreur);
    document.getElementById('chargement').textContent =
      "Erreur de chargement des données.";
  });

// Lieux patrimoniaux
fetch('Lieux_Patrimoniaux.geojson')
  .then(function (reponse) { return reponse.json(); })
  .then(function (donnees) {
    tousLesLieux = donnees.features;
    dessinerLaCarte();
    unFichierDePlusEstCharge();
  })
  .catch(function (erreur) {
    console.log("Erreur de chargement des lieux patrimoniaux :", erreur);
    unFichierDePlusEstCharge();
  });

// Vérifie si le texte tapé dans la barre de recherche correspond à une fresque/lieu (nom, commune ou artiste).//
function correspondALaRecherche(p, texteRecherche) {
  if (texteRecherche === "") return true; // rien n'est saisi = tout le monde passe
  var texte = texteRecherche.toLowerCase(); // recherche insensible à la casse
  var champs = [p.nom, p.commune, p.artiste, p.accroche];
  for (var i = 0; i < champs.length; i = i + 1) {
    if (champs[i] != null) {
      if (champs[i].toLowerCase().indexOf(texte) !== -1) {
        return true;
      }
    }
  }
  return false;
}

// Redessine les marqueurs sur la carte en fonction des filtres actifs.//
function dessinerLaCarte() {

  // On enlève tous les anciens marqueurs avant d'en remettre
  groupeMarqueurs.clearLayers();
  registreMarqueursFresques = {};

  // Lecture de la valeur actuelle de chaque filtre directement dans le HTML
  var communeChoisie = document.getElementById('filtre-commune').value;
  var typeChoisi      = document.getElementById('filtre-type').value;
  var artisteChoisi    = document.getElementById('filtre-artiste').value;
  var afficherLieux    = document.getElementById('toggle-lieux').checked;
  var texteRecherche   = document.getElementById('filtre-recherche').value.trim();

  var compteurFresques = 0;
  var compteurLieux    = 0;

  // FRESQUES
  for (var i = 0; i < toutesLesFresques.length; i = i + 1) {
    var fresque = toutesLesFresques[i];
    var p = fresque.properties;
    var commune = (p.commune || "").trim();

    if (communeChoisie !== "" && commune !== communeChoisie) continue;
    if (typeChoisi !== "" && p.type !== typeChoisi) continue;
    if (artisteChoisi !== "" && (p.artiste || "").trim() !== artisteChoisi) continue;
    if (!correspondALaRecherche(p, texteRecherche)) continue;

    compteurFresques = compteurFresques + 1;

    var coords = fresque.geometry.coordinates; // [longitude, latitude]
    var latlng = [coords[1], coords[0]];        // Leaflet attend [latitude, longitude]
    var couleur = couleurs[p.type] || "#555";

    var marqueur = L.circleMarker(latlng, {
      radius: 8,
      color: "white",
      weight: 2,
      fillColor: couleur,
      fillOpacity: 0.85
    });
    marqueur.bindPopup(creerPopup(p, latlng));
    groupeMarqueurs.addLayer(marqueur);

    // On garde une référence de ce marqueur pour pouvoir zoomer dessus
    // ensuite (clé unique = "F" + index dans le tableau)
    registreMarqueursFresques["F" + i] = marqueur;
  }

  // LIEUX PATRIMONIAUX (uniquement si la case correspondante est cochée)
  if (afficherLieux) {
    for (var j = 0; j < tousLesLieux.length; j = j + 1) {
      var lieu = tousLesLieux[j];
      var pl = lieu.properties;
      var communeLieu = (pl.commune || "").trim();

      if (communeChoisie !== "" && communeLieu !== communeChoisie) continue;
      if (!correspondALaRecherche(pl, texteRecherche)) continue;

      compteurLieux = compteurLieux + 1;

      var coordsLieu = lieu.geometry.coordinates;
      var latlngLieu = [coordsLieu[1], coordsLieu[0]];
      var fondLieu = couleurLieuNeutre;
      var pictogramme = pictogrammesLieux[pl.type] || "";

      var icone = L.divIcon({
        className: "",
        html: '<span class="icone-lieu" style="background:' + fondLieu + '">' + pictogramme + '</span>',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      var marqueurLieu = L.marker(latlngLieu, { icon: icone });
      marqueurLieu.bindPopup(creerPopup(pl, latlngLieu, false));
      groupeMarqueurs.addLayer(marqueurLieu);
    }
  }

  // Mise à jour des 2 compteurs affichés en haut de page
  document.getElementById('compteur').textContent = compteurFresques;
  document.getElementById('compteur-lieux').textContent = compteurLieux;
}

// Construit le contenu HTML d'une popup (fenêtre qui s'ouvre au clic).
// avecPhoto à false pour les lieux patrimoniaux, qui n'ont pas de photo.
function creerPopup(p, latlng, avecPhoto) {
  var accroche = p.accroche || (p.description || "").substring(0, 120);

  var blocPhoto = "";
  if (avecPhoto !== false) {
    var urlPhoto = p.photo || "photos/placeholder.jpg";
    blocPhoto = '<img src="' + urlPhoto + '" alt="' + p.nom + '" onerror="this.src=\'photos/placeholder.jpg\'">';
  }

  // Affiche/cache le bloc de description complète au clic
  var descriptionComplete = "";
  if (p.description && p.description.length > 130 && p.description !== accroche) {
    descriptionComplete =
      '<button class="btn-lire-plus" onclick="' +
      "var d=this.nextElementSibling; d.style.display = d.style.display==='block' ? 'none' : 'block';" +
      "this.textContent = d.style.display==='block' ? '▲ Réduire' : '▼ Lire la description';" +
      '">▼ Lire la description</button>' +
      '<div class="description-complete">' + p.description + '</div>';
  }

  var lien = p.lien ? '<a href="' + p.lien + '" target="_blank" rel="noopener">En savoir plus →</a>' : "";

  // Lien "Itinéraire" : ouvre Google Maps avec la position actuelle du
  // visiteur comme point de départ
  var itineraire = "";
  if (latlng) {
    var destination = latlng[0] + ',' + latlng[1];
    itineraire = '<a href="https://www.google.com/maps/dir/?api=1&destination=' + destination +
      '&travelmode=walking" target="_blank" rel="noopener"> Itinéraire</a>';
  }

  return (
    '<div class="popup-fresque">' +
      blocPhoto +
      '<span class="badge-type">' + p.type + '</span>' +
      '<h3>' + p.nom + '</h3>' +
      '<p class="accroche">' + accroche + '</p>' +
      '<p class="details">' +
        '<strong>' + p.commune + '</strong>' + (p.adresse ? ' - ' + p.adresse : '') + '<br>' +
        (p.artiste ? p.artiste + '<br>' : '') +
        (p.annee ? p.annee : '') +
      '</p>' +
      descriptionComplete +
      '<div class="popup-footer">' +
        itineraire +
        lien +
      '</div>' +
    '</div>'
  );
}

// Remplit le filtre "commune" avec les communes présentes dans les fresques.

function remplirFiltreCommune() {
  var select = document.getElementById('filtre-commune');

  while (select.options.length > 1) {
    select.remove(1);
  }

  var communes = [];

  toutesLesFresques.forEach(function (item) {
    var c = (item.properties.commune || "").trim();
    if (c !== "" && communes.indexOf(c) === -1) {
      communes.push(c);
    }
  });

  communes.sort();

  communes.forEach(function (c) {
    var option = document.createElement('option');
    option.value = c;
    option.textContent = c;
    select.appendChild(option);
  });
}

// Remplit le filtre "artiste" avec les artistes présents dans les fresques.
function remplirFiltreArtiste() {
  var select = document.getElementById('filtre-artiste');

  while (select.options.length > 1) {
    select.remove(1);
  }

  var artistes = [];

  toutesLesFresques.forEach(function (item) {
    var a = (item.properties.artiste || "").trim();
    if (a !== "" && artistes.indexOf(a) === -1) {
      artistes.push(a);
    }
  });

  artistes.sort();

  artistes.forEach(function (a) {
    var option = document.createElement('option');
    option.value = a;
    option.textContent = a;
    select.appendChild(option);
  });
}

//Recentre/zoome la carte sur les fresques actuellement affichées (filtrées).
function ajusterVueSurLesResultats() {
  var unFiltreEstActif =
    document.getElementById('filtre-commune').value !== "" ||
    document.getElementById('filtre-type').value !== "" ||
    document.getElementById('filtre-artiste').value !== "";

  if (!unFiltreEstActif) {
    carte.setView(VUE_INITIALE.centre, VUE_INITIALE.zoom);
    return;
  }
  var toutesLesLatLng = Object.keys(registreMarqueursFresques).map(function (cle) {
    return registreMarqueursFresques[cle].getLatLng();
  });
  if (toutesLesLatLng.length > 0) {
    carte.fitBounds(L.latLngBounds(toutesLesLatLng), { padding: [50, 50], maxZoom: 17 });
  }
}

// ÉCOUTEURS D'ÉVÈNEMENTS
// À chaque fois qu'un filtre change, on relance dessinerLaCarte()

document.getElementById('filtre-commune').addEventListener('change', function () {
  dessinerLaCarte();
  ajusterVueSurLesResultats();
});
document.getElementById('filtre-type').addEventListener('change', function () {
  dessinerLaCarte();
  ajusterVueSurLesResultats();
});
document.getElementById('filtre-artiste').addEventListener('change', function () {
  dessinerLaCarte();
  ajusterVueSurLesResultats();
});
document.getElementById('toggle-lieux').addEventListener('change', dessinerLaCarte);

// La recherche se met à jour à chaque frappe clavier ("input" et non "change", pour ne pas attendre que l'utilisateur clique ailleurs)
document.getElementById('filtre-recherche').addEventListener('input', dessinerLaCarte);

// Bouton Réinitialiser
document.getElementById('btn-reset').addEventListener('click', function () {
  document.getElementById('filtre-commune').value = "";
  document.getElementById('filtre-type').value = "";
  document.getElementById('filtre-artiste').value = "";
  document.getElementById('filtre-recherche').value = "";
  document.getElementById('toggle-lieux').checked = true;

  dessinerLaCarte();
  carte.setView(VUE_INITIALE.centre, VUE_INITIALE.zoom);
});

// Bouton "Me localiser" (géolocalisation du navigateur)
document.getElementById('btn-geo').addEventListener('click', function () {
  carte.locate({ setView: true, maxZoom: 15 });
});
carte.on('locationerror', function () {
  alert("Impossible de vous localiser. Vérifiez que la géolocalisation est autorisée dans votre navigateur.");
});

// plein ecran

document.getElementById('btn-plein-ecran').addEventListener('click', function () {
  var conteneur = document.getElementById('map');
  if (!document.fullscreenElement) {
    conteneur.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

document.addEventListener('fullscreenchange', function () {
  var bouton = document.getElementById('btn-plein-ecran');
  bouton.textContent = document.fullscreenElement ? '✕ Quitter le plein écran' : '⛶ Plein écran';
  setTimeout(function () { carte.invalidateSize(); }, 100);
});