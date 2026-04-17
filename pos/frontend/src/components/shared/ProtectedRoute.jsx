import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const ProtectedRoute = ({
  children,
  requiredPermission,
  ownerOnly = false
}) => {
  const { currentUser, hasPermission, isOwner, isManager } = useAuth();
  const location = useLocation();


  if (!currentUser) {
    return <Navigate to="/" replace />;
  }


  if (currentUser.requiresPinReset && location.pathname !== "/set-pin") {
    return <Navigate to="/set-pin" replace />;
  }


  if (isOwner() || isManager()) {
    return children;
  }


  if (ownerOnly) {

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


  if (requiredPermission) {
    if (!hasPermission(requiredPermission)) {

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