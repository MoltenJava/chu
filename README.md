# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Integrating AWS S3 Images and Restaurant Metadata

This app supports loading real restaurant data and images from AWS S3. Follow these steps to integrate your S3 data:

1. Update the S3 bucket URL in `utils/metadataService.ts`:

   ```typescript
   const S3_BASE_URL = 'https://your-s3-bucket-name.s3.amazonaws.com';
   ```

2. Make sure your `westwood_restaurant_metadata.json` file follows this format:

   ```json
   [
     {
       "id": "unique-id-1",
       "name": "Dish Name",
       "description": "Dish description",
       "image_path": "/path/to/image.jpg",
       "restaurant": "Restaurant Name",
       "price_level": "2",
       "cuisine_type": "Italian",
       "food_types": ["dinner", "comfort"],
       "delivery_services": ["UberEats", "Postmates"]
     }
   ]
   ```

3. Download the metadata file locally (for development and testing):

   ```bash
   node scripts/downloadMetadata.js
   ```

4. The app will automatically use the real data when available, falling back to mock data if needed.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
