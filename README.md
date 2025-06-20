
# 🚗 SUPMAP – Application de navigation communautaire en temps réel

SUPMAP est une application de navigation collaborative, inspirée de Waze. Elle fournit aux conducteurs des informations en temps réel sur la circulation, les incidents, les embouteillages et autres événements impactant la route. L'application repose sur une architecture microservices robuste, une interface mobile fluide (React Native), un frontend web (React) pour la gestion avancée, et une API REST sécurisée.

## 🧭 Fonctionnalités principales

- **Navigation intelligente** en temps réel avec Mapbox et itinéraires alternatifs
- **Signalement d’incidents** (accidents, radars, embouteillages, etc.)
- **Validation communautaire** des signalements (votes + système de réputation)
- **Prédiction du trafic** via données historiques et modèles personnalisés
- **Statistiques utilisateur** (temps, trajets, réputation, badges, etc.)
- **Tableaux de bord web** pour analyse, modération et visualisation
- **Authentification OAuth2** (Google, Facebook) + JWT sécurisé

---

## 🛠️ Stack technique

| Couche       | Technologie(s)                |
|--------------|-------------------------------|
| Frontend web | React.js                      |
| Mobile       | React Native (Expo SDK 52)    |
| Backend API  | Node.js, Express, REST        |
| Base de données | PostgreSQL + PostGIS       |
| Authentification | OAuth2, JWT               |
| Cartographie | Mapbox + TomTom Traffic API   |
| Conteneurisation | Docker, Docker Compose    |
| Monitoring   | Logs centralisés + Prometheus |
| Stockage mobile | Expo SecureStore, AsyncStorage |

---

## 🔌 Microservices

| Service         | Description                                                                 |
|-----------------|-----------------------------------------------------------------------------|
| API Gateway     | Routage centralisé, CORS, auth, logging                                     |
| Auth Service    | Inscription, connexion, profils, OAuth2                                     |
| Incident Service| Signalement, vote, fiabilité, statistiques, géolocalisation                 |
| Route Service   | Itinéraires optimisés, alternatives, prédictions de trafic, QR              |
| Web Frontend    | Interface web admin et analytique                                           |
| Mobile Frontend | Application React Native pour Android/iOS                                  |

---

## 🧩 Architecture

Architecture distribuée en **microservices** avec une communication REST entre les services. Toutes les requêtes transitent par l’API Gateway. Les bases de données sont séparées par domaine (auth, incidents, routes).

---

## 🚀 Installation rapide (en local)

### 1. Prérequis

- [Docker](https://www.docker.com/)
- [Node.js 16.x](https://nodejs.org/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Git](https://git-scm.com/)

### 2. Cloner le repo

```bash
git clone https://github.com/ton-org/supmap.git
cd supmap
3. Lancer les services backend et web

docker-compose up --build
L'API Gateway sera disponible sur http://localhost:5000.

4. Lancer l’application mobile
cd frontend-mobile
expo start
Scanner le QR code avec Expo Go ou build avec EAS pour test natif.

🔐 Authentification
JWT pour sécuriser les communications

OAuth2 via Google / Facebook

Stockage des tokens sécurisé avec Expo SecureStore

Middleware d’authentification pour toutes les routes protégées

🧪 Tests
Les tests unitaires sont disponibles pour chaque microservice (Jest + Supertest). Pour exécuter les tests :

cd backend/services/auth-service
npm run test

📊 Statistiques utilisateur
Distance parcourue

Temps économisé

Réputation (votes valides)

Badges communautaires

Historique des trajets

📦 Déploiement
Conteneurs Docker (backend, frontend, bases de données)
Orchestration avec Docker Compose


🧠 Perspectives

Extension à l’international

Ajout de transports alternatifs (vélos, bus, etc.)

Recommandation de départ optimal (AI)

Socialisation de l’app (amis, groupes, chat)

Intégration avec assistants vocaux ou Android Auto



👨‍💻 Auteur
Développé par Ayng1004
Contributions : développement fullstack, cartographie, prédiction de trafic, sécurité, design UX

