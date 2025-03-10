# **Product Requirements Document (PRD): Tinder for Food App**

---

## **1. Project Overview**

### **1.1 Summary**
Tinder for Food is a mobile application that allows users to swipe through restaurant dishes, similar to a dating app. Users can swipe right to like a dish (which saves it and provides an ordering link) or left to skip. The app integrates with Google Places API to fetch images and descriptions of food from restaurants and links users to Uber Eats/Postmates for ordering.

### **1.2 Goals**
- Provide an engaging, swipe-based experience for discovering food.
- Enable users to order food seamlessly from Uber Eats or Postmates.
- Learn user preferences over time to improve recommendations.
- Ensure a smooth and responsive UI with real-time API calls.

### **1.3 Target Audience**
- Users who enjoy discovering new foods visually.
- Busy individuals who want a fun way to choose their next meal.
- Food delivery users who want a more interactive selection process.

### **1.4 Platforms**
- **Mobile:** React Native (iOS & Android)

---

## **2. Features**

### **2.1 Swipeable Food Cards**
- Users swipe through food images (right to like, left to skip).
- Dishes are fetched dynamically via the Google Places API.

### **2.2 Ordering Integration**
- When a user swipes right, they receive an order link via Uber Eats/Postmates API.

### **2.3 User Preferences & Favorites**
- Save liked dishes for later.
- Track user swiping behavior to refine recommendations.

### **2.4 Filtering Options**
- Users can filter based on cuisine, price, dietary restrictions.

### **2.5 Location-Based Recommendations**
- Show restaurants within a configurable radius of the user.

### **2.6 Authentication & User Profiles**
- Users can create accounts to save preferences and history.
- Login via Firebase Authentication (Google, Apple, Email/Password).

---

## **3. Requirements for Each Feature**

### **3.1 Swipeable Food Cards**
#### **Dependencies:**
- Google Places API (for fetching restaurant food images)
- React Native Gesture Handler (for swipe gestures)

#### **Implementation Details:**
- Fetch and display food images.
- Implement swipe gestures.
- Store user actions (swipe left/right).

### **3.2 Ordering Integration**
#### **Dependencies:**
- Uber Eats API / Postmates API (or Google Search for backup links)

#### **Implementation Details:**
- If Uber Eats API is available, fetch ordering link for the dish.
- If not, use a Google Search query (`{dish name} site:ubereats.com`).
- Display "Order Now" button after right swipe.

### **3.3 User Preferences & Favorites**
#### **Dependencies:**
- Firebase Firestore (to store liked dishes per user)

#### **Implementation Details:**
- Store liked dish IDs.
- Allow users to view their liked dishes.
- Use swipe data to recommend better matches.

### **3.4 Filtering Options**
#### **Dependencies:**
- User input for filtering.

#### **Implementation Details:**
- Allow selection of cuisine, price range, dietary preferences.
- Modify API requests based on filters.

### **3.5 Location-Based Recommendations**
#### **Dependencies:**
- Google Places API (for finding restaurants near the user)
- React Native Geolocation (for user location)

#### **Implementation Details:**
- Fetch user location.
- Show dishes from restaurants within the radius.

### **3.6 Authentication & User Profiles**
#### **Dependencies:**
- Firebase Authentication

#### **Implementation Details:**
- Allow Google, Apple, and email login.
- Store user preferences in Firestore.

---

## **4. Data Models**

### **4.1 User Model**
```json
{
  "userId": "string",
  "name": "string",
  "email": "string",
  "likedDishes": ["dishId1", "dishId2"],
  "preferences": {
    "cuisine": ["string"],
    "priceRange": "string",
    "dietaryRestrictions": ["string"]
  }
}
```

### **4.2 Dish Model**
```json
{
  "dishId": "string",
  "name": "string",
  "imageUrl": "string",
  "restaurant": {
    "name": "string",
    "placeId": "string"
  },
  "orderLink": "string"
}
```

---

## **5. API Contract**

### **5.1 Fetch Nearby Restaurants (Google Places API)**
**Endpoint:**
```
GET https://maps.googleapis.com/maps/api/place/nearbysearch/json
```
**Parameters:**
- `location`: `{lat},{lng}`
- `radius`: `5000` (meters)
- `type`: `restaurant`
- `key`: `{GOOGLE_API_KEY}`

**Response:**
```json
{
  "results": [
    {
      "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
      "name": "Sushi Place",
      "photos": [
        {
          "photo_reference": "CnRn9pHkj8HQ..."
        }
      ]
    }
  ]
}
```

### **5.2 Fetch Dish Image (Google Places API)**
**Endpoint:**
```
GET https://maps.googleapis.com/maps/api/place/photo
```
**Parameters:**
- `maxwidth=400`
- `photoreference={PHOTO_REFERENCE}`
- `key={GOOGLE_API_KEY}`

### **5.3 Fetch Ordering Link (Uber Eats API or Fallback)**
**Uber Eats API (if available):**
```
GET https://api.ubereats.com/v1/search
```
**Fallback (Google Search Query):**
```
https://www.google.com/search?q={dish_name}+site:ubereats.com
```

### **5.4 Store User Data (Firebase Firestore API)**
**Endpoint:**
```
POST https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/users
```
**Body:**
```json
{
  "fields": {
    "userId": {"stringValue": "12345"},
    "likedDishes": {"arrayValue": {"values": [{"stringValue": "dishId1"}]}}
  }
}
```

---

## **6. Summary of Dependencies**
| Dependency | Purpose |
|------------|----------|
| React Native | Mobile framework |
| Expo | Development framework |
| Firebase Auth | User authentication |
| Firebase Firestore | Database |
| Google Places API | Restaurant & dish images |
| Uber Eats API | Ordering links |
| React Native Gesture Handler | Swipe gestures |
| Axios | API requests |

---

## **Next Steps**
1. Build the frontend UI.
2. Implement Google Places API integration.
3. Integrate Uber Eats/Postmates ordering.
4. Add Firebase for user authentication and data storage.
5. Launch MVP.

