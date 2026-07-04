import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, FlatList, Image, TouchableOpacity, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Mock Data for the storefronts since we don't have Supabase DB populated yet.
const MOCK_STORES = [
  {
    id: '1',
    name: 'Açaí do Zé',
    brandColor: '#5b21b6', // Purple
    imageUrl: 'https://images.unsplash.com/photo-1590135891398-3860bb4787a2?auto=format&fit=crop&q=80&w=800',
    rating: 4.8,
    deliveryTime: '20-30 min',
    deliveryFee: 'Grátis',
  },
  {
    id: '2',
    name: 'Tropical Açaí & Sorvetes',
    brandColor: '#db2777', // Pink
    imageUrl: 'https://images.unsplash.com/photo-1555543419-f55db6c2de30?auto=format&fit=crop&q=80&w=800',
    rating: 4.5,
    deliveryTime: '15-25 min',
    deliveryFee: 'R$ 4,99',
  },
  {
    id: '3',
    name: 'Ponto do Açaí',
    brandColor: '#059669', // Emerald
    imageUrl: 'https://images.unsplash.com/photo-1596797882870-8c33dee32f14?auto=format&fit=crop&q=80&w=800',
    rating: 4.9,
    deliveryTime: '10-20 min',
    deliveryFee: 'R$ 2,00',
  }
];

export default function ClienteScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permissão de localização negada. Precisamos do GPS para achar lojas próximas.');
        setIsLoading(false);
        return;
      }

      let loc = await Location.getCurrentPositionAsync({});
      
      // Anti-Mock Geolocation Check
      if (loc.mocked) {
        Alert.alert("Aviso de Segurança", "Uso de GPS falso (Mock) detectado. Por favor, utilize sua localização real.");
        setErrorMsg('GPS Mock Detectado');
        setIsLoading(false);
        return;
      }

      setLocation(loc);
      setIsLoading(false);
    })();
  }, []);

  const renderStoreCard = ({ item }: { item: typeof MOCK_STORES[0] }) => (
    <TouchableOpacity activeOpacity={0.9} style={styles.cardContainer}>
      <View style={styles.cardShadow}>
        <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.cardGradient}
        >
          <View style={styles.cardContent}>
            <View style={styles.brandBadgeContainer}>
              <View style={[styles.brandBadge, { backgroundColor: item.brandColor }]} />
              <Text style={styles.storeName}>{item.name}</Text>
            </View>
            
            <View style={styles.storeInfoRow}>
              <View style={styles.infoBadge}>
                <Ionicons name="star" size={14} color="#fbbf24" />
                <Text style={styles.infoText}>{item.rating}</Text>
              </View>
              <View style={styles.infoBadge}>
                <Ionicons name="time-outline" size={14} color="#d1d5db" />
                <Text style={styles.infoText}>{item.deliveryTime}</Text>
              </View>
              <View style={styles.infoBadge}>
                <Ionicons name="bicycle-outline" size={14} color="#d1d5db" />
                <Text style={styles.infoText}>{item.deliveryFee}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5b21b6" />
        <Text style={styles.loadingText}>Buscando os melhores açaís...</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.centered}>
        <Ionicons name="location-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>{errorMsg}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.greetingText}>Olá, Cliente!</Text>
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={16} color="#5b21b6" />
            <Text style={styles.locationText} numberOfLines={1}>
              Entregar em: Atual ({location?.coords.latitude.toFixed(2)}, {location?.coords.longitude.toFixed(2)})
            </Text>
          </View>
        </View>
        <Text style={styles.headerTitle}>O que vamos pedir hoje?</Text>
      </View>

      <FlatList
        data={MOCK_STORES}
        keyExtractor={(item) => item.id}
        renderItem={renderStoreCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8fafc' 
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500'
  },
  errorText: { 
    color: '#ef4444', 
    fontSize: 16, 
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16
  },
  header: { 
    paddingHorizontal: 20, 
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  headerTop: {
    marginBottom: 12
  },
  greetingText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#5b21b6',
    fontWeight: '700',
    marginLeft: 4
  },
  headerTitle: { 
    color: '#0f172a', 
    fontSize: 28, 
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40
  },
  cardContainer: {
    marginBottom: 20,
  },
  cardShadow: {
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
    justifyContent: 'flex-end',
    padding: 16,
  },
  cardContent: {
    width: '100%',
  },
  brandBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  brandBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#ffffff'
  },
  storeName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4
  },
  storeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10
  },
  infoText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4
  }
});
