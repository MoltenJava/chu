import { View, Text, FlatList, Image, StyleSheet, RefreshControl, Dimensions, ActivityIndicator } from 'react-native';
import { useMenuItems } from '@/hooks/useMenuItems';
import { urlFor } from '@/lib/sanity';
import { SanityImage } from '@/types/sanity';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 10;
const CARD_WIDTH = SCREEN_WIDTH - (CARD_MARGIN * 2);

export default function HomeScreen() {
  const { items, loading, error, refresh } = useMenuItems(true); // true to use location

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#d9232a" />
        <Text style={styles.loadingText}>Finding delicious food near you...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorTitle}>Oops!</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubtext}>Showing all available items instead</Text>
      </View>
    );
  }

  const getImageUrl = (image: SanityImage) => {
    // If we have a direct URL from an expanded asset, use it
    if (image?.asset?.url) {
      return image.asset.url;
    }
    // Otherwise use the Sanity image URL builder with optimizations
    return urlFor(image, {
      width: CARD_WIDTH,
      quality: 90 // Higher quality for food images
    });
  };

  if (!items.length) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorTitle}>No Items Found</Text>
        <Text style={styles.errorText}>We couldn't find any food items at the moment.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image 
              source={{ 
                uri: getImageUrl(item.image)
              }} 
              style={styles.image}
            />
            <View style={styles.content}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.menuItem}>{item.menu_item}</Text>
              <Text style={styles.price}>${item.price.toFixed(2)}</Text>
            </View>
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    paddingVertical: 10,
  },
  card: {
    margin: CARD_MARGIN,
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  image: {
    width: CARD_WIDTH,
    height: 200,
    resizeMode: 'cover',
  },
  content: {
    padding: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  menuItem: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d9232a',
    marginTop: 5,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d9232a',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
