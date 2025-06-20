FROM node:16

# Crée un dossier propre
WORKDIR /app

# Installe globalement expo + react-native
RUN npm install -g expo-cli react-native-cli

# Copie d’abord les fichiers de dépendances
COPY package*.json ./

# Installe les dépendances
RUN npm install

# Puis copie le reste
COPY . .

# Port exposé pour expo
EXPOSE 8081

# Lancement de l’app
CMD ["npm", "start"]
