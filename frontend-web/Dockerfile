FROM node:20

WORKDIR /app

# Copier fichiers de dépendances
COPY package*.json ./

# Installer les dépendances avec options de cache optimisées
RUN npm install

# Copier le reste du code source
COPY . .

# Exposer le port
EXPOSE 3000

# Commande de démarrage
CMD ["npm", "start"]