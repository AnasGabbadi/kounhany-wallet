'use client';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#FAC345', '#212529', '#10B981'];
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });

export default function BalancePieChart({ balances }) {
  const data = [
    { name: 'Disponible', value: balances?.available || 0 },
    { name: 'Bloqué', value: balances?.blocked || 0 },
    { name: 'Créances', value: balances?.receivable || 0 },
  ];
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Répartition des soldes
        </Typography>
        {total === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Typography color="text.secondary">Aucun solde</Typography>
          </Box>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v) => `${fmt(v)} MAD`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <Box sx={{ mt: 1 }}>
              {data.map((item, i) => (
                <Box key={item.name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COLORS[i] }} />
                    <Typography variant="caption" color="text.secondary">{item.name}</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>{fmt(item.value)} MAD</Typography>
                </Box>
              ))}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}