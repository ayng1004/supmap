// BottomMenuDrawer.jsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PanGestureHandler } from 'react-native-gesture-handler';

const BottomMenuDrawer = ({ visible, onClose, onDestinationPress, userLocation, recentDestinations = [] }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [slideAnim] = useState(new Animated.Value(0));
  const screenHeight = Dimensions.get('window').height;
  const fullMenuHeight = screenHeight * 0.6;
  const minimizedMenuHeight = 130;

  useEffect(() => {
    if (visible) {
      setIsMinimized(false);
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [fullMenuHeight, isMinimized ? fullMenuHeight - minimizedMenuHeight : 0],
  });

  let startY = 0;

  const handleGestureStart = (event) => {
    startY = event.nativeEvent.absoluteY;
  };

  const handleGestureEnd = (event) => {
    const endY = event.nativeEvent.absoluteY;
    const distance = endY - startY;

    if (distance > 50) {
      if (isMinimized) onClose();
      else {
        setIsMinimized(true);
        Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
      }
    } else if (distance < -50) {
      if (isMinimized) {
        setIsMinimized(false);
        Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
      }
    }
  };

  const toggleMinimized = () => {
    setIsMinimized(!isMinimized);
    Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
  };

  if (!visible) return null;

  return (
    <Modal transparent={true} visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <PanGestureHandler onBegan={handleGestureStart} onEnded={handleGestureEnd}>
          <Animated.View
            style={[styles.bottomMenu, { transform: [{ translateY }], height: isMinimized ? minimizedMenuHeight : fullMenuHeight }]}
          >
            <TouchableOpacity style={styles.bottomMenuHandle} onPress={toggleMinimized}>
              <View style={styles.handleBar} />
              <Ionicons name={isMinimized ? 'chevron-up' : 'chevron-down'} size={18} color="#999" style={{ marginTop: 5 }} />
            </TouchableOpacity>

            <Text style={styles.bottomMenuTitle}>Navigation</Text>

            <TouchableOpacity style={styles.destinationButton} onPress={onDestinationPress}>
              <View style={styles.destinationButtonIcon}>
                <Ionicons name="navigate" size={22} color="#1A73E8" />
              </View>
              <Text style={styles.destinationButtonText}>Définir une destination</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            {!isMinimized && (
              <>
               <View style={{ flex: 1 }}>
              <Text style={styles.recentDestinationsTitle}>Destinations enregistrées</Text>
              
              <View style={styles.cardRow}>
                <TouchableOpacity style={styles.destinationCard}>
                  <Ionicons name="home-outline" size={28} color="#1A73E8" />
                  <Text style={styles.cardText}>Domicile</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.destinationCard}>
                  <Ionicons name="briefcase-outline" size={28} color="#1A73E8" />
                  <Text style={styles.cardText}>Travail</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.destinationCard}>
                  <Ionicons name="add-circle-outline" size={28} color="#1A73E8" />
                  <Text style={styles.cardText}>Ajouter</Text>
                </TouchableOpacity>
              </View>
                <Text style={styles.recentDestinationsTitle}>Destinations récentes</Text>
                {recentDestinations.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.recentDestinationItem}>
                    <Ionicons name="time-outline" size={20} color="#666" />
                    <Text style={styles.recentDestinationText}>{item.name || 'Destination'}</Text>
                  </TouchableOpacity>
                ))}
            </View>


              
              </>
            )}
          </Animated.View>
        </PanGestureHandler>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  bottomMenu: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  bottomMenuHandle: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#DDDDDD',
  },
  bottomMenuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  destinationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  destinationButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  destinationButtonText: {
    fontSize: 16,
    flex: 1,
  },
  recentDestinationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  recentDestinationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  recentDestinationText: {
    fontSize: 16,
    marginLeft: 12,
  },
  savedDestinationsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  savedCard: {
    width: '30%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  homeCard: {
    backgroundColor: '#4CAF50',
  },
  workCard: {
    backgroundColor: '#FF9800',
  },
  addCard: {
    borderWidth: 1,
    borderColor: '#1A73E8',
    backgroundColor: '#FFF',
  },
  cardText: {
    fontSize: 14,
    marginTop: 6,
    color: 'white',
  },
  cardRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginTop: 4,
  gap: 8,
},

destinationCard: {
  flex: 1,
  backgroundColor: '#F0F4F8',
  borderRadius: 12,
  paddingVertical: 16,
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 2,
  elevation: 2,
},

cardText: {
  marginTop: 8,
  fontSize: 14,
  color: '#333',
  fontWeight: '600',
}
});

export default BottomMenuDrawer;