// POISearchScreen.jsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

const CATEGORIES = [
  { id: 'parking', name: 'Parking', icon: 'parking' },
  { id: 'gas', name: 'Stations', icon: 'gas-pump' },
  { id: 'food', name: 'Restaurants', icon: 'utensils' },
  { id: 'shopping', name: 'Commerces', icon: 'shopping-bag' },
  { id: 'hotel', name: 'Hôtels', icon: 'bed' },
  { id: 'atm', name: 'Banques', icon: 'money-bill-wave' },
];

const PLACES = [
  { id: '1', name: 'Parking Indigo Marché Saint-Germain', category: 'parking', distance: 0.3, rating: 4.2, address: '14 Rue Lobineau, 75006 Paris' },
  { id: '2', name: 'Total Énergies', category: 'gas', distance: 1.2, rating: 3.8, address: '89 Boulevard du Montparnasse, 75006 Paris' },
  { id: '3', name: 'Le Petit Bistro', category: 'food', distance: 0.5, rating: 4.5, address: '32 Rue de Seine, 75006 Paris' },
  { id: '4', name: 'Monoprix', category: 'shopping', distance: 0.7, rating: 4.0, address: '50 Rue de Rennes, 75006 Paris' },
  { id: '5', name: 'Hôtel des Marronniers', category: 'hotel', distance: 0.9, rating: 4.3, address: '21 Rue Jacob, 75006 Paris' },
  { id: '6', name: 'BNP Paribas', category: 'atm', distance: 0.4, rating: 3.9, address: '5 Boulevard Saint-Germain, 75006 Paris' },
];

const POISearchScreen = ({ navigation }) => {
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [sortBy, setSortBy] = useState('distance'); // 'distance' or 'rating'

  const filteredPlaces = PLACES.filter(place => {
    const matchesCategory = selectedCategory ? place.category === selectedCategory : true;
    const matchesSearch = searchText 
      ? place.name.toLowerCase().includes(searchText.toLowerCase()) 
      : true;
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    if (sortBy === 'distance') {
      return a.distance - b.distance;
    } else {
      return b.rating - a.rating;
    }
  });

  const getCategoryIcon = (categoryId) => {
    const category = CATEGORIES.find(c => c.id === categoryId);
    return category ? category.icon : 'question';
  };

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.categoryItem, 
        selectedCategory === item.id && styles.categoryItemSelected
      ]}
      onPress={() => setSelectedCategory(selectedCategory === item.id ? null : item.id)}
    >
      <FontAwesome5 
        name={item.icon} 
        size={18} 
        color={selectedCategory === item.id ? '#FFF' : '#666'} 
      />
      <Text 
        style={[
          styles.categoryName,
          selectedCategory === item.id && styles.categoryNameSelected
        ]}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderPlace = ({ item }) => (
    <TouchableOpacity 
      style={styles.placeItem}
      onPress={() => navigation.navigate('MapScreen', { 
        destination: { 
          name: item.name, 
          coords: [2.3488, 48.8534] // Coordonnées fictives, à remplacer par de vraies données
        }
      })}
    >
      <View style={styles.placeIconContainer}>
        <FontAwesome5 name={getCategoryIcon(item.category)} size={20} color="#FFF" />
      </View>
      <View style={styles.placeInfo}>
        <Text style={styles.placeName}>{item.name}</Text>
        <Text style={styles.placeAddress}>{item.address}</Text>
        <View style={styles.placeDetails}>
          <Text style={styles.placeDistance}>{item.distance} km</Text>
          <View style={styles.ratingContainer}>
            <MaterialIcons name="star" size={16} color="#FFD700" />
            <Text style={styles.ratingText}>{item.rating}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.directionButton}>
        <MaterialIcons name="directions" size={24} color="#1A73E8" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.searchInputContainer}>
          <MaterialIcons name="search" size={22} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un lieu"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText ? (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <MaterialIcons name="clear" size={20} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.categories}>
        <FlatList
          data={CATEGORIES}
          renderItem={renderCategoryItem}
          keyExtractor={item => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />
      </View>

      <View style={styles.sortOptions}>
        <Text style={styles.sortTitle}>Trier par :</Text>
        <TouchableOpacity 
          style={[styles.sortButton, sortBy === 'distance' && styles.sortButtonActive]}
          onPress={() => setSortBy('distance')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'distance' && styles.sortButtonTextActive]}>
            Distance
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.sortButton, sortBy === 'rating' && styles.sortButtonActive]}
          onPress={() => setSortBy('rating')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'rating' && styles.sortButtonTextActive]}>
            Évaluation
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredPlaces}
        renderItem={renderPlace}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.placesList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="search-location" size={40} color="#CCC" />
            <Text style={styles.emptyText}>Aucun résultat trouvé</Text>
          </View>
        }
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
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  backButton: {
    marginRight: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    marginLeft: 8,
  },
  categories: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  categoriesList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
  },
  categoryItemSelected: {
    backgroundColor: '#1A73E8',
  },
  categoryName: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
  categoryNameSelected: {
    color: 'white',
  },
  sortOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  sortTitle: {
    fontSize: 14,
    color: '#666',
    marginRight: 12,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  sortButtonActive: {
    backgroundColor: '#E8F0FE',
  },
  sortButtonText: {
    fontSize: 14,
    color: '#666',
  },
  sortButtonTextActive: {
    color: '#1A73E8',
    fontWeight: '500',
  },
  placesList: {
    padding: 12,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  placeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A73E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  placeAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  placeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeDistance: {
    fontSize: 13,
    color: '#1A73E8',
    fontWeight: '500',
    marginRight: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 2,
  },
  directionButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: '#999',
  },
});

export default POISearchScreen;