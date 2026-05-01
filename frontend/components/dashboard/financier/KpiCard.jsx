'use client';
import { Card, CardContent, Box, Typography, Skeleton } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';

export default function KpiCard({ title, value, subtitle, icon, color = '#FAC345', loading, trend }) {
  const getTrendIcon = () => {
    if (trend === undefined || trend === null) return null;
    if (trend > 0) return <TrendingUpIcon sx={{ fontSize: 14, color: '#10B981' }} />;
    if (trend < 0) return <TrendingDownIcon sx={{ fontSize: 14, color: '#EF4444' }} />;
    return null; // trend === 0 → rien afficher
  };

  const getTrendColor = () => {
    if (trend > 0) return '#10B981';
    if (trend < 0) return '#EF4444';
    return '#6B7280';
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, mb: 1, fontSize: '0.8rem' }}>
              {title}
            </Typography>
            {loading ? (
              <Skeleton variant="text" width="80%" height={36} />
            ) : (
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5, fontSize: { xs: '1.1rem', md: '1.4rem' }, lineHeight: 1.2 }}>
                {value}
              </Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              {trend !== undefined && trend !== null && trend !== 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                  {getTrendIcon()}
                  <Typography variant="caption" sx={{ color: getTrendColor(), fontWeight: 700, fontSize: '0.72rem' }}>
                    {trend > 0 ? '+' : ''}{trend}%
                  </Typography>
                </Box>
              )}
              {subtitle && (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                  {trend !== undefined ? `· ${subtitle}` : subtitle}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2,
            bgcolor: `${color}15`, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Box sx={{ color, fontSize: 24 }}>{icon}</Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}