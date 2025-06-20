// VoiceSettingsScreen.jsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Switch, Slider } from 'react-native';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';

const VoiceSettingsScreen = ({ navigation }) => {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [volumeLevel, setVolumeLevel] = useState(0.8);
  const [selectedVoice, setSelectedVoice] = useState('french1');
  
  const voices = [
    { id: 'french1', name: 'Français (Sophie)', language: 'Français' },
    { id: 'french2', name: 'Français (Thomas)', language: 'Français' },
    { id: 'english1', name: 'English (Emma)', language: 'Anglais' },
    { id: 'english2', name: 'English (James)', language: 'Anglais' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Réglages audio et voix</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        {/* Activation/désactivation de la voix */}
        <View style={styles.section}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Instructions vocales</Text>
              <Text style={styles.settingDescription}>Activer les instructions de navigation</Text>
            </View>
            <Switch
              value={voiceEnabled}
              onValueChange={setVoiceEnabled}
              trackColor={{ false: '#D1D1D6', true: '#34C759' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Alertes d'incidents</Text>
              <Text style={styles.settingDescription}>Sons pour les alertes de trafic et incidents</Text>
            </View>
            <Switch
              value={alertsEnabled}
              onValueChange={setAlertsEnabled}
              trackColor={{ false: '#D1D1D6', true: '#FF9500' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Contrôle du volume */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Volume</Text>
          
          <View style={styles.volumeControls}>
            <Ionicons name="volume-low" size={24} color="#666" />
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={volumeLevel}
              onValueChange={setVolumeLevel}
              minimumTrackTintColor="#1A73E8"
              maximumTrackTintColor="#D1D1D6"
              thumbTintColor="#1A73E8"
            />
            <Ionicons name="volume-high" size={24} color="#666" />
          </View>
          
          <TouchableOpacity style={styles.testButton} onPress={() => alert('Fonction de test vocal')}>
            <Text style={styles.testButtonText}>Tester le volume</Text>
          </TouchableOpacity>
        </View>

        {/* Sélection de la voix */}
        {voiceEnabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Voix de navigation</Text>
            
            {voices.map((voice) => (
              <TouchableOpacity 
                key={voice.id}
                style={styles.voiceItem}
                onPress={() => setSelectedVoice(voice.id)}
              >
                <View style={styles.voiceInfo}>
                  <Text style={styles.voiceName}>{voice.name}</Text>
                  <Text style={styles.voiceLanguage}>{voice.language}</Text>
                </View>
                <View style={styles.radioButton}>
                  {selectedVoice === voice.id && (
                    <View style={styles.radioButtonSelected} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Options supplémentaires */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.optionItem}>
            <FontAwesome5 name="download" size={18} color="#1A73E8" style={styles.optionIcon} />
            <Text style={styles.optionText}>Télécharger des voix supplémentaires</Text>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
        </View>
      </View>
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
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingInfo: {
    flex: 1,
    paddingRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  volumeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  slider: {
    flex: 1,
    marginHorizontal: 12,
  },
  testButton: {
    backgroundColor: '#1A73E8',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'center',
  },
  testButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  voiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  voiceInfo: {
    flex: 1,
  },
  voiceName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  voiceLanguage: {
    fontSize: 14,
    color: '#666',
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#1A73E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1A73E8',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  optionIcon: {
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#1A73E8',
  },
});

export default VoiceSettingsScreen;