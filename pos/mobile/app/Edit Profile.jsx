import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { employeeAPI } from "../services/api";

export default function EditProfile() {
  const navigation = useNavigation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [bio, setBio] = useState("");
  const [profilePicture, setProfilePicture] = useState(null);
  const [employeeId, setEmployeeId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load current profile from storage/API
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const stored = await AsyncStorage.getItem("currentEmployee");
        if (!stored) {
          setLoading(false);
          return;
        }
        const parsed = JSON.parse(stored);

        // Try to get fresh data from API
        let latest = parsed;
        const id = parsed._id || parsed.id;

        if (id) {
          try {
            const res = await employeeAPI.getById(id);
            if (res?.success && res.data) {
              latest = res.data;
              await AsyncStorage.setItem("currentEmployee", JSON.stringify(latest));
            }
          } catch (e) {
            console.warn("Failed to fetch fresh profile, using stored data", e);
          }
        }

        setEmployeeId(latest._id || latest.id || null);
        setName(
          latest.name ||
          `${latest.firstName || ""} ${latest.lastName || ""}`.trim()
        );
        setEmail(latest.email || "");
        setContactNumber(latest.contactNo || "");
        // bio isn't in default schema but might be added later or stored in 'notes'
        setBio(latest.bio || "");
        setProfilePicture(latest.profileImage || latest.image || null);
      } catch (error) {
        console.warn("Failed to load profile for editing:", error?.message);
        Alert.alert("Error", "Failed to load profile data.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  // -------- PICK FROM GALLERY WITH CROP --------
  const pickImageFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission required", "Gallery permission is required to select an image.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // enable cropping
        aspect: [1, 1], // square crop
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        try {
          const asset = result.assets[0];
          // Resize and compress
          const manipulated = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 800 } }], // Profile pics can be smaller (800px)
            { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
          );
          setProfilePicture(manipulated.uri);
        } catch (err) {
          console.log("Error compressing image", err);
          setProfilePicture(result.assets[0].uri); // Fallback
        }
      }
    } catch (error) {
      console.log("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image.");
    }
  };

  // -------- TAKE PHOTO WITH CROP --------
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission required", "Camera permission is required to take a photo.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true, // enable cropping
        aspect: [1, 1], // square crop
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        try {
          const asset = result.assets[0];
          // Resize and compress
          const manipulated = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 800 } }],
            { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
          );
          setProfilePicture(manipulated.uri);
        } catch (err) {
          console.log("Error compressing photo", err);
          setProfilePicture(result.assets[0].uri);
        }
      }
    } catch (error) {
      console.log("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo.");
    }
  };

  // -------- OPEN OPTIONS --------
  const openImageOptions = () => {
    Alert.alert("Change Profile Picture", "Choose an option", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Gallery", onPress: pickImageFromGallery },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    if (!employeeId) {
      Alert.alert("Error", "Cannot update profile. Employee ID is missing.");
      return;
    }

    if (!name.trim()) {
      Alert.alert("Error", "Name is required.");
      return;
    }

    try {
      setSaving(true);

      // Split name into first and last for backend compatibility
      const parts = (name || "").trim().split(" ");
      const firstName = parts[0] || "";
      const lastName = parts.slice(1).join(" ") || "";

      const updatePayload = {
        name: name.trim(),
        firstName,
        lastName,
        email: email.trim(),
        contactNo: contactNumber.trim(),
        profileImage: profilePicture || "",
        bio: bio.trim() // If backend supports it
      };

      // Convert image to base64 if it's a local URI (newly selected)
      if (profilePicture && !profilePicture.startsWith('http') && !profilePicture.startsWith('data:image')) {
        try {
          // Check if file system available
          const { readAsStringAsync, EncodingType } = require('expo-file-system/legacy');
          const base64 = await readAsStringAsync(profilePicture, { encoding: EncodingType.Base64 });
          updatePayload.profileImage = `data:image/jpeg;base64,${base64}`;
        } catch (err) {
          console.warn("Failed to convert profile image to base64", err);
          // If conversion fails, we might still try sending the URI or just not update the image
          // But usually backend expects base64 or url.
        }
      }

      const res = await employeeAPI.update(employeeId, updatePayload);

      if (res?.success && res.data) {
        // Update local storage with new data
        await AsyncStorage.setItem(
          "currentEmployee",
          JSON.stringify(res.data)
        );

        Alert.alert("Success", "Profile updated successfully.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert(
          "Error",
          res?.message || "Failed to update profile. Please try again."
        );
      }
    } catch (error) {
      console.log("Error saving profile:", error);
      Alert.alert(
        "Error",
        error?.message || "Failed to update profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#AD7F65" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          {/* Header / Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
            <Text style={styles.headerTitle}>Edit Profile</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            {/* Profile Picture */}
            <View style={styles.profilePictureContainer}>
              <TouchableOpacity onPress={openImageOptions} activeOpacity={0.8}>
                {profilePicture ? (
                  <Image
                    source={{ uri: profilePicture }}
                    style={styles.profilePicture}
                  />
                ) : (
                  <View style={styles.profilePicturePlaceholder}>
                    <Ionicons name="camera" size={30} color="#FFF" />
                  </View>
                )}
                <View style={styles.editIconBadge}>
                  <Ionicons name="pencil" size={14} color="#FFF" />
                </View>
              </TouchableOpacity>

              <Text style={styles.npplabelText}>Change Profile Picture</Text>
            </View>

            {/* Name Input */}
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              placeholderTextColor="#999"
            />

            {/* Email Input */}
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Contact Number Input */}
            <Text style={styles.label}>Contact Number</Text>
            <TextInput
              style={styles.input}
              value={contactNumber}
              onChangeText={setContactNumber}
              placeholder="Enter your contact number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />

            {/* Bio Input */}
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.disabledButton]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: "#f6f6f6",
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 50, // For status bar
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  profilePictureContainer: {
    alignItems: "center",
    marginBottom: 25,
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#AD7F65',
  },
  profilePicturePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#C2A68C",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: '#AD7F65',
  },
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#AD7F65',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  npplabelText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#AD7F65",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: "#F9F9F9",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#333",
  },
  bioInput: {
    height: 100,
    paddingTop: 14,
  },
  buttonContainer: {
    flexDirection: "row",
    marginTop: 30,
    gap: 15,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#AD7F65",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#FFF",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  saveButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButtonText: {
    color: "#777",
    fontSize: 16,
    fontWeight: "600",
  },
});
