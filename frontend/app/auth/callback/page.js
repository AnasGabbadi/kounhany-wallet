'use client';
import { Suspense, useEffect, useState, useRef } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Connexion en cours...');
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    const code = searchParams.get('code');
    if (!code) {
      router.push('/login?error=Code+manquant');
      return;
    }

    fetch('http://localhost:3000/auth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(res => {
        if (res.status === 403) {
          router.push('/login?error=Acc%C3%A8s+refus%C3%A9+%E2%80%94+compte+non+autoris%C3%A9');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (!data) return;
        if (data.success && data.data?.access_token) {
          localStorage.setItem('kounhany_access_token', data.data.access_token);
          localStorage.setItem('kounhany_id_token', data.data.id_token || '');
          localStorage.setItem('kounhany_refresh_token', data.data.refresh_token || '');

          // ← Décoder et sauvegarder les infos user
          try {
            const base64 = data.data.access_token.split('.')[1];
            const decoded = JSON.parse(atob(base64.replace(/-/g, '+').replace(/_/g, '/')));
            localStorage.setItem('kounhany_user', JSON.stringify(decoded));
          } catch (e) {
            console.error('Erreur décodage token:', e);
          }

          router.push('/');
        } else {
          router.push('/login?error=' + encodeURIComponent(data.message || 'Erreur'));
        }
      })
      .catch(err => {
        router.push('/login?error=' + encodeURIComponent(err.message));
      });
  }, []);

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: '#212529',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 2,
    }}>
      <CircularProgress sx={{ color: '#FAC345' }} />
      <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>
        {status}
      </Typography>
    </Box>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <Box sx={{
        minHeight: '100vh', bgcolor: '#212529',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <CircularProgress sx={{ color: '#FAC345' }} />
      </Box>
    }>
      <CallbackContent />
    </Suspense>
  );
}