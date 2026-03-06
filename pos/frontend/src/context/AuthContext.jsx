import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    // Try to get from localStorage on mount
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = (user) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  const isOwner = () => {
    return currentUser?.role === 'Owner' || currentUser?.name === 'owner' || currentUser?.id === 3;
  };

  // Check if user has a specific permission
  const hasPermission = (permission) => {
    if (!currentUser) return false;
    
    // Owner has all permissions
    if (isOwner()) return true;
    
    // Check user permissions
    if (currentUser.permissions && currentUser.permissions[permission] !== undefined) {
      return currentUser.permissions[permission];
    }
    
    return false;
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, isOwner, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

