'use client';
import { useState, useEffect } from 'react';
import { authService } from './auth';
import api from './api';

// Module-level cache — shared across all hook instances in the same session
let permissionsCache = null;
let fetchPromise = null;

function invalidatePermissionsCache() {
  permissionsCache = null;
  fetchPromise = null;
}

async function fetchPermissions() {
  if (fetchPromise) return fetchPromise;
  fetchPromise = api.get('/permissions/me')
    .then(res => {
      permissionsCache = res;
      return res;
    })
    .catch(() => {
      fetchPromise = null;
      return null;
    });
  return fetchPromise;
}

// Dérive le rôle depuis les groups du JWT (synchrone, sans appel réseau)
function getRoleFromToken() {
  if (typeof window === 'undefined') return null;
  const user = authService.getUser();
  const groups = user?.groups || [];
  const adminGroups = (process.env.NEXT_PUBLIC_AUTHENTIK_ADMIN_GROUPS || 'Wallet Admins').split(',').map(g => g.trim());
  const managerGroups = (process.env.NEXT_PUBLIC_AUTHENTIK_MANAGER_GROUPS || 'Wallet Managers').split(',').map(g => g.trim());
  if (groups.some(g => adminGroups.includes(g))) return 'admin';
  if (groups.some(g => managerGroups.includes(g))) return 'manager';
  return null;
}

export function usePermissions() {
  const [apiData, setApiData] = useState(permissionsCache);
  const [loading, setLoading] = useState(!permissionsCache);

  useEffect(() => {
    if (permissionsCache) {
      setApiData(permissionsCache);
      setLoading(false);
      return;
    }
    fetchPermissions().then(data => {
      setApiData(data);
      setLoading(false);
    });
  }, []);

  const role = apiData?.role ?? getRoleFromToken();
  const permissions = apiData?.data || {};
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';

  const hasPermission = (key) => {
    if (isAdmin) return true;
    return Boolean(permissions[key]);
  };

  return { hasPermission, isAdmin, isManager, loading };
}

// Utilitaire synchrone pour les cas sans hook (Sidebar, guards)
export function getLocalRole() {
  return getRoleFromToken();
}

export { invalidatePermissionsCache };
