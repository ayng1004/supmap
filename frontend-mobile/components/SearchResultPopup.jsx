// New component for search results
const SearchResultPopup = ({ place, onClose, onNavigate }) => {
    if (!place) return null;
    
    return (
      <SwipeablePopup onDismiss={onClose} style={styles.searchResultPopupContainer}>
        <View style={styles.searchResultPopupContent}>
          <View style={styles.searchResultPopupHeader}>
            <View style={styles.searchResultPopupIconContainer}>
              <Ionicons name="location" size={24} color="white" />
            </View>
            <View style={styles.searchResultPopupHeaderText}>
              <Text style={styles.searchResultPopupTitle}>{place.name || "Destination"}</Text>
              <Text style={styles.searchResultPopupSubtitle}>{place.address || place.formattedAddress || ""}</Text>
            </View>
          </View>
          
          <View style={styles.searchResultPopupButtonContainer}>
            <TouchableOpacity 
              style={styles.searchResultNavigateButton}
              onPress={() => onNavigate && onNavigate(place)}
            >
              <MaterialIcons name="directions" size={20} color="white" />
              <Text style={styles.searchResultNavigateButtonText}>Y aller</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.searchResultSaveButton}
              onPress={() => {
                // Handle saving the place for later
                Alert.alert("Favori", "Lieu sauvegardé dans vos favoris");
                onClose && onClose();
              }}
            >
              <Ionicons name="bookmark-outline" size={20} color="#1A73E8" />
              <Text style={styles.searchResultSaveButtonText}>Sauvegarder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SwipeablePopup>
    );
  };
  
  // Add these styles to your StyleSheet
  const additionalStyles = {
    searchResultPopupContainer: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? '15%' + STATUSBAR_HEIGHT : '15%',
      left: 16,
      right: 16,
      borderRadius: 16,
      backgroundColor: 'white',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 8,
      zIndex: 100,
      overflow: 'hidden',
    },
    searchResultPopupContent: {
      padding: 16,
    },
    searchResultPopupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    searchResultPopupIconContainer: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: '#1A73E8',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    searchResultPopupHeaderText: {
      flex: 1,
    },
    searchResultPopupTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    searchResultPopupSubtitle: {
      fontSize: 14,
      color: '#666',
    },
    searchResultPopupButtonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
    },
    searchResultNavigateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1A73E8',
      borderRadius: 20,
      paddingVertical: 10,
      paddingHorizontal: 16,
      flex: 1,
      marginRight: 8,
    },
    searchResultNavigateButtonText: {
      marginLeft: 8,
      fontWeight: '500',
      fontSize: 16,
      color: 'white',
    },
    searchResultSaveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F5F5F5',
      borderRadius: 20,
      paddingVertical: 10,
      paddingHorizontal: 16,
      flex: 1,
      marginLeft: 8,
    },
    searchResultSaveButtonText: {
      marginLeft: 8,
      fontWeight: '500',
      fontSize: 16,
      color: '#1A73E8',
    },
    searchResultMarker: {
      width: 50,
      height: 50,
      justifyContent: 'center',
      alignItems: 'center',
    },
    searchResultMarkerIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#1A73E8',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: 'white',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 6,
    },
  };
  
  // Merge the styles
  const styles = StyleSheet.create({
    ...existingStyles,
    ...additionalStyles,
  });