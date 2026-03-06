import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import config from "../config/api";
import { employeeAPI } from "../services/api";

export default function PinLogin() {
  const [pin, setPin] = useState("");
  const PIN_LENGTH = 6;
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const router = useRouter();

  // Warm up the backend connection while user is looking at the PIN screen
  useEffect(() => {
    fetch(`${config.API_URL}/ping`).catch(() => { });
    checkBiometricOnMount();
  }, []);

  // Check if biometric login is available and enabled on mount
  const checkBiometricOnMount = async () => {
    try {
      if (!LocalAuthentication?.hasHardwareAsync) return;
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const hasBiometric = hasHardware && isEnrolled;
      setBiometricAvailable(hasBiometric);

      if (!hasBiometric) return;

      const enabled = await AsyncStorage.getItem('@biometric_enabled');
      if (enabled === 'true') {
        setBiometricEnabled(true);
        // Auto-trigger biometric login
        attemptBiometricLogin();
      }
    } catch (error) {
      // Silently disable biometrics if not available
      setBiometricAvailable(false);
    }
  };

  // Attempt biometric authentication for login
  const attemptBiometricLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify to login',
        cancelLabel: 'Use PIN',
        disableDeviceFallback: false,
      });

      if (result.success) {
        // Load stored employee data and navigate
        const storedEmployee = await AsyncStorage.getItem('currentEmployee');
        if (storedEmployee) {
          router.replace("/(tabs)");
        } else {
          // No stored employee — need PIN login first
          console.log('No stored employee data, falling back to PIN');
        }
      }
      // If failed/cancelled, user stays on PIN screen
    } catch (error) {
      console.error('Biometric auth error:', error);
    }
  };

  const handleKeyPress = (value: string) => {
    if (value === "del") {
      setPin(pin.slice(0, -1));
    } else if (pin.length < PIN_LENGTH) {
      setPin(pin + value);
    }
  };

  const handleLogin = async () => {
    if (pin.length !== PIN_LENGTH) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      // Use verifyOwnerPin which only accepts owner accounts
      const response = await employeeAPI.verifyOwnerPin(pin);

      if (response.success && response.data) {
        // Store owner employee data for later use (also needed for biometric login)
        await AsyncStorage.setItem('currentEmployee', JSON.stringify(response.data));

        // Check if we should ask about biometrics
        if (biometricAvailable) {
          const alreadyAsked = await AsyncStorage.getItem('@biometric_asked');
          if (alreadyAsked !== 'true') {
            // Show the biometric enable modal
            setShowBiometricModal(true);
            setIsLoading(false);
            return;
          }
        }

        router.replace("/(tabs)");
      } else {
        setErrorMessage(response.message || "Invalid PIN. Only owner account can access the mobile app.");
        setShowModal(true);
        setPin("");
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrorMessage((error as any).message || "Failed to verify PIN. Please check your connection.");
      setShowModal(true);
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle biometric enable - Allow
  const handleBiometricAllow = async () => {
    setShowBiometricModal(false);

    try {
      // Verify the user with biometrics right now
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity',
        cancelLabel: 'Cancel',
        disableDeviceFallback: true,
      });

      if (result.success) {
        await AsyncStorage.setItem('@biometric_enabled', 'true');
        await AsyncStorage.setItem('@biometric_asked', 'true');
        setBiometricEnabled(true);
      } else {
        // Verification failed, still mark as asked
        await AsyncStorage.setItem('@biometric_asked', 'true');
      }
    } catch (error) {
      console.error('Biometric setup error:', error);
      await AsyncStorage.setItem('@biometric_asked', 'true');
    }

    router.replace("/(tabs)");
  };

  // Handle biometric enable - Not Now
  const handleBiometricSkip = async () => {
    setShowBiometricModal(false);
    await AsyncStorage.setItem('@biometric_asked', 'true');
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.container}>
      {/* HEADER IMAGE */}
      <View style={styles.header}>
        <Image
          source={require("../app/(tabs)/iconz/pinbg.png")}
          style={styles.headerImage}
          resizeMode="cover"
        />
      </View>

      {/* WHITE CARD */}
      <View style={styles.card}>
        <Text style={styles.title}>Enter your PIN</Text>

        <View style={styles.pinContainer}>
          {Array.from({ length: PIN_LENGTH }, (_, i) => i).map((i) => (
            <View
              key={i}
              style={[
                styles.pinBox,
                pin[i] ? styles.pinBoxFilled : null
              ]}
            >
              <Text style={[styles.pinText, pin[i] ? styles.pinFilled : null]}>{pin[i] ? "•" : ""}</Text>
            </View>
          ))}
        </View>

        <View style={styles.keypad}>
          {[
            ["1", "2", "3"],
            ["4", "5", "6"],
            ["7", "8", "9"],
            [biometricEnabled ? "bio" : "empty", "0", "del"],
          ].map((row, rIdx) => (
            <View key={rIdx} style={styles.keypadRow}>
              {row.map((key) => (
                key === "empty" ? (
                  <View key={key} style={[styles.key, { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 }]} />
                ) : key === "bio" ? (
                  <TouchableOpacity
                    key={key}
                    style={[styles.key, { backgroundColor: '#f0f7f0' }]}
                    onPress={attemptBiometricLogin}
                  >
                    <Text style={{ fontSize: 26 }}>🔒</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    key={key}
                    style={styles.key}
                    onPress={() => handleKeyPress(key)}
                  >
                    <Text style={styles.keyText}>
                      {key === "del" ? "⌫" : key}
                    </Text>
                  </TouchableOpacity>
                )
              ))}
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.loginButton,
            (pin.length !== 6 || isLoading) && styles.loginButtonDisabled,
          ]}
          disabled={pin.length !== 6 || isLoading}
          onPress={handleLogin}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>LOGIN</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Error Modal */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Incorrect PIN</Text>
            <Text style={styles.modalMessage}>
              {errorMessage || "The PIN you entered is incorrect. Please try again."}
            </Text>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Biometric Enable Modal */}
      <Modal visible={showBiometricModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🔐</Text>
            <Text style={styles.modalTitle}>Want to use phone biometrics?</Text>
            <Text style={styles.modalMessage}>
              Use your fingerprint or face to login faster next time. You can always change this in settings.
            </Text>

            <View style={styles.biometricButtons}>
              <TouchableOpacity
                style={[styles.biometricBtn, styles.biometricBtnSkip]}
                onPress={handleBiometricSkip}
              >
                <Text style={styles.biometricBtnSkipText}>Not Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.biometricBtn, styles.biometricBtnAllow]}
                onPress={handleBiometricAllow}
              >
                <Text style={styles.biometricBtnAllowText}>Allow</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111",
  },
  header: {
    height: "30%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  headerImage: {
    width: "100%",
    height: "100%",
  },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: -30,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    alignItems: "center",
    paddingTop: 40,
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#000",
  },
  pinContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  pinBox: {
    width: 42,
    height: 48,
    borderRadius: 6,
    marginHorizontal: 4,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  pinBoxFilled: {
    borderColor: "#333",
  },
  pinFilled: {
    color: "#000",
  },
  pinText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    textAlign: "center",
  },
  keypad: {
    marginBottom: 12,
  },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 8,
  },
  key: {
    width: 65,
    height: 65,
    marginHorizontal: 10,
    backgroundColor: "#F5F5F5",
    borderRadius: 32.5,
    justifyContent: "center",
    alignItems: "center",
  },
  keyText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#000",
  },
  loginButton: {
    width: "65%",
    backgroundColor: "rgb(38, 38, 38)",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    alignSelf: "center",
    marginTop: 10,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    width: "80%",
    borderRadius: 20,
    padding: 25,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#7C4A21",
    marginBottom: 10,
    textAlign: "center",
  },
  modalMessage: {
    textAlign: "center",
    fontSize: 16,
    color: "#555",
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: "#8b5e39ff",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 30,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  biometricButtons: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    gap: 12,
  },
  biometricBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  biometricBtnSkip: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  biometricBtnSkipText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "600",
  },
  biometricBtnAllow: {
    backgroundColor: "#1f1f1f",
  },
  biometricBtnAllowText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
