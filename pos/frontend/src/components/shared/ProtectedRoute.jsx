import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const ProtectedRoute = ({
  children,
  requiredPermission,
  ownerOnly = false,
}) => {
  const { currentUser, hasPermission, isOwner } = useAuth();
  const location = useLocation();

  // If no user is logged in, redirect to login
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  // Force PIN reset if required
  if (currentUser.requiresPinReset && location.pathname !== "/set-pin") {
    return <Navigate to="/set-pin" replace />;
  }

  // Owner has access to everything
  if (isOwner()) {
    return children;
  }

  // If route is owner-only and user is not owner, redirect
  if (ownerOnly) {
    // Redirect to first available page
    if (hasPermission("posTerminal")) {
      return <Navigate to="/terminal" replace />;
    } else if (hasPermission("inventory")) {
      return <Navigate to="/inventory" replace />;
    } else if (hasPermission("viewTransactions")) {
      return <Navigate to="/transactions" replace />;
    } else if (hasPermission("generateReports")) {
      return <Navigate to="/reports" replace />;
    } else {
      return <Navigate to="/settings" replace />;
    }
  }

  // If a specific permission is required, check it
  if (requiredPermission) {
    if (!hasPermission(requiredPermission)) {
      // Redirect to first available page
      if (hasPermission("posTerminal")) {
        return <Navigate to="/terminal" replace />;
      } else if (hasPermission("inventory")) {
        return <Navigate to="/inventory" replace />;
      } else if (hasPermission("viewTransactions")) {
        return <Navigate to="/transactions" replace />;
      } else if (hasPermission("generateReports")) {
        return <Navigate to="/reports" replace />;
      } else {
        return <Navigate to="/settings" replace />;
      }
    }
  }

  return children;
};

export default ProtectedRoute;
