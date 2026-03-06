import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { usePathname, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { stockAPI } from "../../services/api";
import { checkAndNotify } from "../../services/notificationService";

const Header = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [notificationCount, setNotificationCount] = useState(0);

  // Map router paths to display titles
  const getPageTitle = (path) => {
    switch (path) {
      case "/":
      case "/index":
        return "Dashboard";
      case "/transaction":
        return "Transactions";
      case "/analytics":
        return "Analytics";
      case "/inventory":
        return "Inventory";
      case "/profile":
        return "Profile";
      case "/Notification":
        return "Notifications";
      default:
        return "Create your style";
    }
  };

  useFocusEffect(
    useCallback(() => {
      const fetchNotifications = async () => {
        try {
          const response = await stockAPI.getLowStock();
          if (response && response.success) {
            setNotificationCount(response.count || 0);
          }
          // Fire phone push notifications for new alerts (if enabled)
          await checkAndNotify();
        } catch (error) {
          console.error("Error fetching notifications:", error);
        }
      };

      fetchNotifications();
    }, [])
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBackground}>
        <Text style={styles.headerTitle}>{getPageTitle(pathname)}</Text>

        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push("/Notification")}
        >
          <Ionicons name="notifications-outline" size={25} color="#1a1a1a" />
          {notificationCount > 0 && (
            <View style={styles.notificationDot}>
              <Text style={styles.notificationText}>
                {notificationCount > 9 ? "9+" : notificationCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    zIndex: 10,
  },
  headerBackground: {
    height: 100,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  headerTitle: {
    marginTop: -1,
    fontSize: 22,
    color: "#1a1a1a",
    fontFamily: "Poppins",
  },
  notificationButton: {
    position: "relative",
    bottom: 3,
    padding: 8,
    zIndex: 10,
  },
  notificationDot: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    backgroundColor: "#FF3B30",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#AD7F65",
  },
  notificationText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
});

export default Header;
