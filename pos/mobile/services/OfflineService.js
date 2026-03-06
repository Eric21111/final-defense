import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'offline_cache_';
const QUEUE_KEY = 'offline_action_queue';

// Save API response to cache
const saveCache = async (key, data) => {
    try {
        await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(data));
    } catch (error) {
        console.error('Error saving to cache:', error);
    }
};

// Get API response from cache
const getCache = async (key) => {
    try {
        const data = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error getting from cache:', error);
        return null;
    }
};

// Queue an action (POST/PUT/DELETE)
const queueAction = async (action) => {
    try {
        const queue = await getQueue();
        queue.push({
            ...action,
            timestamp: Date.now(),
            id: Math.random().toString(36).substr(2, 9)
        });
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        return true;
    } catch (error) {
        console.error('Error queueing action:', error);
        return false;
    }
};

// Get the current queue
const getQueue = async () => {
    try {
        const queue = await AsyncStorage.getItem(QUEUE_KEY);
        return queue ? JSON.parse(queue) : [];
    } catch (error) {
        console.error('Error getting queue:', error);
        return [];
    }
};

// Clear the queue
const clearQueue = async () => {
    try {
        await AsyncStorage.removeItem(QUEUE_KEY);
    } catch (error) {
        console.error('Error clearing queue:', error);
    }
};

// Remove specific item from queue
const removeFromQueue = async (id) => {
    try {
        const queue = await getQueue();
        const newQueue = queue.filter(item => item.id !== id);
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
    } catch (error) {
        console.error('Error removing from queue:', error);
    }
};

export default {
    saveCache,
    getCache,
    queueAction,
    getQueue,
    clearQueue,
    removeFromQueue
};
