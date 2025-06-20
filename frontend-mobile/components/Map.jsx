import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { PermissionsAndroid } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

// Configurez votre token Mapbox
MapboxGL.setAccessToken('pk.eyJ1IjoidG95Y2FuIiwiYSI6ImNseDNyemg4eTAza2kya3Nhcm40cW5wcGsifQ.O-QayF8YihwNF62txHaOBw');

const Map = ({ navigation }) => {
  const cameraRef = useRef(null);
  const [incidents, setIncidents] = useState([
    { id: '1', title: 'Accident', coords: [2.349, 48.854], color: '#FF3B30' },
    { id: '2', title: 'Bouchon', coords: [2.346, 48.853], color: '#FF9500' },
  ]);

  useEffect(() => {
    const requestLocationPermission = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: "Autorisation de localisation",
              message: "L'application a besoin d'accéder à votre position.",
              buttonNeutral: "Demander plus tard",
              buttonNegative: "Annuler",
              buttonPositive: "OK",
            },
          );
          console.log('Permission location:', granted);
        } catch (err) {
          console.warn(err);
        }
      }
    };
  
    requestLocationPermission();
  }, []);

  const centerOnUser = async () => {
    const location = await MapboxGL.locationManager.getLastKnownLocation();
    if (location && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [location.coords.longitude, location.coords.latitude],
        zoomLevel: 15,
        animationMode: 'flyTo',
        animationDuration: 1000,
      });
    }
  };

  const signalIncident = async () => {
    const location = await MapboxGL.locationManager.getLastKnownLocation();
    if (location) {
      // Navigation vers l'écran de signalement
      navigation.navigate('ReportIncident', { 
        location: [location.coords.longitude, location.coords.latitude] 
      });
    }
  };

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Street}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          zoomLevel={14}
          centerCoordinate={[2.3488, 48.8534]} // Paris
          animationMode="flyTo"
          animationDuration={2000}
        />
        <MapboxGL.UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
        />
        
        {/* Affichage des incidents sur la carte */}
        {incidents.map((incident) => (
          <MapboxGL.PointAnnotation
            key={incident.id}
            id={incident.id}
            coordinate={incident.coords}
          >
            <View style={[styles.annotationContainer, { backgroundColor: incident.color }]}>
              <Text style={styles.annotationText}>⚠️</Text>
            </View>
          </MapboxGL.PointAnnotation>
        ))}
      </MapboxGL.MapView>

      {/* Bouton pour accéder à l'écran des signalements */}
      <TouchableOpacity 
        style={styles.reportsButton}
        onPress={() => navigation.navigate('Reports')}
      >
        <Ionicons name="list" size={24} color="white" />
        <Text style={styles.buttonText}>Signalements</Text>
      </TouchableOpacity>

      {/* Bouton pour accéder au profil */}
      <TouchableOpacity 
        style={styles.profileButton}
        onPress={() => navigation.navigate('Profile')}
      >
        <Ionicons name="person" size={24} color="white" />
        <Text style={styles.buttonText}>Profil</Text>
      </TouchableOpacity>

      {/* Bouton de localisation */}
      <TouchableOpacity style={styles.locationButton} onPress={centerOnUser}>
        <MaterialIcons name="my-location" size={24} color="#333" />
      </TouchableOpacity>

      {/* Bouton de signalement d'incident */}
      <TouchableOpacity style={styles.signalButton} onPress={signalIncident}>
        <Ionicons name="warning" size={24} color="white" />
        <Text style={styles.buttonText}>Signaler</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  reportsButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  profileButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#5856D6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  locationButton: {
    position: 'absolute',
    bottom: 120,
    right: 16,
    backgroundColor: 'white',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  signalButton: {
    position: 'absolute',
    bottom: 30,
    right: 16,
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  annotationContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  annotationText: {
    fontSize: 16,
  },
});

export default Map;