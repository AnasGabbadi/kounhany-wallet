'use client';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import theme from '../theme/theme';
import Sidebar from '../components/layout/Sidebar';
import TopBar from '../components/layout/TopBar';
import AuthGuard from '../components/AuthGuard';
import { AlertsProvider } from '../lib/alerts-context';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import PageLoader from '@/components/layout/PageLoader';

export default function RootLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  // Pages sans sidebar ni topbar
  const isPublicPage = pathname === '/login' || pathname.startsWith('/auth/');

  return (
    <html lang="fr">
      <head>
        <title>Kounhany Wallet — Admin</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <PageLoader />
          <AlertsProvider>
            <AuthGuard>
              {isPublicPage ? children : (
                <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
                  <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <TopBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
                    <Box component="main" sx={{ flex: 1, p: 3, overflow: 'auto' }}>
                      {children}
                    </Box>
                  </Box>
                </Box>
              )}
            </AuthGuard>
          </AlertsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}