// Create a new component for swipeable popups
import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, PanResponder } from 'react-native';

const SwipeablePopup = ({ children, onDismiss, style }) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5; // Only respond to horizontal movements
      },
      onPanResponderMove: (_, gestureState) => {
        pan.x.setValue(gestureState.dx);
        // Decrease opacity as the user swipes
        opacity.setValue(Math.max(0.5, 1 - Math.abs(gestureState.dx) / 250));
      },
      onPanResponderRelease: (_, gestureState) => {
        const swipeThreshold = 100;
        if (Math.abs(gestureState.dx) > swipeThreshold) {
          // Swipe was fast/far enough to dismiss
          Animated.parallel([
            Animated.timing(pan.x, {
              toValue: gestureState.dx > 0 ? 400 : -400,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onDismiss && onDismiss();
          });
        } else {
          // Return to center
          Animated.parallel([
            Animated.spring(pan.x, {
              toValue: 0,
              friction: 5,
              useNativeDriver: true,
            }),
            Animated.spring(opacity, {
              toValue: 1,
              friction: 5,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          transform: [{ translateX: pan.x }],
          opacity: opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '93%',
  },
});

export default SwipeablePopup;