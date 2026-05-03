'use client';
import { Box, LinearProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function PageLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!loading) return null;

  return (
    <Box sx={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 9999,
    }}>
      <LinearProgress
        sx={{
          height: 3,
          bgcolor: 'rgba(250,195,69,0.2)',
          '& .MuiLinearProgress-bar': {
            bgcolor: '#FAC345',
          },
        }}
      />
    </Box>
  );
}