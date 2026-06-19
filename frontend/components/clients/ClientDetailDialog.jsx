'use client';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Avatar, Chip, Divider, Button,
  Tabs, Tab, Table, TableBody, TableCell, TableHead, TableRow,
  CircularProgress,
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CloseIcon from '@mui/icons-material/Close';
import GroupIcon from '@mui/icons-material/Group';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import api from '@/lib/api';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 });

export default function ClientDetailDialog({ client, balance, onClose }) {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const encours = balance ? Number(balance.blocked) + Number(balance.receivable) : 0;
  const isOrganisation = client?.client_id?.startsWith('company_');

  const { data: membersData, isLoading: membersLoading } = useSWR(
    isOrganisation && client ? `members-${client.client_id}` : null,
    () => api.get(`/clients/${client.client_id}/members`).then(r => r.data?.data || [])
  );

  const members = membersData || [];

  return (
    <Dialog
      open={!!client}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ p: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {isOrganisation ? 'Organisation' : 'Informations client'}
          </Typography>
          <Button size="small" onClick={onClose} sx={{ minWidth: 0, color: 'text.secondary', p: 0.5 }}>
            <CloseIcon fontSize="small" />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3, pt: 0 }}>
        {client && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Avatar sx={{ width: 64, height: 64, bgcolor: isOrganisation ? '#3B82F6' : '#FAC345', color: '#fff', fontSize: '1.6rem', fontWeight: 700 }}>
                {isOrganisation ? <GroupIcon fontSize="large" /> : client.name?.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{client.name}</Typography>
                <Chip
                  label={client.client_id}
                  size="small"
                  sx={{ mt: 0.3, bgcolor: 'rgba(0,0,0,0.06)', fontSize: '0.68rem', fontFamily: 'monospace' }}
                />
                {isOrganisation && (
                  <Chip
                    label={`${members.length} membre${members.length > 1 ? 's' : ''}`}
                    size="small"
                    sx={{ mt: 0.3, ml: 0.5, bgcolor: 'rgba(59,130,246,0.1)', color: '#3B82F6', fontSize: '0.68rem' }}
                  />
                )}
              </Box>
            </Box>

            {isOrganisation && (
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                <Tab label="Informations" sx={{ fontSize: '0.8rem' }} />
                <Tab label={`Membres (${members.length})`} sx={{ fontSize: '0.8rem' }} />
              </Tabs>
            )}

            {(!isOrganisation || tab === 0) && (
              <>
                <Divider sx={{ mb: 2.5 }} />
                {[
                  { icon: <EmailIcon fontSize="small" />, label: 'Email', value: client.email || '—' },
                  { icon: <PhoneIcon fontSize="small" />, label: 'Téléphone', value: client.phone || '—' },
                  { icon: <CalendarTodayIcon fontSize="small" />, label: 'Créé le', value: client.created_at ? new Date(client.created_at).toLocaleDateString('fr-FR') : '—' },
                ].map((item) => (
                  <Box key={item.label} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    mb: 1.5, p: 1.5, borderRadius: 2,
                    bgcolor: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)',
                  }}>
                    <Box sx={{ color: 'text.secondary', flexShrink: 0 }}>{item.icon}</Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.68rem' }}>
                        {item.label}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.value}</Typography>
                    </Box>
                  </Box>
                ))}

                <Divider sx={{ my: 2.5 }} />
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.5 }}>Soldes du wallet</Typography>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Disponible', value: balance?.available || 0, color: '#10B981' },
                    { label: 'Bloqué', value: balance?.blocked || 0, color: '#F59E0B' },
                    { label: 'Créances', value: balance?.receivable || 0, color: '#EF4444' },
                  ].map((item) => (
                    <Box key={item.label} sx={{
                      flex: 1, minWidth: 100, p: 1.5, borderRadius: 2,
                      bgcolor: `${item.color}08`, border: `1px solid ${item.color}20`, textAlign: 'center',
                    }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.68rem', mb: 0.3 }}>
                        {item.label}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: item.color }}>
                        {fmt(item.value)} MAD
                      </Typography>
                    </Box>
                  ))}
                </Box>
                {encours > 0 && (
                  <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Encours total</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#EF4444' }}>{fmt(encours)} MAD</Typography>
                  </Box>
                )}
              </>
            )}

            {isOrganisation && tab === 1 && (
              <Box>
                {membersLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} sx={{ color: '#FAC345' }} />
                  </Box>
                ) : members.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    Aucun membre dans cette organisation
                  </Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Membre</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Email</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Statut</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {members.map((m) => (
                        <TableRow key={m.client_id} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 28, height: 28, bgcolor: '#FAC345', color: '#212529', fontSize: '0.75rem', fontWeight: 700 }}>
                                {m.name?.charAt(0).toUpperCase()}
                              </Avatar>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.name}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">{m.email || '—'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={m.active ? 'Actif' : 'Inactif'}
                              size="small"
                              sx={{
                                fontSize: '0.68rem', fontWeight: 700,
                                bgcolor: m.active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                                color: m.active ? '#10B981' : '#EF4444',
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
        <Button onClick={onClose} color="inherit">Fermer</Button>
        <Button
          variant="contained"
          startIcon={<AccountBalanceWalletIcon />}
          onClick={() => { router.push(`/clients/${client.client_id}/wallet`); onClose(); }}
          sx={{ bgcolor: '#FAC345', color: '#212529', fontWeight: 700, '&:hover': { bgcolor: '#E0A820' } }}
        >
          Gérer le wallet
        </Button>
      </DialogActions>
    </Dialog>
  );
}