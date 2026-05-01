'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authService } from '@/lib/auth';
import { Box, CircularProgress } from '@mui/material';

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Routes publiques
    if (pathname === '/login' || pathname.startsWith('/auth/')) {
      setAuthenticated(true);
      return;
    }

    if (!authService.isAuthenticated()) {
      router.push('/login');
      return;
    }

    setAuthenticated(true);
  }, [pathname]);

  // Intercepter les erreurs 401/403 globalement
  useEffect(() => {
    const handleUnauthorized = (event) => {
      if (event.detail?.status === 401 || event.detail?.status === 403) {
        authService.logout();
        router.push('/login?error=' + encodeURIComponent(event.detail.message || 'Session expirée'));
      }
    };
    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, []);

  if (!mounted) return null;

  if (!authenticated && pathname !== '/login' && !pathname.startsWith('/auth/')) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress sx={{ color: '#FAC345' }} />
      </Box>
    );
  }

  return children;
}