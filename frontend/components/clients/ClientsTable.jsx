'use client';
import {
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Box, Typography, Avatar,
  Chip, Button, Skeleton, TablePagination,
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PersonIcon from '@mui/icons-material/Person';
import { useState, useEffect } from 'react';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 });

const BalanceChip = ({ value, color }) => (
  <Chip
    label={`${fmt(value)} MAD`}
    size="small"
    sx={{ bgcolor: `${color}12`, color, fontWeight: 700, fontSize: '0.72rem', border: `1px solid ${color}25` }}
  />
);

export default function ClientsTable({ clients, balances, balancesLoading, onDetail, onWallet, onOrders }) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(8);

  useEffect(() => { setPage(0); }, [clients]);

  const paginated = (clients || []).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TableContainer sx={{ flex: 1 }}>
        <Table>
          <TableHead>
            <TableRow>
              {['Client', 'Statut', 'Contact', 'Disponible', 'Bloqué', 'Créances', 'Encours total', 'Actions'].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  Aucun client trouvé
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((client) => {
                const bal = balances[client.client_id];
                const encours = bal ? Number(bal.blocked) + Number(bal.receivable) : 0;
                const isActive = client.active !== false;

                return (
                  <TableRow
                    key={client.client_id}
                    hover
                    sx={{ opacity: isActive ? 1 : 0.6 }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{
                          width: 34, height: 34,
                          bgcolor: isActive ? '#FAC345' : '#6B7280',
                          color: '#212529', fontWeight: 700, fontSize: '0.8rem',
                        }}>
                          {client.name?.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{client.name}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.68rem' }}>
                            {client.client_id}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={isActive ? 'Actif' : 'Désactivé'}
                        size="small"
                        sx={{
                          fontWeight: 700, fontSize: '0.72rem',
                          bgcolor: isActive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                          color: isActive ? '#10B981' : '#EF4444',
                          border: `1px solid ${isActive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                        }}
                      />
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">{client.email || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">{client.phone || ''}</Typography>
                    </TableCell>

                    <TableCell>
                      {balancesLoading && !bal ? <Skeleton width={80} height={24} /> : bal ? <BalanceChip value={bal.available} color="#10B981" /> : '—'}
                    </TableCell>
                    <TableCell>
                      {balancesLoading && !bal ? <Skeleton width={80} height={24} /> : bal ? <BalanceChip value={bal.blocked} color="#F59E0B" /> : '—'}
                    </TableCell>
                    <TableCell>
                      {balancesLoading && !bal ? <Skeleton width={80} height={24} /> : bal ? <BalanceChip value={bal.receivable} color="#EF4444" /> : '—'}
                    </TableCell>
                    <TableCell>
                      {balancesLoading && !bal ? (
                        <Skeleton width={80} height={24} />
                      ) : bal ? (
                        <Chip
                          label={`${fmt(encours)} MAD`}
                          size="small"
                          sx={{
                            bgcolor: encours > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                            color: encours > 0 ? '#EF4444' : '#10B981',
                            fontWeight: 700, fontSize: '0.72rem',
                            border: `1px solid ${encours > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                          }}
                        />
                      ) : '—'}
                    </TableCell>

                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>

                        {/* Détail — gris outlined */}
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<PersonIcon sx={{ fontSize: '14px !important' }} />}
                          onClick={() => onDetail(client)}
                          sx={{
                            fontSize: '0.72rem', py: 0.3,
                            borderColor: 'rgba(0,0,0,0.2)', color: 'text.secondary',
                            '&:hover': { borderColor: 'rgba(0,0,0,0.4)', bgcolor: 'rgba(0,0,0,0.04)' }
                          }}
                        >
                          Détail
                        </Button>

                        {/* Wallet — jaune contained */}
                        {isActive && bal && (
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<AccountBalanceWalletIcon sx={{ fontSize: '14px !important' }} />}
                            onClick={() => onWallet(client.client_id)}
                            sx={{
                              fontSize: '0.72rem', py: 0.3,
                              bgcolor: '#FAC345', color: '#212529',
                              boxShadow: 'none',
                              '&:hover': { bgcolor: '#E0A820', boxShadow: 'none' }
                            }}
                          >
                            Wallet
                          </Button>
                        )}

                        {/* Commandes */}
                        {isActive && bal && (
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<ShoppingBagOutlinedIcon sx={{ fontSize: '14px !important' }} />}
                            onClick={() => onOrders(client.client_id)}
                            sx={{
                              fontSize: '0.72rem', py: 0.3,
                              bgcolor: '#212529', color: '#FAC345',
                              boxShadow: 'none',
                              '&:hover': { bgcolor: '#4e3f1b', boxShadow: 'none' }
                            }}
                          >
                            Commandes
                          </Button>
                        )}

                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={clients?.length || 0}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
        rowsPerPageOptions={[8, 15, 25, 50]}
        labelRowsPerPage="Lignes par page"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
      />
    </Box>
  );
}