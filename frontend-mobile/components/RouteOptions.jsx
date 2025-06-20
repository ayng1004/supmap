// components/EnhancedRouteOptions.jsx
// Version améliorée du composant RouteOptions avec analyse intelligente
import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Dimensions
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';

const RouteOptions = ({ 
  routes = [], 
  selectedIndex = 0, 
  routeScores = [], 
  onSelectRoute,
  onClose,
  onStartNavigation
}) => {
  // Si aucun itinéraire n'est disponible
  if (routes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Aucun itinéraire disponible</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#666" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Options d'itinéraire</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#666" />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {routes.map((route, index) => {
          // Objet de score pour cet itinéraire
          const scoreData = routeScores[index] || { score: 100, incidents: [] };
          
          // Déterminer la couleur du score et le libellé
          let scoreColor, scoreLabel;
          if (scoreData.score > 80) {
            scoreColor = '#34C759'; // Vert
            scoreLabel = 'Recommandé';
          } else if (scoreData.score > 40) {
            scoreColor = '#FF9500'; // Orange
            scoreLabel = 'Acceptable';
          } else {
            scoreColor = '#FF3B30'; // Rouge
            scoreLabel = 'Déconseillé';
          }
          
          // Déterminer le nombre de minutes estimées
          const minutes = Math.floor(route.duration / 60);
          
          // Déterminer le temps d'arrivée estimé
          const eta = new Date(Date.now() + route.duration * 1000);
          const etaHours = eta.getHours();
          const etaMinutes = eta.getMinutes();
          const etaFormatted = `${etaHours}:${etaMinutes < 10 ? '0' : ''}${etaMinutes}`;
          
          return (
            <TouchableOpacity
              key={route.id || index}
              style={[
                styles.routeCard,
                selectedIndex === index && styles.selectedRouteCard
              ]}
              onPress={() => onSelectRoute(index)}
            >
              <View style={styles.routeHeader}>
                <View style={[styles.routeColorDot, { backgroundColor: route.color }]} />
                <Text style={styles.routeTitle}>Itinéraire {index + 1}</Text>
                {scoreData.incidents.length > 0 && (
                  <View style={styles.warningBadge}>
                    <Ionicons name="warning" size={12} color="#FFF" />
                  </View>
                )}
              </View>
              
              <View style={styles.mainInfo}>
                <View style={styles.timeInfo}>
                  <Text style={styles.timeValue}>{minutes}</Text>
                  <Text style={styles.timeUnit}>min</Text>
                </View>
                
                <View style={styles.divider} />
                
                <View style={styles.distanceInfo}>
                <Text style={styles.distanceValue}>{(route.distance / 1000).toFixed(1)}</Text>
                  <Text style={styles.distanceUnit}>km</Text>
                </View>
                
                <View style={styles.divider} />
                
                <View style={styles.etaInfo}>
                  <Text style={styles.etaLabel}>Arrivée à</Text>
                  <Text style={styles.etaValue}>{etaFormatted}</Text>
                </View>
              </View>
              
              <View style={styles.routeDetails}>
                <View style={styles.detailItem}>
                  <MaterialIcons name="speed" size={16} color="#666" />
                  <Text style={styles.detailText}>
                    {Math.round((route.distance / 1000) / (route.duration / 3600))} km/h
                  </Text>
                </View>
                
                {scoreData.incidents.length > 0 && (
                  <View style={styles.detailItem}>
                    <FontAwesome5 name="exclamation-triangle" size={14} color="#FF9500" />
                    <Text style={styles.detailText}>
                      {scoreData.incidents.length} incident{scoreData.incidents.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={[styles.scoreBar, { backgroundColor: `${scoreColor}30` }]}>
                <View 
                  style={[
                    styles.scoreBarFill, 
                    { 
                      width: `${scoreData.score}%`,
                      backgroundColor: scoreColor
                    }
                  ]} 
                />
              </View>
              
              <View style={styles.scoreContainer}>
                <Text style={[styles.scoreLabel, { color: scoreColor }]}>
                  {scoreLabel}
                </Text>
                {index === selectedIndex && (
                  <View style={styles.selectedIndicator}>
                    <Text style={styles.selectedText}>Sélectionné</Text>
                  </View>
                )}
              </View>
              
              {scoreData.incidents.length > 0 && (
                <View style={styles.incidentsList}>
                  <Text style={styles.incidentsTitle}>Incidents sur le trajet :</Text>
                  {scoreData.incidents.slice(0, 2).map((incident, idx) => (
                    <View key={idx} style={styles.incidentItem}>
                      <FontAwesome5 
                        name={getIncidentIcon(incident.type)} 
                        size={12} 
                        color={getIncidentColor(incident.type)} 
                      />
                      <Text style={styles.incidentText}>
                        {getIncidentName(incident.type)}
                      </Text>
                    </View>
                  ))}
                  {scoreData.incidents.length > 2 && (
                    <Text style={styles.moreIncidentsText}>
                      +{scoreData.incidents.length - 2} autre(s)...
                    </Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerButton}>
          <Ionicons name="options-outline" size={20} color="#3887be" />
          <Text style={styles.footerButtonText}>Options</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.startButton}
          onPress={onStartNavigation}
        >
          <Text style={styles.startButtonText}>Démarrer</Text>
          <Ionicons name="navigate" size={20} color="#FFF" style={styles.startButtonIcon} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Fonction pour obtenir l'icône d'un type d'incident
const getIncidentIcon = (type) => {
  const icons = {
    'accident': 'car-crash',
    'traffic': 'traffic-light',
    'closure': 'road',
    'police': 'shield-alt',
    'hazard': 'exclamation-triangle'
  };
  
  return icons[type] || 'exclamation';
};

// Fonction pour obtenir la couleur d'un type d'incident
const getIncidentColor = (type) => {
  const colors = {
    'accident': '#FF3B30',
    'traffic': '#FF9500',
    'closure': '#5856D6',
    'police': '#34C759',
    'hazard': '#FF2D55'
  };
  
  return colors[type] || '#8E8E93';
};

// Fonction pour obtenir le nom d'un type d'incident
const getIncidentName = (type) => {
  const names = {
    'accident': 'Accident',
    'traffic': 'Embouteillage',
    'closure': 'Route fermée',
    'police': 'Contrôle de police',
    'hazard': 'Danger'
  };
  
  return names[type] || 'Incident';
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    margin: 16,
    maxHeight: Dimensions.get('window').height * 0.7,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  routeCard: {
    width: 280,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedRouteCard: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#3887be',
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  warningBadge: {
    backgroundColor: '#FF9500',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  timeInfo: {
    alignItems: 'center',
  },
  timeValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  timeUnit: {
    fontSize: 12,
    color: '#666',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#F0F0F0',
  },
  distanceInfo: {
    alignItems: 'center',
  },
  distanceValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  distanceUnit: {
    fontSize: 12,
    color: '#666',
  },
  etaInfo: {
    alignItems: 'center',
  },
  etaLabel: {
    fontSize: 12,
    color: '#666',
  },
  etaValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  routeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  scoreBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectedIndicator: {
    backgroundColor: '#3887be20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  selectedText: {
    fontSize: 12,
    color: '#3887be',
    fontWeight: '600',
  },
  incidentsList: {
    marginTop: 8,
  },
  incidentsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  incidentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  incidentText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  moreIncidentsText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  footerButtonText: {
    marginLeft: 6,
    fontSize: 16,
    color: '#3887be',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3887be',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  startButtonIcon: {
    marginLeft: 8,
  },
  emptyContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    height: 200,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
});

export default RouteOptions;