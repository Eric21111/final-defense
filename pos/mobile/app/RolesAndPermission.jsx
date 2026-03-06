import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from "@react-native-picker/picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator
} from "react-native";
import { employeeAPI } from "../services/api";

const RolesAndPermission = () => {
  const router = useRouter();
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [editingEmployee, setEditingEmployee] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    position: "Cashier", // Maps to 'role'
    contactNumber: "",
    dateJoined: new Date().toISOString().split('T')[0],
    isActive: true, // Maps to 'status'
    permissions: {
      pos: false,
      inventory: false,
      viewTransaction: false,
      generateReports: false
    }
  });

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const res = await employeeAPI.getAll();
      if (res && res.success && res.data) {
        // Filter out 'Owner' role (case insensitive)
        const staff = res.data.filter(emp => emp.role.toLowerCase() !== 'owner');
        setEmployees(staff);
        setFilteredEmployees(staff);
      }
    } catch (error) {
      console.error("Failed to load employees:", error);
      Alert.alert("Error", "Failed to load employees.");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadEmployees();
      return () => { };
    }, [])
  );

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      email: employee.email,
      position: employee.role, // Mapping role -> position for UI consistency
      contactNumber: employee.contactNo,
      dateJoined: employee.dateJoined ? new Date(employee.dateJoined).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      isActive: employee.status === 'Active',
      permissions: {
        pos: false,
        inventory: false,
        viewTransaction: false,
        generateReports: false,
        ...(employee.permissions || {})
      }
    });
    setIsEditModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email || !formData.position) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: formData.name,
        email: formData.email,
        role: formData.position, // Map UI position to backend role
        contactNo: formData.contactNumber,
        dateJoined: new Date(formData.dateJoined),
        status: formData.isActive ? 'Active' : 'Inactive',
        permissions: formData.permissions
      };

      let res;
      if (editingEmployee) {
        // Update existing
        res = await employeeAPI.update(editingEmployee._id || editingEmployee.id, payload);
      } else {
        // Create new
        // Auto-generate a random 6-digit PIN for new employees
        const randomPin = Math.floor(100000 + Math.random() * 900000).toString();

        const newEmployeePayload = {
          ...payload,
          pin: randomPin,
          firstName: formData.name.split(' ')[0], // Simple split
          lastName: formData.name.split(' ').slice(1).join(' ') || '',
          requiresPinReset: true,
          sendPinEmail: true // Backend handles email sending
        };

        res = await employeeAPI.create(newEmployeePayload);
      }

      if (res && res.success) {
        Alert.alert(
          "Success",
          editingEmployee ? "Employee updated successfully." : "Employee added successfully. A temporary PIN has been sent to their email.",
          [{ text: "OK", onPress: () => setIsEditModalVisible(false) }]
        );
        loadEmployees(); // Refresh list
      } else {
        Alert.alert("Error", res?.message || "Failed to save employee.");
      }

    } catch (error) {
      console.error("Save error:", error);
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const toggleEmployeeStatus = (employee) => {
    setSelectedEmployee(employee);
    setShowStatusModal(true);
  };

  const confirmStatusChange = async () => {
    if (selectedEmployee) {
      try {
        const newStatus = selectedEmployee.status === 'Active' ? 'Inactive' : 'Active';
        const res = await employeeAPI.update(selectedEmployee._id || selectedEmployee.id, { status: newStatus });

        if (res && res.success) {
          loadEmployees();
        } else {
          Alert.alert("Error", "Failed to update status.");
        }
      } catch (error) {
        console.error("Status update error:", error);
        Alert.alert("Error", "Failed to update status.");
      }
    }
    setShowStatusModal(false);
  };

  const archiveEmployee = (employee) => {
    Alert.alert(
      "Delete Employee",
      `Are you sure you want to delete ${employee.name}? This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          onPress: async () => {
            try {
              const res = await employeeAPI.delete(employee._id || employee.id);
              if (res && res.success) {
                loadEmployees();
              } else {
                Alert.alert("Error", res?.message || "Failed to delete employee.");
              }
            } catch (error) {
              console.error("Delete error:", error);
              Alert.alert("Error", "Failed to delete employee.");
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  const handlePermissionToggle = (permission) => {
    setFormData({
      ...formData,
      permissions: {
        ...formData.permissions,
        [permission]: !formData.permissions[permission]
      }
    });
  };

  const handleInputChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query === '') {
      setFilteredEmployees(employees);
    } else {
      const lowerQuery = query.toLowerCase();
      const filtered = employees.filter(employee =>
        (employee.name && employee.name.toLowerCase().includes(lowerQuery)) ||
        (employee.email && employee.email.toLowerCase().includes(lowerQuery)) ||
        (employee.role && employee.role.toLowerCase().includes(lowerQuery))
      );
      setFilteredEmployees(filtered);
    }
  };

  if (loading && !employees.length) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#AD7F65" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search employees..."
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor="#999"
          />
        </View>

        {/* Archive Button - navigating to Archive page doesn't make sense for permanent delete, 
            so maybe we keep it generic or remove if managing deleted employees isn't supported differently. 
            Keeping it as is but it might lead to item archive. 
            Actually, the original code navigated to '/Archive'. I'll keep it but it's likely for products.
            Wait, user context: "Archive" usually means "Item Archive". 
            I'll disable it for now or redirect to the main Archive page.
        */}
        <TouchableOpacity
          onPress={() => router.push('/Archive')}
          style={styles.addButton}
        >
          <Ionicons name="archive" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setEditingEmployee(null);
            setFormData({
              name: "",
              email: "",
              position: "Cashier",
              contactNumber: "",
              dateJoined: new Date().toISOString().split('T')[0],
              isActive: true,
              permissions: {
                pos: false,
                inventory: false,
                viewTransaction: false,
                generateReports: false
              }
            });
            setIsEditModalVisible(true);
          }}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {filteredEmployees.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: '#888' }}>No employees found.</Text>
          </View>
        ) : (
          filteredEmployees.map((employee) => (
            <View key={employee._id || employee.id} style={[
              styles.employeeCard,
              employee.status !== 'Active' && styles.inactiveEmployee
            ]}>
              <View style={styles.employeeHeader}>
                <View style={styles.employeeInfo}>
                  <Text style={styles.employeeName}>{employee.name}</Text>
                  <Text style={styles.employeePosition}>{employee.role}</Text>
                  <View style={[styles.statusBadge, employee.status === 'Active' ? styles.activeBadge : styles.inactiveBadge]}>
                    <Text style={styles.statusText}>
                      {employee.status || 'Inactive'}
                    </Text>
                  </View>
                </View>
                <View style={styles.employeeActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEdit(employee)}
                  >
                    <Ionicons name="pencil" size={20} color="#4A90E2" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => archiveEmployee(employee)}
                    style={styles.actionButton}
                  >
                    <Ionicons name="trash" size={20} color="#f44336" />
                  </TouchableOpacity>
                  <Switch
                    value={employee.status === 'Active'}
                    onValueChange={() => toggleEmployeeStatus(employee)}
                    trackColor={{ false: "#D3D3D3", true: "#AD7F65" }}
                    thumbColor={"#FFFFFF"}
                  />
                </View>
              </View>

              <View style={styles.employeeDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="mail" size={16} color="#666" />
                  <Text style={styles.detailText}>{employee.email}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="call" size={16} color="#666" />
                  <Text style={styles.detailText}>{employee.contactNo}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar" size={16} color="#666" />
                  <Text style={styles.detailText}>Joined: {employee.dateJoined ? new Date(employee.dateJoined).toLocaleDateString() : 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.permissionsContainer}>
                <Text style={styles.permissionsTitle}>Permissions:</Text>
                <View style={styles.permissionsGrid}>
                  {employee.permissions && Object.entries(employee.permissions).map(([key, value]) => (
                    <View key={key} style={styles.permissionItem}>
                      <Text style={styles.permissionText}>
                        {key.split(/(?=[A-Z])/).join(' ').toUpperCase()}
                      </Text>
                      <View style={[
                        styles.permissionBadge,
                        value ? styles.permissionGranted : styles.permissionDenied
                      ]}>
                        <Text style={styles.permissionBadgeText}>
                          {value ? '✓' : '✗'}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {(!employee.permissions || Object.keys(employee.permissions).length === 0) && (
                    <Text style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>No specific permissions set</Text>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Edit/Add Employee Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => !saving && setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
              </Text>
              <TouchableOpacity onPress={() => !saving && setIsEditModalVisible(false)} disabled={saving}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) => handleInputChange('name', text)}
                  placeholder="Enter full name"
                  editable={!saving}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={formData.email}
                  onChangeText={(text) => handleInputChange('email', text)}
                  placeholder="Enter email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!saving}
                />
                {!editingEmployee && <Text style={styles.hintText}>A temporary PIN will be sent to this email.</Text>}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Position (Role)</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.position}
                    onValueChange={(itemValue) => handleInputChange('position', itemValue)}
                    style={styles.picker}
                    enabled={!saving}
                  >
                    <Picker.Item label="Cashier" value="Cashier" />
                    <Picker.Item label="Manager" value="Manager" />
                    <Picker.Item label="Admin" value="Admin" />
                  </Picker>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Contact Number</Text>
                <TextInput
                  style={styles.input}
                  value={formData.contactNumber}
                  onChangeText={(text) => handleInputChange('contactNumber', text)}
                  placeholder="Enter contact number"
                  keyboardType="phone-pad"
                  editable={!saving}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Date Joined</Text>
                <TouchableOpacity
                  onPress={() => !saving && setShowDatePicker(true)}
                  style={styles.dateInputContainer}
                  disabled={saving}
                >
                  <Text style={styles.dateInputText}>
                    {formData.dateJoined || 'Select date'}
                  </Text>
                  <Ionicons name="calendar" size={20} color="#666" />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={formData.dateJoined ? new Date(formData.dateJoined) : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (selectedDate) {
                        const formattedDate = selectedDate.toISOString().split('T')[0];
                        handleInputChange('dateJoined', formattedDate);
                      }
                    }}
                    style={styles.datePicker}
                  />
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Account Status</Text>
                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>
                    {formData.isActive ? 'Active' : 'Inactive'}
                  </Text>
                  <Switch
                    value={formData.isActive}
                    onValueChange={(value) => handleInputChange('isActive', value)}
                    trackColor={{ false: "#D3D3D3", true: "#AD7F65" }}
                    thumbColor={"#FFFFFF"}
                    disabled={saving}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Permissions</Text>
                <View style={styles.permissionsList}>
                  <View style={styles.permissionToggle}>
                    <Text style={styles.permissionLabel}>POS Access</Text>
                    <Switch
                      value={formData.permissions.pos}
                      onValueChange={() => handlePermissionToggle('pos')}
                      trackColor={{ false: "#D3D3D3", true: "#AD7F65" }}
                      thumbColor={"#FFFFFF"}
                      disabled={saving}
                    />
                  </View>

                  <View style={styles.permissionToggle}>
                    <Text style={styles.permissionLabel}>Inventory Management</Text>
                    <Switch
                      value={formData.permissions.inventory}
                      onValueChange={() => handlePermissionToggle('inventory')}
                      trackColor={{ false: "#D3D3D3", true: "#AD7F65" }}
                      thumbColor={"#FFFFFF"}
                      disabled={saving}
                    />
                  </View>

                  <View style={styles.permissionToggle}>
                    <Text style={styles.permissionLabel}>View Transactions</Text>
                    <Switch
                      value={formData.permissions.viewTransaction}
                      onValueChange={() => handlePermissionToggle('viewTransaction')}
                      trackColor={{ false: "#D3D3D3", true: "#AD7F65" }}
                      thumbColor={"#FFFFFF"}
                      disabled={saving}
                    />
                  </View>

                  <View style={styles.permissionToggle}>
                    <Text style={styles.permissionLabel}>Generate Reports</Text>
                    <Switch
                      value={formData.permissions.generateReports}
                      onValueChange={() => handlePermissionToggle('generateReports')}
                      trackColor={{ false: "#D3D3D3", true: "#AD7F65" }}
                      thumbColor={"#FFFFFF"}
                      disabled={saving}
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setIsEditModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={[styles.buttonText, { color: 'white' }]}>
                    {editingEmployee ? 'Save Changes' : 'Add Employee'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Status Change Confirmation Modal */}
      <Modal
        visible={showStatusModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.modalTitle}>
              {selectedEmployee?.status === 'Active' ? 'Disable Employee' : 'Enable Employee'}
            </Text>
            <Text style={styles.confirmText}>
              Are you sure you want to {selectedEmployee?.status === 'Active' ? 'disable' : 'enable'} {selectedEmployee?.name}?
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => setShowStatusModal(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmActionButton]}
                onPress={confirmStatusChange}
              >
                <Text style={[styles.buttonText, { color: 'white' }]}>
                  {selectedEmployee?.status === 'Active' ? 'Disable' : 'Enable'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchInput: {
    flex: 1,
    height: 48,
    paddingLeft: 8,
    color: '#333',
  },
  searchIcon: {
    marginRight: 8,
  },
  addButton: {
    width: 48,
    height: 48,
    backgroundColor: '#AD7F65',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  employeeCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '95%',
    alignSelf: 'center',
  },
  inactiveEmployee: {
    opacity: 0.7,
    backgroundColor: '#F2F2F2',
  },
  employeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 12,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  employeePosition: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activeBadge: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  inactiveBadge: {
    backgroundColor: '#FFF3E0', // Changed to orange for inactive/pending
    borderColor: '#FF9800',
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  employeeActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  employeeDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  permissionsContainer: {
    marginTop: 8,
  },
  permissionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  permissionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 12,
    color: '#555',
    marginRight: 6,
  },
  permissionBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionGranted: {
    backgroundColor: '#E8F5E9',
  },
  permissionDenied: {
    backgroundColor: '#FFEBEE',
  },
  permissionBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '100%',
    maxHeight: '90%',
  },
  confirmModalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
    color: '#333',
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  confirmButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  confirmActionButton: {
    backgroundColor: '#AD7F65',
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalBody: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  dateInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  dateInputText: {
    fontSize: 16,
    color: '#333',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  permissionsList: {
    marginTop: 8,
  },
  permissionToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  permissionLabel: {
    fontSize: 15,
    color: '#444',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#AD7F65',
  },
  hintText: {
    fontSize: 12,
    color: '#777',
    marginTop: 4,
    fontStyle: 'italic',
  },
});

export default RolesAndPermission;