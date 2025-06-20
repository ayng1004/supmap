// MessagesScreen.jsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, SafeAreaView } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

const MESSAGES = [
  {
    id: '1',
    sender: 'Lucie',
    avatar: 'https://randomuser.me/api/portraits/women/22.jpg',
    content: 'Je suis en route, j\'arrive dans 15 minutes',
    timestamp: new Date(Date.now() - 3600000),
    unread: true,
    location: { lat: 48.8566, lng: 2.3522 }
  },
  {
    id: '2',
    sender: 'Nicolas',
    avatar: 'https://randomuser.me/api/portraits/men/43.jpg',
    content: 'On se retrouve au café près de la station ?',
    timestamp: new Date(Date.now() - 86400000),
    unread: false,
    location: null
  },
  {
    id: '3',
    sender: 'Emma',
    avatar: 'https://randomuser.me/api/portraits/women/56.jpg',
    content: 'Je t\'ai partagé l\'adresse du restaurant',
    timestamp: new Date(Date.now() - 172800000),
    unread: false,
    location: { lat: 48.8738, lng: 2.2950 }
  }
];

const MessagesScreen = ({ navigation }) => {
  const formatTime = (timestamp) => {
    const now = new Date();
    const diffHours = Math.floor((now - timestamp) / (1000 * 60 * 60));
    
    if (diffHours < 24) {
      const hours = timestamp.getHours().toString().padStart(2, '0');
      const minutes = timestamp.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } else if (diffHours < 48) {
      return 'Hier';
    } else {
      const day = timestamp.getDate().toString().padStart(2, '0');
      const month = (timestamp.getMonth() + 1).toString().padStart(2, '0');
      return `${day}/${month}`;
    }
  };

  const renderMessage = ({ item }) => (
    <TouchableOpacity 
      style={[styles.messageItem, item.unread && styles.unreadMessage]}
      onPress={() => navigation.navigate('MessageDetail', { message: item })}
    >
      <Image source={{ uri: item.avatar }} style={styles.avatar} />
      <View style={styles.messageContent}>
        <View style={styles.messageHeader}>
          <Text style={styles.senderName}>{item.sender}</Text>
          <Text style={styles.timestamp}>{formatTime(item.timestamp)}</Text>
        </View>
        <Text 
          style={[styles.messageText, item.unread && styles.unreadMessageText]} 
          numberOfLines={1}
        >
          {item.content}
        </Text>
        {item.location && (
          <View style={styles.locationIndicator}>
            <MaterialIcons name="location-on" size={14} color="#1A73E8" />
            <Text style={styles.locationText}>Position partagée</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity>
          <Ionicons name="add" size={28} color="#1A73E8" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={MESSAGES}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  messagesList: {
    padding: 12,
  },
  messageItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  unreadMessage: {
    backgroundColor: '#F0F7FF',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  messageText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  unreadMessageText: {
    color: '#333',
    fontWeight: '500',
  },
  locationIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 12,
    color: '#1A73E8',
    marginLeft: 4,
  },
});

export default MessagesScreen;