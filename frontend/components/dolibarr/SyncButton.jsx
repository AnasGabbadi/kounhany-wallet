'use client';
import { useState } from 'react';
import { Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import { dolibarrApi } from '@/lib/api';

export default function SyncButton({ size = 'small', variant = 'outlined', label = 'Synchroniser', onSuccess }) {
  const [syncing, setSyncing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await dolibarrApi.sync();
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Erreur lors de la synchronisation');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <Button
        size={size}
        variant={variant}
        startIcon={syncing ? <CircularProgress size={14} /> : <SyncIcon />}
        onClick={handleSync}
        disabled={syncing}
        sx={{
          borderColor: '#FAC345',
          color: '#E0A820',
          '&:hover': { borderColor: '#E0A820', bgcolor: 'rgba(250,195,69,0.05)' },
        }}
      >
        {syncing ? 'Synchronisation...' : label}
      </Button>

      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={() => setSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" onClose={() => setSuccess(false)} sx={{ fontWeight: 600 }}>
          Synchronisation Dolibarr effectuée
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={4000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}