CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE incidents (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  location GEOGRAPHY(POINT) NOT NULL,
  reported_by INTEGER REFERENCES users(id),
  active BOOLEAN DEFAULT TRUE,
  reliability_score FLOAT DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE traffic_history (
  id SERIAL PRIMARY KEY,
  location GEOGRAPHY(POINT) NOT NULL,
  incident_count INTEGER DEFAULT 0,
  average_speed FLOAT,
  day_of_week INTEGER,
  hour_of_day INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
