// components/Navigation.jsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapboxGL from '@react-native-mapbox-gl/maps';
import { lineString as makeLineString } from '@turf/helpers';

const Navigation = ({ origin, destination, options = {} }) => {
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (origin && destination) {
      fetchRoute();
    }
  }, [origin, destination, options.avoidTolls]);

  const fetchRoute = async () => {
    try {
      setLoading(true);
      
      const avoidTolls = options.avoidTolls ? '&exclude=toll' : '';
      
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?alternatives=true&geometries=geojson&steps=true&overview=full&annotations=duration,distance,speed${avoidTolls}&access_token=${MapboxGL.accessToken}`
      );
      
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        setRoute(data.routes[0]);
      } else {
        setError('Aucun itinéraire trouvé');
      }
    } catch (err) {
      console.error('Error fetching route:', err);
      setError('Erreur lors du calcul de l\'itinéraire');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Calcul de l'itinéraire...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchRoute}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {route && (
        <>
          <MapboxGL.ShapeSource
            id="routeSource"
            shape={makeLineString(route.geometry.coordinates)}
          >
            <MapboxGL.LineLayer
              id="routeLine"
              style={{
                lineColor: '#3887be',
                lineWidth: 5,
                lineCap: 'round',
                lineJoin: 'round'
              }}
            />
          </MapboxGL.ShapeSource>
          
          <View style={styles.infoContainer}>
            <Text style={styles.distanceText}>
              Distance: {(route.distance / 1000).toFixed(1)} km
            </Text>
            <Text style={styles.durationText}>
              Durée: {Math.floor(route.duration / 60)} min
            </Text>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#3887be',
    padding: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  infoContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  distanceText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  durationText: {
    fontSize: 16,
  },
});

export default Navigation;