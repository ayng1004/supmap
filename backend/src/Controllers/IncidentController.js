const { validationResult } = require('express-validator');
const Incident = require('../models/Incident');

/**
 * Contrôleur pour gérer les incidents
 */
const IncidentController = {
  /**
   * Récupérer tous les incidents
   */
  getAllIncidents: async (req, res) => {
    try {
      const incidents = await Incident.find({ active: true }).sort({ createdAt: -1 });
      return res.json(incidents);
    } catch (error) {
      console.error('Erreur lors de la récupération des incidents:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
  },

  /**
   * Récupérer un incident par son ID
   */
  getIncidentById: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const incident = await Incident.findById(req.params.id);
      
      if (!incident) {
        return res.status(404).json({ message: 'Incident non trouvé' });
      }
      
      return res.json(incident);
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'incident:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
  },

  /**
   * Créer un nouvel incident
   */
  createIncident: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { type, location, description } = req.body;
      
      // Créer un nouvel incident
      const newIncident = new Incident({
        type,
        location: {
          type: 'Point',
          coordinates: location
        },
        description,
        createdBy: req.user ? req.user.id : 'anonymous', // Si authentifié
        votes: {
          up: 0,
          down: 0
        },
        active: true
      });
      
      // Enregistrer l'incident dans la base de données
      await newIncident.save();
      
      return res.status(201).json(newIncident);
    } catch (error) {
      console.error('Erreur lors de la création de l\'incident:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
  },

  /**
   * Mettre à jour un incident
   */
  updateIncident: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Trouver l'incident à mettre à jour
      const incident = await Incident.findById(req.params.id);
      
      if (!incident) {
        return res.status(404).json({ message: 'Incident non trouvé' });
      }
      
      
      // Mettre à jour les champs
      const { type, location, description, active } = req.body;
      
      if (type) incident.type = type;
      if (location) incident.location.coordinates = location;
      if (description !== undefined) incident.description = description;
      if (active !== undefined) incident.active = active;
      
      // Enregistrer les modifications
      await incident.save();
      
      return res.json(incident);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'incident:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
  },

  /**
   * Supprimer un incident
   */
  deleteIncident: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Trouver l'incident à supprimer
      const incident = await Incident.findById(req.params.id);
      
      if (!incident) {
        return res.status(404).json({ message: 'Incident non trouvé' });
      }
      
      
      // Supprimer l'incident
      await incident.remove();
      
      return res.json({ message: 'Incident supprimé avec succès' });
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'incident:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
  },

  /**
   * Voter pour un incident (confirmer ou infirmer)
   */
  voteIncident: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Trouver l'incident
      const incident = await Incident.findById(req.params.id);
      
      if (!incident) {
        return res.status(404).json({ message: 'Incident non trouvé' });
      }
      
      // Ajouter le vote
      const { type } = req.body;
      
      if (type === 'up') {
        incident.votes.up += 1;
      } else {
        incident.votes.down += 1;
      }
      
      // Si l'incident a trop de votes négatifs, le désactiver
      if (incident.votes.down >= 3 && incident.votes.down > incident.votes.up) {
        incident.active = false;
      }
      
      // Enregistrer les modifications
      await incident.save();
      
      return res.json(incident);
    } catch (error) {
      console.error('Erreur lors du vote pour l\'incident:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
  },

  /**
   * Récupérer les incidents à proximité d'une position
   */
  getNearbyIncidents: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { longitude, latitude, radius = 5 } = req.query;
      
      // Convertir le rayon en kilomètres pour MongoDB
      const radiusInRadians = radius / 6371; 
      
      // Rechercher les incidents à proximité
      const incidents = await Incident.find({
        active: true,
        location: {
          $geoWithin: {
            $centerSphere: [[longitude, latitude], radiusInRadians]
          }
        }
      }).sort({ createdAt: -1 });
      
      return res.json(incidents);
    } catch (error) {
      console.error('Erreur lors de la récupération des incidents à proximité:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
  }
};

module.exports = IncidentController;