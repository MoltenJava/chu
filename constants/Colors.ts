/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

// Rustic Palm Springs color palette - wood, charcoal, and desert inspired
const rustWheat = '#E5D3B3';       // Light tan/wheat color
const rustWood = '#A67C52';        // Medium wood tone
const rustBark = '#715031';        // Darker wood/bark
const rustCharcoal = '#3A3A3A';    // Charcoal gray
const rustEmber = '#BF5942';       // Ember/burnt orange accent
const rustSand = '#DDC9A3';        // Lighter sand color
const rustShadow = '#292522';      // Dark shadow color for text

// Keeping backward compatibility
const tintColorLight = rustEmber;
const tintColorDark = rustSand;

export const Colors = {
  light: {
    text: rustShadow,
    background: rustWheat,
    tint: rustEmber,
    icon: rustBark,
    tabIconDefault: '#BDB19F',
    tabIconSelected: rustEmber,
    border: rustWood,
    primary: rustEmber,
    secondary: rustWood,
    accent: rustBark,
    cardBackground: rustSand,
    headerBackground: rustSand,
  },
  dark: {
    text: rustSand,
    background: rustShadow,
    tint: rustEmber,
    icon: rustSand,
    tabIconDefault: '#71635A',
    tabIconSelected: rustEmber,
    border: rustBark,
    primary: rustEmber,
    secondary: rustWood,
    accent: rustSand,
    cardBackground: rustCharcoal,
    headerBackground: rustCharcoal,
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ColorName = keyof typeof Colors.light;
