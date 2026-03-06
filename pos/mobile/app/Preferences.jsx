import { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import {
  isNotificationsEnabled,
  requestPermissions,
  setNotificationsEnabled,
  setupNotificationChannel,
} from "../services/notificationService";

export default function SettingsScreen() {
  const [notifications, setNotifications] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load persisted preference on mount
  useEffect(() => {
    (async () => {
      const enabled = await isNotificationsEnabled();
      setNotifications(enabled);
      setLoading(false);
    })();
  }, []);

  const toggleNotifications = async () => {
    const newValue = !notifications;

    if (newValue) {
      // Request permission first
      await setupNotificationChannel();
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "Please enable notifications in your device settings to receive stock alerts.",
          [{ text: "OK" }]
        );
        return;
      }
    }

    setNotifications(newValue);
    await setNotificationsEnabled(newValue);
  };

  if (loading) return null;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: "#FAF6F2" },
      ]}
    >
      {/* Notifications Switch */}
      <View style={styles.switchContainer}>
        <View>
          <Text style={styles.label}>Push Notifications</Text>
          <Text style={styles.sublabel}>
            {notifications ? "You will receive stock alerts" : "Notifications are off"}
          </Text>
        </View>
        <Switch
          trackColor={{ false: "#ccc", true: "#16a34a" }}
          thumbColor="#fff"
          value={notifications}
          onValueChange={toggleNotifications}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  sublabel: {
    fontSize: 12,
    color: "#999",
    marginTop: 3,
  },
});
