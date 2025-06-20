-- Extension PostGIS pour les données géospatiales
CREATE EXTENSION IF NOT EXISTS postgis;

-- Utilisateurs
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255),
  provider VARCHAR(20),
  provider_id VARCHAR(100),
  avatar_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Incidents
CREATE TABLE incidents (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- accident, embouteillage, contrôle, etc.
  description TEXT,
  location GEOGRAPHY(POINT) NOT NULL,
  reported_by INTEGER REFERENCES users(id),
  active BOOLEAN DEFAULT TRUE,
  reliability_score FLOAT DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Votes sur les incidents
CREATE TABLE incident_votes (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER REFERENCES incidents(id),
  user_id INTEGER REFERENCES users(id),
  is_confirmed BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(incident_id, user_id)
);

-- Itinéraires sauvegardés
CREATE TABLE routes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(100),
  origin GEOGRAPHY(POINT) NOT NULL,
  destination GEOGRAPHY(POINT) NOT NULL,
  waypoints JSONB,
  avoid_tolls BOOLEAN DEFAULT FALSE,
  route_data JSONB NOT NULL,
  qr_code_uuid UUID UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historique de trafic (pour les prédictions)
CREATE TABLE traffic_history (
  id SERIAL PRIMARY KEY,
  location GEOGRAPHY(POINT) NOT NULL,
  incident_count INTEGER DEFAULT 0,
  average_speed FLOAT,
  day_of_week INTEGER, -- 0-6 pour dim-sam
  hour_of_day INTEGER, -- 0-23
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);