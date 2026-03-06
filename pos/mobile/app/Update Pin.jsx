import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { router } from "expo-router";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert
} from "react-native";
import { employeeAPI } from "../services/api";

export default function UpdatePin() {
  const navigation = useNavigation();

  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [rePin, setRePin] = useState("");

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showRe, setShowRe] = useState(false);

  const [message, setMessage] = useState("");
  const [messageColor, setMessageColor] = useState("red");
  const [successModal, setSuccessModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const PIN_LENGTH = 6;

  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem("currentEmployee");
        if (stored) {
          setCurrentUser(JSON.parse(stored));
        }
      } catch (error) {
        console.error("Failed to load user:", error);
      }
    };
    loadUser();
  }, []);

  const handleConfirm = async () => {
    setMessage("");

    if (!currentUser) {
      setMessage("User session not found. Please re-login.");
      setMessageColor("red");
      return;
    }

    // 1. Validate Form Inputs
    if (oldPin.length !== PIN_LENGTH) {
      setMessage(`Old PIN must be ${PIN_LENGTH} digits.`);
      setMessageColor("red");
      return;
    }

    if (newPin.length !== PIN_LENGTH) {
      setMessage(`New PIN must be ${PIN_LENGTH} digits.`);
      setMessageColor("red");
      return;
    }

    if (newPin !== rePin) {
      setMessage("New PIN and Re-enter PIN do not match.");
      setMessageColor("red");
      return;
    }

    if (oldPin === newPin) {
      setMessage("New PIN cannot be the same as the old PIN.");
      setMessageColor("red");
      return;
    }

    try {
      setLoading(true);
      const employeeId = currentUser._id || currentUser.id;

      // 2. Verify Old PIN
      const verifyRes = await employeeAPI.verifyPin(oldPin, employeeId);

      if (!verifyRes || !verifyRes.success) {
        setMessage("Incorrect Old PIN.");
        setMessageColor("red");
        setLoading(false);
        return;
      }

      // 3. Update to New PIN
      // Backend expects: { pin: newPin } or { newPin: newPin }
      // We'll send both to be safe, but controller checks `newPin || pin`
      const updateRes = await employeeAPI.updatePin(employeeId, {
        pin: newPin,
        newPin: newPin
      });

      if (updateRes && updateRes.success) {
        setSuccessModal(true);
        setTimeout(() => {
          setSuccessModal(false);
          router.back();
        }, 1500);
      } else {
        setMessage(updateRes?.message || "Failed to update PIN.");
        setMessageColor("red");
      }

    } catch (error) {
      console.error("Update PIN error:", error);
      setMessage("An error occurred. Please try again.");
      setMessageColor("red");
    } finally {
      setLoading(false);
    }
  };

  const PinField = ({ value, setValue, show, setShow, label }) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          value={value}
          onChangeText={(text) => {
            if (text.length <= PIN_LENGTH) setValue(text);
          }}
          secureTextEntry={!show}
          keyboardType="numeric"
          maxLength={PIN_LENGTH}
          style={styles.input}
          editable={!loading}
        />

        <TouchableOpacity onPress={() => setShow(!show)}>
          <Ionicons
            name={show ? "eye" : "eye-off"}
            size={22}
            color="#444"
            style={{ paddingRight: 10 }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header / Back Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Update Pincode</Text>
      </View>

      <View style={styles.content}>
        <PinField
          label="Old PIN"
          value={oldPin}
          setValue={setOldPin}
          show={showOld}
          setShow={setShowOld}
        />

        <PinField
          label="New PIN"
          value={newPin}
          setValue={setNewPin}
          show={showNew}
          setShow={setShowNew}
        />

        <PinField
          label="Re-enter New PIN"
          value={rePin}
          setValue={setRePin}
          show={showRe}
          setShow={setShowRe}
        />

        {message !== "" && (
          <Text style={[styles.message, { color: messageColor }]}>{message}</Text>
        )}

        <TouchableOpacity
          style={[styles.confirmBtn, loading && styles.disabledBtn]}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.confirmText}>Confirm Change</Text>
          )}
        </TouchableOpacity>

        {/* Instruction / Description below Confirm button */}
        <Text style={styles.instruction}>
          Enter your current 6-digit PIN to verify your identity, then create and confirm a new 6-digit PIN.
        </Text>
      </View>

      {/* SUCCESS POP NOTIFICATION */}
      <Modal transparent visible={successModal} animationType="fade">
        <View style={styles.modalWrapper}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-circle" size={50} color="green" />
            <Text style={styles.successText}>PIN updated successfully!</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50, // Status bar
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 15,
    color: '#333',
  },
  content: {
    padding: 25,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
    color: '#444',
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#FAFAFA',
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 18,
    letterSpacing: 3,
    color: '#333',
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 15,
    fontWeight: "500",
  },
  confirmBtn: {
    backgroundColor: "#AD7F65",
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  disabledBtn: {
    opacity: 0.7,
  },
  confirmText: {
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  instruction: {
    marginTop: 20,
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  modalWrapper: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
    width: '80%',
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  successText: {
    marginTop: 15,
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
});
