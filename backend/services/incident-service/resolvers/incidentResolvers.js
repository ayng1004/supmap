const db = require('../db'); // ta connexion PostgreSQL

module.exports = {
  Query: {
    userStats: async (_, { userId }) => {
      const incidentCount = await db.countIncidentsByUser(userId);
      const confirmed = await db.countConfirmedByUser(userId);
      const denied = await db.countDeniedByUser(userId);
      const last = await db.getLastReportDate(userId);

      return {
        incidentCount,
        confirmed,
        denied,
        lastReportedAt: last || null
      };
    }
  }
};
