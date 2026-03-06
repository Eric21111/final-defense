import * as Notifications from "expo-notifications";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { Image, useWindowDimensions } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
import { DataProvider } from "@/context/DataContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { setupNotificationChannel } from "@/services/notificationService";

// Show notifications even when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Set up notification channel on app start
  useEffect(() => {
    setupNotificationChannel();
  }, []);

  return (
    <DataProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            height: 60,
            paddingTop: 8,
            paddingBottom: 8,
            borderTopWidth: 0,
            elevation: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            backgroundColor: '#fff',
            display: isLandscape ? 'none' : 'flex',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "",
            tabBarIcon: ({ focused }) => (
              <Image
                source={
                  focused
                    ? require("../(tabs)/iconz/home-active.png") // when active
                    : require("../(tabs)/iconz/home-inactive.png") // when inactive
                }
                style={{ width: 28, height: 28, marginTop: 8 }}
                resizeMode="contain"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="transaction"
          options={{
            title: "",
            tabBarIcon: ({ focused }) => (
              <Image
                source={
                  focused
                    ? require("../(tabs)/iconz/transaction-active.png") // when active
                    : require("../(tabs)/iconz/transaction-inactive.png") // when inactive
                }
                style={{ width: 28, height: 28, marginTop: 8 }}
                resizeMode="contain"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: "",
            tabBarIcon: ({ focused }) => (
              <Image
                source={
                  focused
                    ? require("../(tabs)/iconz/analytics-active.png") // when active
                    : require("../(tabs)/iconz/analytics-inactive.png") // when inactive
                }
                style={{ width: 28, height: 28, marginTop: 8 }}
                resizeMode="contain"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: "",
            tabBarIcon: ({ focused }) => (
              <Image
                source={
                  focused
                    ? require("../(tabs)/iconz/basket-active.png") // when active
                    : require("../(tabs)/iconz/basket-inactive.png") // when inactive
                }
                style={{ width: 28, height: 28, marginTop: 8 }}
                resizeMode="contain"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "",
            tabBarIcon: ({ focused }) => (
              <Image
                source={
                  focused
                    ? require("../(tabs)/iconz/profile-active.png") // when active
                    : require("../(tabs)/iconz/profile-inactive.png") // when inactive
                }
                style={{ width: 28, height: 28, marginTop: 8 }}
                resizeMode="contain"
              />
            ),
          }}
        />
      </Tabs>
    </DataProvider>
  );
}
