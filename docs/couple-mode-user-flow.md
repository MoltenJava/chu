# Couple Mode User Flow

## Overview

Couple Mode allows two users to swipe on food items together and find matches they both like. This document outlines the user flow and experience for this feature.

## User Flow

### 1. Initiating Couple Mode

1. **User A** navigates to the Couple Mode tab
2. **User A** sees two options:
   - "Create Session" button
   - "Join Session" button
3. **User A** taps "Create Session"
4. System generates a unique 6-digit session code
5. **User A** sees a confirmation screen with:
   - The session code
   - Copy and Share buttons for the code
   - "Start Swiping" button
6. **User A** taps "Start Swiping" to begin swiping on food items

### 2. Partner Joining

1. **User B** navigates to the Couple Mode tab
2. **User B** taps "Join Session"
3. **User B** enters the session code shared by User A
4. **User B** taps "Join"
5. **User A** receives a notification: "Your partner has joined the session!"
6. **User B** is taken directly to the swiping screen

### 3. Swiping Experience

1. Both users see the same food items in the same order
2. Users swipe left (dislike) or right (like) on food items
3. When a user swipes, their partner sees a subtle animation indicating the swipe
4. If both users swipe right on the same food item:
   - A match notification appears at the bottom of the screen
   - The notification shows the food item name and image
   - Delivery platform options appear below the notification
   - Users can tap "Keep Swiping" to continue or select a delivery platform

### 4. Match Management

1. Users can view all their matches by tapping "View Matches" button
2. The matches screen shows:
   - Food item images
   - Food item names and descriptions
   - Timestamp of when the match occurred
3. Users can tap on a match to see delivery options

### 5. Session Completion

1. Users can end the session at any time by tapping "End Session"
2. When a session ends:
   - Both users are returned to the Couple Mode home screen
   - A summary of matches is shown
   - Users can start a new session or join another one

## UI Components

### Session Creation Screen
- Clean, focused interface with the session code prominently displayed
- Copy and Share buttons for easy code sharing
- "Start Swiping" button to begin the experience

### Swiping Screen
- Food item cards with images and details
- Swipe left/right gestures
- Partner status indicator (online, swiping, offline)
- Match counter
- "View Matches" and "End Session" buttons

### Match Notification
- Animated toast that slides up from the bottom
- Food item image and name
- Delivery platform options
- "Keep Swiping" button

### Matches Screen
- List of all matched food items
- Food item details and images
- Delivery platform options for each match

## Technical Considerations

1. **Real-time Updates**
   - Use Supabase real-time subscriptions for partner status and swipes
   - Implement presence tracking to show when partners are online

2. **Match Detection**
   - Use database triggers to detect when both users like the same item
   - Send real-time notifications when matches occur

3. **Session Management**
   - Store session state in the database
   - Allow users to rejoin active sessions if they disconnect

4. **Performance**
   - Implement throttling for partner swipe animations
   - Cache food item data to reduce loading times

## Future Enhancements

1. **Match Categories**
   - Group matches by cuisine type or dietary preferences
   - Allow users to filter matches

2. **Social Features**
   - Share matches on social media
   - Save favorite matches for future reference

3. **Advanced Matching**
   - Consider dietary restrictions when showing food items
   - Prioritize food items based on previous matches

4. **Session History**
   - View past sessions and matches
   - Compare match patterns over time 