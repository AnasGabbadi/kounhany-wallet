'use client';
import { Card, CardContent, Typography, Box, Grid, CircularProgress, Chip } from '@mui/material';
import useSWR from 'swr';
import { kpisApi } from '@/lib/api';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 });

const NIVEAU_CONFIG = {
  EXCELLENT: { color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)', label: 'Excellent' },
  BON:       { color: '#3B82F6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)', label: 'Bon' },
  MOYEN:     { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)', label: 'Moyen' },
  RISQUÉ:    { color: '#EF4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.15)',  label: 'Risqué' },
  NOUVEAU:   { color: '#6B7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.15)', label: 'Nouveau' },
};

// Jauge de score circulaire
function ScoreGauge({ score, niveau }) {
  const config = NIVEAU_CONFIG[niveau] || NIVEAU_CONFIG.NOUVEAU;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={100} height={100}>
        {/* Track */}
        <circle cx={50} cy={50} r={radius} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={8} />
        {/* Progress */}
        <circle
          cx={50} cy={50} r={radius} fill="none"
          stroke={config.color} strokeWidth={8}
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <Box sx={{ position: 'absolute', textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: config.color, lineHeight: 1 }}>
          {score}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
          /100
        </Typography>
      </Box>
    </Box>
  );
}

export default function WalletScoring({ clientId }) {
  const { data: score, isLoading } = useSWR(
    `scoring:${clientId}`,
    () => kpisApi.clientScore(clientId),
    { refreshInterval: 300000 } // 5 minutes
  );

  if (isLoading) return (
    <Card sx={{ mt: 2 }}>
      <CardContent sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={24} sx={{ color: '#FAC345' }} />
      </CardContent>
    </Card>
  );

  if (!score) return null;

  const config = NIVEAU_CONFIG[score.niveau] || NIVEAU_CONFIG.NOUVEAU;

  const details = [
    {
      label: 'Historique paiements',
      value: `${score.details.historique_paiements.score}/100`,
      sub: `${score.details.historique_paiements.taux_succes}% succès`,
      color: score.details.historique_paiements.score >= 70 ? '#10B981' : '#EF4444',
      poids: '40%',
    },
    {
      label: 'Volume activité',
      value: `${score.details.volume_activite.score}/100`,
      sub: `${score.details.volume_activite.total_transactions} transactions`,
      color: score.details.volume_activite.score >= 70 ? '#10B981' : '#F59E0B',
      poids: '30%',
    },
    {
      label: 'Santé financière',
      value: `${score.details.sante_financiere.score}/100`,
      sub: `${fmt(score.details.sante_financiere.disponible)} MAD dispo`,
      color: score.details.sante_financiere.score >= 70 ? '#10B981' : '#EF4444',
      poids: '20%',
    },
    {
      label: 'Ancienneté',
      value: `${score.details.anciennete.score}/100`,
      sub: `${score.details.anciennete.jours_relation} jours`,
      color: score.details.anciennete.score >= 70 ? '#10B981' : '#F59E0B',
      poids: '10%',
    },
  ];

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Scoring client
          </Typography>
          <Chip
            label={config.label}
            size="small"
            sx={{
              bgcolor: config.bg,
              color: config.color,
              fontWeight: 700,
              border: `1px solid ${config.border}`,
            }}
          />
        </Box>

        <Grid container spacing={2} alignItems="center">
          {/* Jauge score */}
          <Grid item xs={12} sm={3} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <ScoreGauge score={score.score} niveau={score.niveau} />
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Plafond crédit
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: config.color }}>
                {fmt(score.plafond_credit)} MAD
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Délai paiement
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {score.delai_paiement} jours
              </Typography>
            </Box>
          </Grid>

          {/* Détails 4 composantes */}
          <Grid item xs={12} sm={9}>
            <Grid container spacing={1.5}>
              {details.map((d) => (
                <Grid item xs={6} key={d.label}>
                  <Box sx={{
                    p: 1.5, borderRadius: 2,
                    bgcolor: `${d.color}08`,
                    border: `1px solid ${d.color}15`,
                  }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                        {d.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.62rem' }}>
                        {d.poids}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: d.color, mt: 0.3 }}>
                      {d.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                      {d.sub}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>

            {/* Recommandations */}
            {score.recommandations?.length > 0 && (
              <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                {score.recommandations.map((r, i) => (
                  <Chip
                    key={i}
                    label={r.message}
                    size="small"
                    sx={{
                      bgcolor: r.type === 'success' ? 'rgba(16,185,129,0.08)'
                        : r.type === 'warning' ? 'rgba(245,158,11,0.08)'
                        : 'rgba(59,130,246,0.08)',
                      color: r.type === 'success' ? '#10B981'
                        : r.type === 'warning' ? '#F59E0B'
                        : '#3B82F6',
                      fontSize: '0.65rem',
                      height: 22,
                    }}
                  />
                ))}
              </Box>
            )}
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}