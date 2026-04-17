import { createContext, useContext, useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {

    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // Heartbeat: ping backend every 30s to keep employee marked as online
  useEffect(() => {
    let heartbeatInterval;

    const sendHeartbeat = async () => {
      if (currentUser?._id && currentUser?.role !== 'Owner') {
        try {
          await fetch(API_ENDPOINTS.employeeHeartbeat, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId: currentUser._id })
          });
        } catch (err) {
          // Silently fail - heartbeat is best-effort
        }
      }
    };

    // Handle tab/browser close: send logout request
    const handleBeforeUnload = () => {
      if (currentUser?._id) {
        navigator.sendBeacon(
          API_ENDPOINTS.employeeLogout,
          new Blob([JSON.stringify({ employeeId: currentUser._id })], { type: 'application/json' })
        );
      }
    };

    if (currentUser) {
      sendHeartbeat(); // Send immediately on login
      heartbeatInterval = setInterval(sendHeartbeat, 30000); // Then every 30s
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser]);

  const login = (user) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const logout = async () => {
    // Notify backend to mark employee as offline
    if (currentUser?._id) {
      try {
        await fetch(API_ENDPOINTS.employeeLogout, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: currentUser._id })
        });
      } catch (err) {
        console.error('Error notifying logout:', err);
      }
    }
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  const isOwner = () => {
    return currentUser?.role === 'Owner' || currentUser?.name === 'owner' || currentUser?.id === 3;
  };

  const isManager = () => {
    return currentUser?.role === 'Manager';
  };


  const hasPermission = (permission) => {
    if (!currentUser) return false;


    if (isOwner() || isManager()) return true;


    if (currentUser.permissions && currentUser.permissions[permission] !== undefined) {
      return currentUser.permissions[permission];
    }

    return false;
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, isOwner, isManager, hasPermission }}>
      {children}
    </AuthContext.Provider>);

};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;