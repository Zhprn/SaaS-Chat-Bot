import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { userPackageApi } from '@/features/user/services/userPackageApi';
import { useAuth } from '@/hooks/useAuth';
import type { Role } from '@/types/global';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Redirect berdasarkan role
    if (role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    if (role === 'user') {
      return <Navigate to="/wa/chat" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

/** Users without an active package are sent to the package page. Admins bypass. */
export const SubscriptionRoute = ({ children }: { children: React.ReactNode }) => {
  const { role } = useAuth();
  const [hasSub, setHasSub] = useState<boolean | null>(role === 'admin' ? true : null);

  useEffect(() => {
    if (role === 'admin') return;
    userPackageApi
      .getActiveSubscription()
      .then((sub) => setHasSub(!!sub))
      .catch(() => setHasSub(false));
  }, [role]);

  if (hasSub === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!hasSub) return <Navigate to="/user/packages" replace />;
  return <>{children}</>;
};
