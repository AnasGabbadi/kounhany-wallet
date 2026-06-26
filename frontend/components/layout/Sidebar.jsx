'use client';
import {
  Drawer, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Box, Typography, Divider, Avatar, Collapse,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LogoutIcon from '@mui/icons-material/Logout';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import CoPresentIcon from '@mui/icons-material/CoPresent';
import GarageIcon from '@mui/icons-material/Garage';
import BuildIcon from '@mui/icons-material/Build';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/lib/auth';
import { Suspense, useEffect, useState } from 'react';

const DRAWER_WIDTH = 260;

// Whitelist: valeurs ?from= → chemin sidebar enfant.
// Jamais de redirect vers une URL arbitraire.
const SECTION_FROM_MAP = {
  flottes:       '/clients/organisations',
  particuliers:  '/clients/b2c',
  logistique:    '/clients/logistique',
  garages:       '/prestataires/garages',
  pieces:        '/prestataires/pieces',
  transporteurs: '/prestataires/transporteurs',
};

const MENU_ITEMS = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  {
    label: 'Clients', icon: <PeopleIcon />, path: '/clients',
    children: [
      { label: 'Flottes',      icon: <BusinessIcon />,      path: '/clients/organisations' },
      { label: 'Particuliers', icon: <PersonIcon />,        path: '/clients/b2c' },
      { label: 'Logistique',   icon: <LocalShippingIcon />, path: '/clients/logistique' },
    ],
  },
  {
    label: 'Prestataires', icon: <CoPresentIcon />, path: '/prestataires',
    children: [
      { label: 'Garages',       icon: <GarageIcon />,        path: '/prestataires/garages' },
      { label: 'Fournisseurs',  icon: <BuildIcon />,         path: '/prestataires/pieces' },
      { label: 'Transporteurs', icon: <LocalShippingIcon />, path: '/prestataires/transporteurs' },
    ],
  },
  { label: 'Commandes',     icon: <ShoppingBagOutlinedIcon />, path: '/orders' },
  { label: 'Transactions',  icon: <ReceiptIcon />,             path: '/transactions' },
];

function MenuItem({ item, pathname, router, fromParam }) {
  const hasChildren = !!item.children;

  // Chemin de retour résolu depuis ?from= (whitelist uniquement)
  const fromPath = (fromParam && SECTION_FROM_MAP[fromParam]) || null;

  const isActive =
    pathname === item.path ||
    // parent section active quand on est sur une sous-page (ex: /clients/xxx/wallet)
    (item.path !== '/' && pathname.startsWith(item.path + '/')) ||
    (hasChildren && item.children.some(c =>
      pathname === c.path ||
      pathname.startsWith(c.path + '/') ||
      fromPath === c.path
    ));

  const [open, setOpen] = useState(isActive);

  // Ré-ouvrir la section quand on revient dedans via navigation
  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  const active = pathname === item.path && !hasChildren;

  const handleClick = () => {
    if (hasChildren) {
      setOpen(prev => !prev);
    } else {
      router.push(item.path);
    }
  };

  return (
    <>
      <ListItem disablePadding sx={{ mb: 0.5 }}>
        <ListItemButton
          onClick={handleClick}
          sx={{
            borderRadius: 2,
            bgcolor: active ? 'rgba(250,195,69,0.15)' : 'transparent',
            border: active ? '1px solid rgba(250,195,69,0.2)' : '1px solid transparent',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
            py: 1.2,
          }}
        >
          <ListItemIcon sx={{
            color: isActive ? '#FAC345' : 'rgba(255,255,255,0.45)',
            minWidth: 38,
          }}>
            {item.icon}
          </ListItemIcon>
          <ListItemText
            primary={item.label}
            primaryTypographyProps={{
              fontWeight: isActive ? 700 : 400,
              color: isActive ? '#FAC345' : 'rgba(255,255,255,0.75)',
              fontSize: '0.88rem',
            }}
          />
          {hasChildren && (
            open
              ? <ExpandLessIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} />
              : <ExpandMoreIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} />
          )}
          {active && (
            <Box sx={{ width: 3, height: 20, bgcolor: '#FAC345', borderRadius: 2 }} />
          )}
        </ListItemButton>
      </ListItem>

      {hasChildren && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List disablePadding sx={{ pl: 2, mb: 0.5 }}>
            {item.children.map((child) => {
              const childActive =
                pathname === child.path ||
                pathname.startsWith(child.path + '/') ||
                fromPath === child.path;
              return (
                <ListItem key={child.path} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => router.push(child.path)}
                    sx={{
                      borderRadius: 2,
                      bgcolor: childActive ? 'rgba(250,195,69,0.15)' : 'transparent',
                      border: childActive ? '1px solid rgba(250,195,69,0.2)' : '1px solid transparent',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                      py: 1,
                    }}
                  >
                    <ListItemIcon sx={{
                      color: childActive ? '#FAC345' : 'rgba(255,255,255,0.35)',
                      minWidth: 34,
                    }}>
                      {child.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={child.label}
                      primaryTypographyProps={{
                        fontWeight: childActive ? 700 : 400,
                        color: childActive ? '#FAC345' : 'rgba(255,255,255,0.6)',
                        fontSize: '0.82rem',
                      }}
                    />
                    {childActive && (
                      <Box sx={{ width: 3, height: 16, bgcolor: '#FAC345', borderRadius: 2 }} />
                    )}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Collapse>
      )}
    </>
  );
}

// Composant interne isolé dans Suspense pour lire useSearchParams
function SidebarMenu({ pathname, router }) {
  const searchParams = useSearchParams();
  const fromParam = searchParams.get('from');

  return (
    <List sx={{ px: 1.5, pt: 2, flex: 1 }}>
      {MENU_ITEMS.map((item) => (
        <MenuItem key={item.path} item={item} pathname={pathname} router={router} fromParam={fromParam} />
      ))}
    </List>
  );
}

// Fallback sans fromParam (identique à l'état initial)
function SidebarMenuFallback({ pathname, router }) {
  return (
    <List sx={{ px: 1.5, pt: 2, flex: 1 }}>
      {MENU_ITEMS.map((item) => (
        <MenuItem key={item.path} item={item} pathname={pathname} router={router} fromParam={null} />
      ))}
    </List>
  );
}

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
          width: 36, height: 36, borderRadius: 2, bgcolor: '#FAC345',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
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

      {/* Menu — SidebarMenu utilise useSearchParams, isolé dans Suspense */}
      <Suspense fallback={<SidebarMenuFallback pathname={pathname} router={router} />}>
        <SidebarMenu pathname={pathname} router={router} />
      </Suspense>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 2 }} />

      {/* User info + logout */}
      <Box sx={{ p: 2 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5,
          bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <Avatar sx={{
            width: 36, height: 36, bgcolor: '#FAC345',
            color: '#212529', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
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
              cursor: 'pointer', color: 'rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center',
              '&:hover': { color: '#EF4444' },
              transition: 'color 0.2s', flexShrink: 0,
            }}
          >
            <LogoutIcon sx={{ fontSize: 18 }} />
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}
