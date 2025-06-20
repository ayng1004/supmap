CREATE EXTENSION IF NOT EXISTS postgis;

-- Table des rôles
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertion des rôles par défaut (avec ON CONFLICT pour éviter les doublons)
INSERT INTO roles (name, description) VALUES 
  ('Admin', 'Administrateur avec tous les droits'),
  ('Contributeur', 'Utilisateur pouvant contribuer au contenu'),
  ('User', 'Utilisateur standard avec droits limités')
ON CONFLICT (name) DO NOTHING;

-- Création de la table utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255),
  provider VARCHAR(20),
  provider_id VARCHAR(100),
  avatar_url VARCHAR(255),
  role_id INTEGER REFERENCES roles(id) DEFAULT 3,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ajout de la colonne role_id si elle n'existe pas déjà
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT FROM information_schema.columns 
                WHERE table_name='users' AND column_name='role_id') THEN
    ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id) DEFAULT 3;
  END IF;
END $$;