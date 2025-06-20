// Configuration CORS explicite
app.use(function(req, res, next) {
    // Autoriser toutes les origines en développement
    res.header("Access-Control-Allow-Origin", "*");
    
    // Autoriser les en-têtes spécifiques
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    
    // Autoriser les méthodes HTTP
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    
    // Gérer les requêtes preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    next();
  });