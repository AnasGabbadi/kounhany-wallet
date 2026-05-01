'use client';
import { Card, CardContent, Typography, Box, Chip, Divider } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ApiIcon from '@mui/icons-material/Api';
import StorageIcon from '@mui/icons-material/Storage';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CachedIcon from '@mui/icons-material/Cached';

const iconMap = {
  'Backend API': <ApiIcon fontSize="small" />,
  'Blnk Ledger': <AccountBalanceIcon fontSize="small" />,
  'PostgreSQL': <StorageIcon fontSize="small" />,
  'Redis': <CachedIcon fontSize="small" />,
};

const ServiceRow = ({ service }) => {
  if (!service) return null;
  const ok = service.status === 'OK';
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      p: 2, borderRadius: 2, mb: 1.5,
      bgcolor: ok ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
      border: `1px solid ${ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <Box sx={{
          width: 38, height: 38, borderRadius: 1.5, flexShrink: 0,
          bgcolor: ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: ok ? '#10B981' : '#EF4444',
        }}>
          {iconMap[service.name]}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{service.name}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{service.detail}</Typography>
        </Box>
      </Box>
      <Chip
        icon={ok
          ? <CheckCircleIcon sx={{ fontSize: '13px !important' }} />
          : <ErrorIcon sx={{ fontSize: '13px !important' }} />}
        label={service.status}
        size="small"
        sx={{
          bgcolor: ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          color: ok ? '#10B981' : '#EF4444',
          fontWeight: 700, fontSize: '0.7rem',
          border: `1px solid ${ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
          '& .MuiChip-icon': { color: 'inherit' },
        }}
      />
    </Box>
  );
};

export default function ServicesStatus({ systemInfo }) {
  const env = systemInfo?.environment || 'development';
  const allServicesOk = systemInfo
    ? Object.values(systemInfo.services || {}).every((s) => s.status === 'OK')
    : false;

  const placeholders = ['Backend API', 'Blnk Ledger', 'PostgreSQL', 'Redis'];

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            État des services
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              width: 7, height: 7, borderRadius: '50%',
              bgcolor: env === 'production' ? '#10B981' : '#FAC345',
            }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', fontWeight: 600 }}>
              {env === 'production' ? 'Production' : 'Développement'}
            </Typography>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
              Refresh 30s
            </Typography>
          </Box>
        </Box>

        {systemInfo?.services
          ? Object.values(systemInfo.services).map((s) => <ServiceRow key={s.name} service={s} />)
          : placeholders.map((name) => (
              <ServiceRow key={name} service={{ name, status: '...', detail: 'Chargement...' }} />
            ))
        }
      </CardContent>
    </Card>
  );
}