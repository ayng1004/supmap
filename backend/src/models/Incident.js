const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Schéma MongoDB pour les incidents
 */
const IncidentSchema = new Schema({
  type: {
    type: String,
    enum: ['accident', 'traffic', 'closure', 'police', 'hazard'],
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  description: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: String,
    required: true
  },
  votes: {
    up: {
      type: Number,
      default: 0
    },
    down: {
      type: Number,
      default: 0
    }
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Créer un index géospatial pour les requêtes de proximité
IncidentSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Incident', IncidentSchema);