import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const INITIAL_PRODUCTS = [
  {
    id: '1',
    name: 'Açaí Tradicional 500ml',
    description: 'Açaí puro com granola e banana.',
    price: 18.90,
    promotionalPrice: 15.90,
    imageUrl: 'https://images.unsplash.com/photo-1590135891398-3860bb4787a2?auto=format&fit=crop&q=80&w=200',
    isActive: true,
  },
  {
    id: '2',
    name: 'Açaí Turbinado 700ml',
    description: 'Açaí com morango, leite condensado, paçoca e nutella.',
    price: 28.50,
    promotionalPrice: null,
    imageUrl: 'https://images.unsplash.com/photo-1555543419-f55db6c2de30?auto=format&fit=crop&q=80&w=200',
    isActive: true,
  },
  {
    id: '3',
    name: 'Copo da Felicidade',
    description: 'Camadas de açaí, creme de ninho e brownie.',
    price: 32.00,
    promotionalPrice: null,
    imageUrl: 'https://images.unsplash.com/photo-1596797882870-8c33dee32f14?auto=format&fit=crop&q=80&w=200',
    isActive: false,
  }
];

export default function ProdutosScreen() {
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const brandColor = '#5b21b6'; // Simulated brand color context

  const renderProduct = ({ item }: { item: typeof INITIAL_PRODUCTS[0] }) => (
    <View style={[styles.productCard, !item.isActive && styles.productCardInactive]}>
      <Image source={{ uri: item.imageUrl }} style={styles.productImage} />
      
      <View style={styles.productInfo}>
        <View style={styles.titleRow}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: item.isActive ? '#dcfce7' : '#f1f5f9' }]}>
            <Text style={[styles.statusText, { color: item.isActive ? '#166534' : '#64748b' }]}>
              {item.isActive ? 'Ativo' : 'Pausado'}
            </Text>
          </View>
        </View>
        
        <Text style={styles.productDescription} numberOfLines={2}>{item.description}</Text>
        
        <View style={styles.priceRow}>
          {item.promotionalPrice ? (
            <>
              <Text style={styles.promoPrice}>R$ {item.promotionalPrice.toFixed(2)}</Text>
              <Text style={styles.originalPriceStrikethrough}>R$ {item.price.toFixed(2)}</Text>
            </>
          ) : (
            <Text style={styles.price}>R$ {item.price.toFixed(2)}</Text>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.editButton}>
        <Ionicons name="pencil" size={20} color="#64748b" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[brandColor, brandColor + 'E6']}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Catálogo</Text>
            <Text style={styles.headerSubtitle}>{products.length} produtos cadastrados</Text>
          </View>
          <TouchableOpacity style={styles.addButton}>
            <Ionicons name="add" size={24} color={brandColor} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  addButton: {
    width: 48,
    height: 48,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  productCardInactive: {
    opacity: 0.6,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  productDescription: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  promoPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
    marginRight: 6,
  },
  originalPriceStrikethrough: {
    fontSize: 12,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  editButton: {
    padding: 8,
  },
});
