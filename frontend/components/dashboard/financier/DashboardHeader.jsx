'use client';
import { Box, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';

export default function DashboardHeader({ view, onViewChange }) {
  return (
    <Box sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: { xs: 'flex-start', sm: 'center' },
      flexDirection: { xs: 'column', sm: 'row' },
      gap: 2, mb: 4,
    }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          {view === 'financial' ? 'Dashboard financier' : 'Dashboard système'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long', year: 'numeric',
            month: 'long', day: 'numeric',
          })}
        </Typography>
      </Box>

      <ToggleButtonGroup
        value={view}
        exclusive
        onChange={(_, val) => val && onViewChange(val)}
        size="small"
        sx={{
          bgcolor: 'rgba(0,0,0,0.04)',
          borderRadius: 2,
          p: 0.5,
          '& .MuiToggleButton-root': {
            border: 'none',
            borderRadius: '8px !important',
            px: 2, py: 0.8,
            fontWeight: 600,
            fontSize: '0.82rem',
            color: 'text.secondary',
            gap: 0.8,
            '&.Mui-selected': {
              bgcolor: 'white',
              color: '#212529',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            },
            '&:hover': { bgcolor: 'rgba(255,255,255,0.6)' },
          },
        }}
      >
        <ToggleButton value="financial">
          <AccountBalanceWalletIcon sx={{ fontSize: 16 }} />
          Financier
        </ToggleButton>
        <ToggleButton value="system">
          <MonitorHeartIcon sx={{ fontSize: 16 }} />
          Système
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}