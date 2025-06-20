// NightModeToggle.jsx - Composant pour ajouter à MapScreen
import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NightModeToggle = ({ onToggle }) => {
  const [isNightMode, setIsNightMode] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  const toggleMode = () => {
    const newMode = !isNightMode;
    setIsNightMode(newMode);
    
    Animated.timing(animation, {
      toValue: newMode ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
    
    onToggle(newMode);
  };

  const translateX = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  const backgroundColor = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFF', '#333'],
  });

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={toggleMode}
      activeOpacity={0.9}
    >
      <Animated.View style={[styles.background, { backgroundColor }]}>
        <View style={styles.iconContainer}>
          <Ionicons 
            name="sunny" 
            size={14} 
            color={isNightMode ? "#999" : "#FF9500"} 
          />
        </View>
        <View style={styles.iconContainer}>
          <Ionicons 
            name="moon" 
            size={14} 
            color={isNightMode ? "#FFF" : "#999"} 
          />
        </View>
        <Animated.View 
          style={[
            styles.circle,
            { transform: [{ translateX }] }
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 6,
  },
  background: {
    width: 50,
    height: 26,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'white',
    position: 'absolute',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  iconContainer: {
    width: 20,
    alignItems: 'center',
    zIndex: 1,
  },
});

export default NightModeToggle;