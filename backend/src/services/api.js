const express = require('express');
const router = express.Router();
const incidentsController = require('../controllers/incidents.controller');

// Créer un nouvel incident
router.post('/', incidentsController.createIncident);

module.exports = router;
