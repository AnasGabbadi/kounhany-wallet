'use client';
import { Alert, Box } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';

export default function AlertsBanner({ alerts }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <Box sx={{ mb: 3 }}>
      {alerts.slice(0, 2).map((alert, i) => (
        <Alert
          key={i}
          severity={alert.type === 'error' ? 'error' : alert.type === 'warning' ? 'warning' : 'info'}
          icon={<WarningIcon />}
          sx={{ mb: 1 }}
        >
          {alert.message}
        </Alert>
      ))}
    </Box>
  );
}