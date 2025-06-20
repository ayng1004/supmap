// app/screens/HomeScreen.jsx
import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import Map from '../../components/Map';

const HomeScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapContainer}>
        <Map />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
  },
});

export default HomeScreen;