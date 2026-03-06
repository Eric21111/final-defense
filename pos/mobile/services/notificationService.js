import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { stockAPI } from './api';

const NOTIF_ENABLED_KEY = '@notifications_enabled';
const NOTIFIED_IDS_KEY = '@notified_alert_ids';

// Configure notification channel (Android)
export async function setupNotificationChannel() {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('stock-alerts', {
            name: 'Stock Alerts',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            sound: 'default',
        });
    }
}

// Request notification permissions
export async function requestPermissions() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    return finalStatus === 'granted';
}

// Get/set notification enabled preference
export async function isNotificationsEnabled() {
    try {
        const value = await AsyncStorage.getItem(NOTIF_ENABLED_KEY);
        return value === 'true';
    } catch {
        return false;
    }
}

export async function setNotificationsEnabled(enabled) {
    try {
        await AsyncStorage.setItem(NOTIF_ENABLED_KEY, enabled ? 'true' : 'false');
        if (!enabled) {
            // Cancel all pending notifications when disabled
            await Notifications.cancelAllScheduledNotificationsAsync();
        }
    } catch (e) {
        console.error('Error saving notification preference:', e);
    }
}

// Track which alert IDs have already been notified
async function getNotifiedIds() {
    try {
        const json = await AsyncStorage.getItem(NOTIFIED_IDS_KEY);
        return json ? JSON.parse(json) : [];
    } catch {
        return [];
    }
}

async function addNotifiedIds(newIds) {
    try {
        const existing = await getNotifiedIds();
        const merged = [...new Set([...existing, ...newIds])];
        // Keep only last 500 IDs to prevent unbounded growth
        const trimmed = merged.slice(-500);
        await AsyncStorage.setItem(NOTIFIED_IDS_KEY, JSON.stringify(trimmed));
    } catch (e) {
        console.error('Error saving notified IDs:', e);
    }
}

// Clear seen notifications (call on manual refresh)
export async function clearNotifiedIds() {
    try {
        await AsyncStorage.removeItem(NOTIFIED_IDS_KEY);
    } catch (e) {
        console.error('Error clearing notified IDs:', e);
    }
}

// Main function: check for new alerts and fire phone notifications
export async function checkAndNotify() {
    try {
        const enabled = await isNotificationsEnabled();
        if (!enabled) return;

        const response = await stockAPI.getLowStock();
        if (!response?.success || !response.data || response.data.length === 0) return;

        const alreadyNotified = await getNotifiedIds();
        const newAlerts = response.data.filter(
            item => !alreadyNotified.includes(item._id)
        );

        if (newAlerts.length === 0) return;

        // Fire a notification for each new alert
        const newIds = [];
        for (const alert of newAlerts) {
            const isOutOfStock = alert.alertType === 'out_of_stock';

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: isOutOfStock ? '⚠️ Out of Stock' : '📦 Low Stock Alert',
                    body: isOutOfStock
                        ? `${alert.itemName} is OUT OF STOCK! Restock immediately.`
                        : `${alert.itemName} is running low (${alert.currentStock} left)`,
                    sound: 'default',
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                    ...(Platform.OS === 'android' && { channelId: 'stock-alerts' }),
                },
                trigger: null, // Fire immediately
            });

            newIds.push(alert._id);
        }

        // Mark these as notified so they don't fire again
        await addNotifiedIds(newIds);
    } catch (error) {
        console.error('Error in checkAndNotify:', error);
    }
}
