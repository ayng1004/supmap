// components/TrafficPredictionOverlay.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import MapboxGL from '@rnmapbox/maps';
import EnhancedTrafficService from '../services/EnhancedTrafficService';

/**
 * Composant d'interface pour afficher les prédictions d'embouteillages
 * Fonctionne en 2 modes:
 * - Mode "zone" (sans itinéraire): affiche les prédictions pour la zone visible
 * - Mode "route" (avec itinéraire): affiche les prédictions le long d'un itinéraire
 */
const TrafficPredictionOverlay = ({ 
  mapRef, 
  visible = true, 
  currentRoute,
  userLocation,
  visibleBounds,
  predictionType: initialPredictionType,
  onSuggestDepartureTime,
  onCongestionPointsUpdate, // Nouvelle prop pour passer les points au parent
  onToggleLegend // Ajout de cette prop manquante
}) => {
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [activeType, setActiveType] = useState(initialPredictionType || (currentRoute ? 'route' : 'area'));
  const [congestionPoints, setCongestionPoints] = useState([]);
  const [heatmapVisible, setHeatmapVisible] = useState(true);

  // Animation de pulsation pour les points chauds
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true
        })
      ])
    ).start();
  }, []);

  // Fonction utilitaire pour obtenir les limites autour de l'utilisateur
  const getUserBounds = useCallback((userLocation) => {
    if (!userLocation) {
      // Coordonnées par défaut pour Paris
      return {
        minLon: 2.3, 
        minLat: 48.8, 
        maxLon: 2.5, 
        maxLat: 48.9
      };
    }
    
    const [userLng, userLat] = userLocation;
    
    // Créer un rectangle de ~2km autour de l'utilisateur
    const offset = 0.01; // ~1km dans chaque direction
    
    return {
      minLon: userLng - offset,
      minLat: userLat - offset,
      maxLon: userLng + offset,
      maxLat: userLat + offset
    };
  }, []);

  // Fonction pour déterminer la couleur en fonction de l'intensité
  const getTrafficColorFromIntensity = (intensity) => {
    if (intensity < 0.3) return '#4CD964'; // Vert - bon
    if (intensity < 0.5) return '#FFCC00'; // Jaune - moyen
    if (intensity < 0.7) return '#FF9500'; // Orange - dense
    return '#FF3B30'; // Rouge - très dense
  };

  // Fonctions utilitaires d'analyse
  const calculateAverageScore = useCallback((predictions) => {
    if (!predictions || predictions.length === 0) return 75; // Valeur par défaut
    
    const sum = predictions.reduce((total, pred) => total + (pred.score || 100 - (pred.intensity * 100)), 0);
    return Math.round(sum / predictions.length);
  }, []);
  
  const extractHotspots = useCallback((predictions) => {
    if (!predictions || predictions.length === 0) return [];
    
    // Trier par intensité (du plus congestionné au moins congestionné)
    const sorted = [...predictions].sort((a, b) => (b.intensity || b.congestion/100) - (a.intensity || a.congestion/100));
    
    // Retourner les 3 points les plus congestionnés
    return sorted.slice(0, 3).map(spot => ({
      coordinates: [spot.longitude || spot.coordinates?.[0], spot.latitude || spot.coordinates?.[1]],
      congestion: Math.round((spot.intensity || spot.congestion/100) * 100),
      estimatedDelay: Math.round((spot.intensity || spot.congestion/100) * 10),
      zone: spot.zone || { name: `Zone congestionnée ${spot.type || ''}`, type: spot.type || 'DENSE' }
    }));
  }, []);
  
  const estimateDelay = useCallback((predictions) => {
    if (!predictions || predictions.length === 0) return 0;
    
    // Basé sur l'intensité moyenne des prédictions
    const avgIntensity = predictions.reduce((sum, pred) => sum + (pred.intensity || pred.congestion/100 || 0), 0) / predictions.length;
    return Math.round(avgIntensity * 15); // Estimer ~15 min max de retard
  }, []);

  // Charger les prédictions lorsque l'itinéraire ou la zone change
  useEffect(() => {
    if (!visible) return;
    
   const loadPredictions = async () => {
    try {
      setLoading(true);
      console.log(`Chargement des prédictions en mode ${activeType}...`);
      
      // Si nous avons un itinéraire et sommes en mode route
      if (currentRoute && activeType === 'route') {
        console.log('Mode route: Chargement des prédictions pour l\'itinéraire');
        
        // Récupérer les prédictions pour l'itinéraire actuel
        const routeWithPredictions = await EnhancedTrafficService.predictTrafficAlongRoute(
          currentRoute,
          new Date() // Heure actuelle
        );
        
        if (routeWithPredictions && routeWithPredictions.trafficPrediction) {
          setPredictions(routeWithPredictions.trafficPrediction);
          
          // Visualiser les prédictions sur la carte
          if (mapRef && mapRef.current) {
            EnhancedTrafficService.visualizePredictions(
              mapRef,
              routeWithPredictions.trafficPrediction.segments.map(s => ({
                longitude: s.coordinates[0],
                latitude: s.coordinates[1],
                intensity: s.congestion / 100,
                probability: 0.8,
                type: s.congestion > 50 ? 'DENSE' : 'FLUIDE'
              }))
            );
          }
        } else {
          console.log('Aucune prédiction reçue pour l\'itinéraire');
        }
      } 
      // Sinon, utiliser les prédictions de zone (mode area)
      else {
        console.log('Mode zone: Chargement des prédictions pour la région');
        // Utiliser les limites visibles ou créer une zone autour de l'utilisateur
        let bounds = visibleBounds || getUserBounds(userLocation);
        
        // Vérifier que bounds est valide
        if (!bounds || !bounds.minLat || !bounds.maxLat || !bounds.minLon || !bounds.maxLon) {
          console.warn('Limites non valides, création de limites par défaut');
          // Créer des limites par défaut autour de Paris
          bounds = {
            minLon: 2.3, 
            minLat: 48.8, 
            maxLon: 2.5, 
            maxLat: 48.9
          };
        }
                
        // Récupérer les prédictions pour la région
        const regionPredictions = await EnhancedTrafficService.predictTrafficForRegion(
          bounds,
          new Date() // Heure actuelle
        );
        
        if (regionPredictions && regionPredictions.length > 0) {
          setPredictions({
            score: calculateAverageScore(regionPredictions),
            hotspots: extractHotspots(regionPredictions),
            estimatedDelay: estimateDelay(regionPredictions),
            segments: regionPredictions.map(pred => ({
              coordinates: [pred.longitude, pred.latitude],
              congestion: Math.round(pred.intensity * 100),
              trafficScore: 100 - Math.round(pred.intensity * 100)
            }))
          });
        const visPoints = regionPredictions
  .filter(p => p.intensity > 0.2) // Inclure plus de points pour un meilleur affichage
  .map(p => {
    // Déterminer la couleur en fonction de l'intensité
    let color;
    if (p.intensity < 0.3) color = '#4CD964'; // Vert - trafic fluide
    else if (p.intensity < 0.5) color = '#FFCC00'; // Jaune - trafic modéré
    else if (p.intensity < 0.7) color = '#FF9500'; // Orange - trafic dense
    else color = '#FF3B30'; // Rouge - trafic très dense
    
    return {
      coordinate: [p.longitude, p.latitude],
      intensity: p.intensity,
      color: color,
      type: p.type,
      routeId: p.roadId || p.routeId, // Identifiant de la route
      isSignificant: p.isIncidentPoint || p.intensity > 0.65, // Marquer les points importants
      timestamp: new Date().getTime()
    };
  });

setCongestionPoints(visPoints);

// Transmettre les points au composant parent
if (onCongestionPointsUpdate) {
  onCongestionPointsUpdate(visPoints);
}
          
          // Visualiser les prédictions sur la carte
          if (mapRef && mapRef.current) {
            EnhancedTrafficService.visualizePredictions(
              mapRef,
              regionPredictions
            );
          }
        } else {
          console.log('Aucune prédiction reçue pour la région');
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des prédictions:', error);
    } finally {
      setLoading(false);
    }
  };
    
    loadPredictions();
  }, [visible, currentRoute, activeType, userLocation, visibleBounds, calculateAverageScore, extractHotspots, estimateDelay, getUserBounds, onCongestionPointsUpdate]);
  
  // Si le composant n'est pas visible ou si nous n'avons pas de prédictions
  if (!visible || !predictions) {
    return null;
  }
  
  // Obtenir la couleur en fonction du score de trafic
  const getTrafficColor = (score) => {
    if (score >= 80) return '#4CD964'; // Vert - bon
    if (score >= 60) return '#FFCC00'; // Jaune - moyen
    if (score >= 40) return '#FF9500'; // Orange - dense
    return '#FF3B30'; // Rouge - très dense
  };
  
  // Obtenir une description du trafic
  const getTrafficDescription = (score) => {
    if (score >= 80) return 'Trafic fluide';
    if (score >= 60) return 'Trafic modéré';
    if (score >= 40) return 'Trafic dense';
    if (score >= 20) return 'Trafic très dense';
    return 'Trafic bloqué';
  };
  
  // Formater un temps en minutes
  const formatMinutes = (minutes) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} h ${mins > 0 ? `${mins} min` : ''}`;
  };
  
  // Rafraîchir les prédictions manuellement
  const refreshPredictions = async () => {
    if (!userLocation && !visibleBounds) return;
    
    try {
      setLoading(true);
      
      // Selon le mode actif
      if (activeType === 'route' && currentRoute) {
        const routeWithPredictions = await EnhancedTrafficService.predictTrafficAlongRoute(
          currentRoute,
          new Date()
        );
        setPredictions(routeWithPredictions.trafficPrediction);
        
        if (mapRef && mapRef.current) {
          EnhancedTrafficService.visualizePredictions(
            mapRef,
            routeWithPredictions.trafficPrediction.segments.map(s => ({
              longitude: s.coordinates[0],
              latitude: s.coordinates[1],
              intensity: s.congestion / 100,
              probability: 0.8,
              type: s.congestion > 50 ? 'DENSE' : 'FLUIDE'
            }))
          );
        }
      } else {
        // Mode zone
        const bounds = visibleBounds || getUserBounds(userLocation);
        
        const regionPredictions = await EnhancedTrafficService.predictTrafficForRegion(
          bounds,
          new Date()
        );
        
        setPredictions({
          score: calculateAverageScore(regionPredictions),
          hotspots: extractHotspots(regionPredictions),
          estimatedDelay: estimateDelay(regionPredictions),
          segments: regionPredictions.map(pred => ({
            coordinates: [pred.longitude, pred.latitude],
            congestion: Math.round(pred.intensity * 100),
            trafficScore: 100 - Math.round(pred.intensity * 100)
          }))
        });
        
        // Extraire les points pour la visualisation
        const visPoints = regionPredictions
          .filter(p => p.intensity > 0.4)
          .map(p => ({
            coordinate: [p.longitude, p.latitude],
            intensity: p.intensity,
            color: getTrafficColorFromIntensity(p.intensity)
          }));
        
        setCongestionPoints(visPoints);
        
        // Transmettre les points au composant parent
        if (onCongestionPointsUpdate) {
          onCongestionPointsUpdate(visPoints);
        }
        
        if (mapRef && mapRef.current) {
          EnhancedTrafficService.visualizePredictions(
            mapRef,
            regionPredictions
          );
        }
      }
    } catch (error) {
      console.error('Erreur lors du rafraîchissement des prédictions:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Basculer entre les prédictions pour l'itinéraire et pour la zone
  const togglePredictionType = () => {
    // Si les deux modes sont disponibles
    if (currentRoute) {
      const newType = activeType === 'route' ? 'area' : 'route';
      setActiveType(newType);
    } else {
      // Sinon, rester en mode zone
      setActiveType('area');
    }
  };
  

  return (
    <View style={styles.container}>
      {/* Panneau de contrôle avec BlurView */}
      <BlurView intensity={80} style={styles.blurContainer} tint="light">
        <TouchableOpacity 
          style={styles.header}
          onPress={() => setExpanded(!expanded)}
        >
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons 
              name="traffic-light" 
              size={24} 
              color={getTrafficColor(predictions.score)} 
            />
            <Text style={styles.headerTitle}>Prédictions de trafic</Text>
          </View>
          
          <View style={styles.headerRight}>
            <Text 
              style={[
                styles.trafficScore, 
                { color: getTrafficColor(predictions.score) }
              ]}
            >
              {predictions.score}/100
            </Text>
            <Ionicons 
              name={expanded ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color="#666"
            />
          </View>
        </TouchableOpacity>
        
        {/* Contenu détaillé (affiché uniquement si expanded est true) */}
        {expanded && (
          <View style={styles.content}>
            {/* Description générale */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>État du trafic</Text>
              <Text style={[
                styles.trafficDescription,
                { color: getTrafficColor(predictions.score) }
              ]}>
                {getTrafficDescription(predictions.score)}
              </Text>
              
              {predictions.estimatedDelay > 0 && (
                <Text style={styles.delayText}>
                  Retard estimé: {formatMinutes(predictions.estimatedDelay)}
                </Text>
              )}
            </View>
            
            {/* Points chauds (zones de congestion) */}
            {predictions.hotspots && predictions.hotspots.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Points de congestion</Text>
                
                {predictions.hotspots.map((hotspot, index) => (
                  <View key={`hotspot-${index}`} style={styles.hotspotItem}>
                    <Animated.View 
                      style={[
                        styles.hotspotDot,
                        { 
                          backgroundColor: getTrafficColor(100 - hotspot.congestion),
                          transform: [{ scale: pulseAnim }]
                        }
                      ]} 
                    />
                    <View style={styles.hotspotInfo}>
                      <Text style={styles.hotspotTitle}>
                        {hotspot.zone ? hotspot.zone.name : `Zone de congestion ${index + 1}`}
                      </Text>
                      <Text style={styles.hotspotDescription}>
                        Congestion: {hotspot.congestion}% • Retard: ~{Math.round(hotspot.estimatedDelay)} min
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            
            {/* Bouton pour suggérer un meilleur moment de départ */}
            <TouchableOpacity 
              style={styles.suggestButton}
              onPress={() => onSuggestDepartureTime && onSuggestDepartureTime(currentRoute)}
            >
       <Ionicons name="time-outline" size={20} color="#fff" />
              <Text style={styles.suggestButtonText}>Suggérer un meilleur moment de départ</Text>
            </TouchableOpacity>
            
            {/* Options supplémentaires */}
            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={refreshPredictions}
              >
                <Ionicons name="refresh" size={18} color="#555" />
                <Text style={styles.actionText}>Actualiser</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => setHeatmapVisible(!heatmapVisible)}
              >
                <Ionicons 
                  name={heatmapVisible ? "eye-off" : "eye"} 
                  size={18} 
                  color="#555" 
                />
                <Text style={styles.actionText}>
                  {heatmapVisible ? 'Masquer' : 'Afficher'}
                </Text>
              </TouchableOpacity>
              
              {/* Nouveau bouton pour la légende */}
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => {
                  // Propager l'état de la légende au parent
                  if (onToggleLegend) {
                    onToggleLegend();
                  }
                }}
              >
                <Ionicons name="information-circle" size={18} color="#555" />
                <Text style={styles.actionText}>Légende</Text>
              </TouchableOpacity>
            </View>
            {/* Option pour basculer type de prédiction */}
            {currentRoute && (
              <View style={[styles.actionRow, {marginTop: 8}]}>
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={togglePredictionType}
                >
                  <Ionicons 
                    name={activeType === 'route' ? 'map' : 'navigate'} 
                    size={18} 
                    color="#555"
                  />
                  <Text style={styles.actionText}>
                    {activeType === 'route' ? 'Voir zone' : 'Voir itinéraire'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </BlurView>
      
      {/* Indicateur de chargement */}
      {loading && (
        <View style={styles.loadingIndicator}>
          <ActivityIndicator size="small" color="#4285F4" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30, // Ajusté pour être au-dessus des boutons d'action
    left: 15,
    right: 15,
    zIndex: 10,
    borderRadius: 16,
    backgroundColor:'white'
  },
  blurContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#333',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trafficScore: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  content: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  trafficDescription: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  delayText: {
    fontSize: 14,
    color: '#666',
  },
  hotspotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
  },
  hotspotDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  hotspotInfo: {
    flex: 1,
  },
  hotspotTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  hotspotDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  suggestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  suggestButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 6,
    flex: 0.48,
  },
  actionText: {
    fontSize: 12,
    color: '#555',
    marginLeft: 4,
  },
  disabledText: {
    color: '#AAA',
  },
  loadingIndicator: {
    position: 'absolute',
    top: -20,
    right: 10,
    backgroundColor: '#fff',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  congestionPoint: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 3,
  }
});

export default TrafficPredictionOverlay;