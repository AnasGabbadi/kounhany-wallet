'use client';
import {
  Drawer, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Box, Typography, Divider, Chip, Avatar,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LogoutIcon from '@mui/icons-material/Logout';
import { usePathname, useRouter } from 'next/navigation';
import { authService } from '@/lib/auth';
import { use, useEffect, useState } from 'react';

const DRAWER_WIDTH = 260;

const menuItems = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { label: 'Clients', icon: <PeopleIcon />, path: '/clients' },
  { label: 'Transactions', icon: <ReceiptIcon />, path: '/transactions' },
];

export default function Sidebar({ open }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    setMounted(true);
    setUser(authService.getUser());
  }, []);

  if (!mounted) return null;

  const handleLogout = () => {
    authService.logout();
    router.push('/login');
  };

  return (
    <Drawer
      variant="persistent"
      open={open}
      sx={{
        width: open ? DRAWER_WIDTH : 0,
        flexShrink: 0,
        transition: 'width 0.3s ease',
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #1a1a2e 0%, #212529 100%)',
          color: 'white',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Logo */}
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: 2,
          bgcolor: '#FAC345',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <AccountBalanceWalletIcon sx={{ fontSize: 20, color: '#212529' }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, lineHeight: 1.2, fontSize: '1rem' }}>
            Kounhany
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem' }}>
            Wallet Admin
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 2 }} />

      {/* Menu */}
      <List sx={{ px: 1.5, pt: 2, flex: 1 }}>
        {menuItems.map((item) => {
          const active = pathname === item.path;
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => router.push(item.path)}
                sx={{
                  borderRadius: 2,
                  bgcolor: active ? 'rgba(250,195,69,0.15)' : 'transparent',
                  border: active ? '1px solid rgba(250,195,69,0.2)' : '1px solid transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                  py: 1.2,
                }}
              >
                <ListItemIcon sx={{
                  color: active ? '#FAC345' : 'rgba(255,255,255,0.45)',
                  minWidth: 38,
                }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: active ? 700 : 400,
                    color: active ? '#FAC345' : 'rgba(255,255,255,0.75)',
                    fontSize: '0.88rem',
                  }}
                />
                {active && (
                  <Box sx={{
                    width: 3, height: 20,
                    bgcolor: '#FAC345',
                    borderRadius: 2,
                  }} />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 2 }} />

      {/* User info + logout */}
      <Box sx={{ p: 2 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          p: 1.5,
          bgcolor: 'rgba(255,255,255,0.04)',
          borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <Avatar sx={{
            width: 36, height: 36,
            bgcolor: '#FAC345',
            color: '#212529',
            fontWeight: 700,
            fontSize: '0.85rem',
            flexShrink: 0,
          }}>
            {user?.name?.charAt(0).toUpperCase() || user?.preferred_username?.charAt(0).toUpperCase() || 'A'}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, fontSize: '0.82rem' }} noWrap>
              {user?.name || user?.preferred_username || 'Admin'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' }} noWrap>
              {user?.email || 'Wallet Admin'}
            </Typography>
          </Box>
          <Box
            onClick={handleLogout}
            sx={{
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center',
              '&:hover': { color: '#EF4444' },
              transition: 'color 0.2s',
              flexShrink: 0,
            }}
          >
            <LogoutIcon sx={{ fontSize: 18 }} />
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}