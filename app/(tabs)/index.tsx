import { View, Text, FlatList, Image, StyleSheet, RefreshControl, Dimensions, ActivityIndicator } from 'react-native';
import { useMenuItems } from '@/hooks/useMenuItems';
import { SanityMenuItem } from '@/types/sanity';

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

  if (!items.length) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorTitle}>No Items Found</Text>
        <Text style={styles.errorText}>We couldn't find any food items at the moment.</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: SanityMenuItem }) => {
    console.log('Rendering item:', {
      id: item._id,
      title: item.title,
      s3_url: item.s3_url,
      price: item.price
    });

    const priceDisplay = item.price != null ? `$${item.price.toFixed(2)}` : 'Price not available';

    return (
      <View style={styles.card}>
        <Image 
          source={{ uri: item.s3_url }}
          style={styles.image}
          onError={(e) => console.error('Image loading error:', e.nativeEvent.error)}
        />
        <View style={styles.content}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.menuItem}>{item.menu_item}</Text>
          <Text style={[styles.price, !item.price && styles.priceUnavailable]}>{priceDisplay}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
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
  priceUnavailable: {
    color: '#999',
    fontStyle: 'italic',
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
