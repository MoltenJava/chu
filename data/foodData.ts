import { FoodItem } from '../types/food';

export const foodData: FoodItem[] = [
  {
    id: '1',
    name: 'Spicy Ramen',
    description: 'Authentic Japanese ramen with spicy miso broth, topped with soft-boiled egg and green onions',
    imageUrl: 'https://images.unsplash.com/photo-1557872943-16a5ac26437e?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    restaurant: 'Ramen House',
    price: '$$',
    cuisine: 'Japanese',
    foodType: ['spicy', 'dinner', 'comfort']
  },
  {
    id: '2',
    name: 'Classic Cheeseburger',
    description: 'Juicy beef patty with melted cheddar cheese, lettuce, tomato, and special sauce',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    restaurant: 'Burger Joint',
    price: '$',
    cuisine: 'American',
    foodType: ['comfort', 'lunch', 'fast-food']
  },
  {
    id: '3',
    name: 'Margherita Pizza',
    description: 'Traditional Neapolitan pizza with tomato sauce, fresh mozzarella, and basil',
    imageUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    restaurant: 'Pizzeria Bella',
    price: '$$',
    cuisine: 'Italian',
    foodType: ['comfort', 'dinner', 'lunch']
  },
  {
    id: '4',
    name: 'Butter Chicken',
    description: 'Tender chicken in a rich and creamy tomato-based curry sauce',
    imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    restaurant: 'Taj Spice',
    price: '$$',
    cuisine: 'Indian',
    foodType: ['spicy', 'dinner', 'comfort']
  },
  {
    id: '5',
    name: 'Avocado Toast',
    description: 'Sourdough toast topped with mashed avocado, poached eggs, and red pepper flakes',
    imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    restaurant: 'Brunch Café',
    price: '$$',
    cuisine: 'Breakfast',
    foodType: ['healthy', 'breakfast', 'vegan']
  },
  {
    id: '6',
    name: 'Sushi Platter',
    description: 'Assortment of fresh nigiri and maki rolls with premium fish',
    imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    restaurant: 'Sushi Delight',
    price: '$$$',
    cuisine: 'Japanese',
    foodType: ['healthy', 'dinner', 'seafood']
  },
  {
    id: '7',
    name: 'Pasta Carbonara',
    description: 'Creamy pasta with pancetta, egg, black pepper, and Parmesan cheese',
    imageUrl: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    restaurant: 'Trattoria Milano',
    price: '$$',
    cuisine: 'Italian',
    foodType: ['comfort', 'dinner', 'lunch']
  },
  {
    id: '8',
    name: 'Chicken Tacos',
    description: 'Soft corn tortillas filled with grilled chicken, salsa, and fresh cilantro',
    imageUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    restaurant: 'Taqueria Fuego',
    price: '$',
    cuisine: 'Mexican',
    foodType: ['spicy', 'lunch', 'dinner']
  },
  {
    id: '9',
    name: 'Chocolate Lava Cake',
    description: 'Warm chocolate cake with a molten center, served with vanilla ice cream',
    imageUrl: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    restaurant: 'Sweet Indulgence',
    price: '$$',
    cuisine: 'Dessert',
    foodType: ['dessert', 'comfort']
  },
  {
    id: '10',
    name: 'Greek Salad',
    description: 'Fresh salad with tomatoes, cucumbers, olives, feta cheese, and olive oil dressing',
    imageUrl: 'https://images.unsplash.com/photo-1515697320591-f3eb3566dd75?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    restaurant: 'Mediterranean Bistro',
    price: '$$',
    cuisine: 'Greek',
    foodType: ['healthy', 'lunch', 'vegan']
  },
  {
    id: '11',
    name: 'BBQ Ribs',
    description: 'Slow-cooked pork ribs with smoky barbecue sauce and coleslaw',
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    restaurant: 'Smokey\'s BBQ',
    price: '$$',
    cuisine: 'American',
    foodType: ['comfort', 'dinner']
  },
  {
    id: '12',
    name: 'Pad Thai',
    description: 'Stir-fried rice noodles with tofu, bean sprouts, peanuts, and lime',
    imageUrl: 'https://images.unsplash.com/photo-1559314809-0d155014e29e?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    restaurant: 'Thai Spice',
    price: '$$',
    cuisine: 'Thai',
    foodType: ['spicy', 'lunch', 'dinner']
  },
  {
    id: '13',
    name: 'Beef Pho',
    description: 'Vietnamese noodle soup with thin slices of beef, herbs, and bean sprouts',
    imageUrl: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    restaurant: 'Pho Delight',
    price: '$$',
    cuisine: 'Vietnamese',
    foodType: ['comfort', 'lunch', 'dinner']
  },
  {
    id: '14',
    name: 'Eggs Benedict',
    description: 'Poached eggs and Canadian bacon on English muffins, topped with hollandaise sauce',
    imageUrl: 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    restaurant: 'Morning Glory',
    price: '$$',
    cuisine: 'Breakfast',
    foodType: ['breakfast', 'comfort']
  },
  {
    id: '15',
    name: 'Lobster Roll',
    description: 'Fresh lobster meat tossed with mayo and lemon on a buttered roll',
    imageUrl: 'https://images.unsplash.com/photo-1569494315581-13c088a7ddc0?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80',
    restaurant: 'Seaside Shack',
    price: '$$$',
    cuisine: 'Seafood',
    foodType: ['seafood', 'lunch']
  }
]; 