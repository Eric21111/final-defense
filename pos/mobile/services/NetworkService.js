import NetInfo from '@react-native-community/netinfo';

let isConnected = true;
const listeners = [];

// Initialize network monitoring
const init = () => {
    NetInfo.fetch().then(state => {
        isConnected = state.isConnected;
    });

    const unsubscribe = NetInfo.addEventListener(state => {
        const wasConnected = isConnected;
        isConnected = state.isConnected;

        // Notify listeners if state changed
        if (wasConnected !== isConnected) {
            listeners.forEach(listener => listener(isConnected));
        }
    });

    return unsubscribe;
};

// Get current connection state
const getIsConnected = () => {
    return isConnected;
};

// Subscribe to connection changes
const subscribe = (callback) => {
    listeners.push(callback);
    return () => {
        const index = listeners.indexOf(callback);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    };
};

export default {
    init,
    getIsConnected,
    subscribe
};
