'use client';
import { Suspense, useEffect } from 'react';
import { Box, Button, Typography, Alert } from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/lib/auth';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  useEffect(() => {
    if (authService.isAuthenticated()) {
      router.push('/');
    }
  }, []);

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: '#212529',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(250,195,69,0.08) 0%, transparent 50%)',
    }}>
      <Box sx={{ width: '100%', maxWidth: 420, px: 2, textAlign: 'center' }}>

        <Box sx={{
          width: 72, height: 72, borderRadius: 3,
          bgcolor: '#FAC345', display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', mb: 3,
        }}>
          <AccountBalanceWalletIcon sx={{ fontSize: 36, color: '#212529' }} />
        </Box>

        <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
          Kounhany Wallet
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 4 }}>
          Panneau d'administration
        </Typography>

        {/* Message d'erreur */}
        {error && (
          <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
            {error === 'Accès refusé — compte non autorisé'
              ? 'Votre compte n\'a pas les droits d\'accès au dashboard.'
              : error}
          </Alert>
        )}

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={() => authService.login()}
          sx={{
            py: 1.8,
            bgcolor: '#FAC345',
            color: '#212529',
            fontWeight: 700,
            fontSize: '1rem',
            borderRadius: 2,
            '&:hover': { bgcolor: '#E0A820' },
          }}
        >
          Se connecter avec Authentik
        </Button>

        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block', mt: 3 }}>
          Authentification sécurisée via SSO
        </Typography>
      </Box>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Box sx={{ minHeight: '100vh', bgcolor: '#212529' }} />}>
      <LoginContent />
    </Suspense>
  );
}