'use client';
import {
  AppBar, Toolbar, IconButton, Typography, Box, Avatar,
  Menu, MenuItem, Divider, Badge, Popover, Chip, Button,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import LogoutIcon from '@mui/icons-material/Logout';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { authService } from '@/lib/auth';
import { useAlerts } from '@/lib/alerts-context';

const NOTIF_LIMIT = 5;

const pageTitles = {
  '/': 'Dashboard',
  '/clients': 'Gestion des clients',
  '/transactions': 'Historique des transactions',
};

const alertConfig = (type) => ({
  icon: type === 'error'
    ? <ErrorOutlineIcon fontSize="small" sx={{ color: '#EF4444' }} />
    : type === 'warning'
      ? <WarningAmberIcon fontSize="small" sx={{ color: '#F59E0B' }} />
      : <InfoOutlinedIcon fontSize="small" sx={{ color: '#3B82F6' }} />,
  bg: type === 'error' ? '#FEF2F2' : type === 'warning' ? '#FFFBEB' : '#EFF6FF',
  left: type === 'error' ? '#EF4444' : type === 'warning' ? '#F59E0B' : '#3B82F6',
});

export default function TopBar({ onMenuClick }) {
  const pathname = usePathname();
  const router = useRouter();
  const title = pageTitles[pathname] || 'Kounhany Wallet';
  const { alerts, markAllRead, unreadCount, financialAlerts, systemAlerts } = useAlerts();

  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [notifAnchor, setNotifAnchor] = useState(null);
  const [notifTab, setNotifTab] = useState('all');

  useEffect(() => {
    setMounted(true);
    setUser(authService.getUser());
  }, []);

  if (!mounted) return null;

  const handleLogout = () => {
    authService.logout();
    router.push('/login');
  };

  const handleOpenNotif = (e) => {
    setNotifAnchor(e.currentTarget);
    markAllRead();
  };

  const tabAlerts = notifTab === 'financial'
    ? financialAlerts
    : notifTab === 'system'
      ? systemAlerts
      : alerts;

  const displayed = tabAlerts.slice(0, NOTIF_LIMIT);
  const hasMore = tabAlerts.length > NOTIF_LIMIT;

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{ bgcolor: 'background.paper', borderBottom: '1px solid rgba(0,0,0,0.08)' }}
    >
      <Toolbar sx={{ gap: 1 }}>
        <IconButton onClick={onMenuClick} edge="start" sx={{ color: 'text.primary' }}>
          <MenuIcon />
        </IconButton>

        <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700, flex: 1 }}>
          {title}
        </Typography>

        {/* Icône notifications */}
        <IconButton
          onClick={handleOpenNotif}
          sx={{ color: unreadCount > 0 ? '#F59E0B' : 'text.secondary' }}
        >
          <Badge
            badgeContent={unreadCount}
            color="error"
            sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', minWidth: 16, height: 16, padding: '0 4px' } }}
          >
            {unreadCount > 0 ? <NotificationsIcon /> : <NotificationsNoneIcon />}
          </Badge>
        </IconButton>

        {/* Popover alertes */}
        <Popover
          open={Boolean(notifAnchor)}
          anchorEl={notifAnchor}
          onClose={() => setNotifAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{
            sx: {
              width: 360,
              borderRadius: 2,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid rgba(0,0,0,0.08)',
              overflow: 'hidden',
            },
          }}
        >
          {/* Header */}
          <Box sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Notifications
              </Typography>
              {alerts.length > 0 && (
                <Chip
                  label={`${alerts.length} alerte${alerts.length > 1 ? 's' : ''}`}
                  size="small"
                  sx={{ bgcolor: '#FEF3C7', color: '#D97706', fontWeight: 700, fontSize: '0.7rem' }}
                />
              )}
            </Box>

            {/* Onglets */}
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {[
                { key: 'all', label: `Toutes (${alerts.length})` },
                { key: 'financial', label: `Financier (${financialAlerts.length})` },
                { key: 'system', label: `Système (${systemAlerts.length})` },
              ].map((tab) => (
                <Box
                  key={tab.key}
                  onClick={() => setNotifTab(tab.key)}
                  sx={{
                    px: 1.2, py: 0.5, borderRadius: 1.5, cursor: 'pointer',
                    bgcolor: notifTab === tab.key ? '#FAC345' : 'rgba(0,0,0,0.05)',
                    color: notifTab === tab.key ? '#212529' : 'text.secondary',
                    fontWeight: notifTab === tab.key ? 700 : 500,
                    fontSize: '0.72rem',
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: notifTab === tab.key ? '#FAC345' : 'rgba(0,0,0,0.08)' },
                  }}
                >
                  {tab.label}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Liste alertes */}
          <Box sx={{ overflowY: 'auto', maxHeight: 340 }}>
            {displayed.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <NotificationsNoneIcon sx={{ fontSize: 40, color: 'rgba(0,0,0,0.15)', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Aucune notification
                </Typography>
              </Box>
            ) : (
              displayed.map((alert, i) => {
                const cfg = alertConfig(alert.type);
                return (
                  <Box
                    key={i}
                    onClick={() => {
                      if (alert.client_id) {
                        router.push(`/clients/${alert.client_id}/wallet`);
                        setNotifAnchor(null);
                      }
                    }}
                    sx={{
                      px: 2.5, py: 1.8,
                      borderBottom: i < displayed.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                      bgcolor: cfg.bg,
                      borderLeft: `3px solid ${cfg.left}`,
                      cursor: alert.client_id ? 'pointer' : 'default',
                      '&:hover': alert.client_id ? { filter: 'brightness(0.97)' } : {},
                      transition: 'filter 0.15s',
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                      <Box sx={{ mt: 0.2, flexShrink: 0 }}>{cfg.icon}</Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', lineHeight: 1.4 }}>
                          {alert.message}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>

          {/* Footer */}
          {alerts.length > 0 && (
            <Box sx={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              {hasMore && (
                <Box sx={{
                  px: 2.5, py: 1,
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <Typography variant="caption" color="text.secondary">
                    {tabAlerts.length - NOTIF_LIMIT} alerte{tabAlerts.length - NOTIF_LIMIT > 1 ? 's' : ''} supplémentaire{tabAlerts.length - NOTIF_LIMIT > 1 ? 's' : ''}
                  </Typography>
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon sx={{ fontSize: '14px !important' }} />}
                    onClick={() => { router.push('/'); setNotifAnchor(null); }}
                    sx={{ color: '#F59E0B', fontWeight: 600, fontSize: '0.75rem', p: 0.5 }}
                  >
                    Voir toutes
                  </Button>
                </Box>
              )}
              <Button
                fullWidth
                onClick={() => { markAllRead(); setNotifAnchor(null); }}
                sx={{
                  py: 1.2, borderRadius: 0,
                  color: 'text.secondary', fontWeight: 600, fontSize: '0.8rem',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                }}
              >
                Marquer tout comme lu
              </Button>
            </Box>
          )}
        </Popover>

        {/* Avatar utilisateur */}
        <Avatar
          onClick={(e) => setUserMenuAnchor(e.currentTarget)}
          sx={{
            bgcolor: '#FAC345', color: '#212529',
            width: 36, height: 36,
            fontSize: '0.85rem', fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {user?.user?.charAt(0).toUpperCase() || 'A'}
        </Avatar>

        <Menu
          anchorEl={userMenuAnchor}
          open={Boolean(userMenuAnchor)}
          onClose={() => setUserMenuAnchor(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{ sx: { borderRadius: 2, minWidth: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' } }}
        >
          <MenuItem disabled sx={{ opacity: '1 !important' }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{user?.user}</Typography>
              <Typography variant="caption" color="text.secondary">Administrateur</Typography>
            </Box>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout} sx={{ color: 'error.main', gap: 1 }}>
            <LogoutIcon fontSize="small" />
            Se déconnecter
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}