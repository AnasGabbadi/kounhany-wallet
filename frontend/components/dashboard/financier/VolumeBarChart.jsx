'use client';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 });
const fmtShort = (n) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return fmt(n);
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{
      bgcolor: 'background.paper',
      border: '1px solid rgba(0,0,0,0.1)',
      borderRadius: 2,
      p: 1.5,
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 700, fontFamily: 'monospace' }}>
        {fmt(payload[0].value)} MAD
      </Typography>
    </Box>
  );
};

export default function VolumeBarChart({ volumes }) {
  const data = [
    { name: 'Paiements',    value: volumes?.payments || 0, color: '#FAC345' },
    { name: 'Blocages',     value: volumes?.blocks   || 0, color: '#212529' },
    { name: 'Confirmations',value: volumes?.confirms  || 0, color: '#10B981' },
    { name: 'Dettes',       value: volumes?.debts     || 0, color: '#EF4444' },
  ];

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.3 }}>
              Volume par type
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Total : {fmt(total)} MAD
            </Typography>
          </Box>
          <Box sx={{
            px: 1.5, py: 0.5,
            bgcolor: 'rgba(250,195,69,0.12)',
            border: '1px solid rgba(250,195,69,0.35)',
            borderRadius: 5,
          }}>
            <Typography variant="caption" sx={{ color: '#E0A820', fontWeight: 700, fontSize: '0.7rem' }}>
              MAD
            </Typography>
          </Box>
        </Box>

        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 20, right: 8, left: -28, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtShort}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)', radius: 6 }} />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={56}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={0.9} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                formatter={fmtShort}
                style={{ fill: '#6B7280', fontSize: 10, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <Box sx={{
          display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2, pt: 2,
          borderTop: '1px solid rgba(0,0,0,0.06)',
        }}>
          {data.map((item) => (
            <Box key={item.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                {item.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 700, fontSize: '0.72rem', fontFamily: 'monospace' }}>
                {fmtShort(item.value)}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}