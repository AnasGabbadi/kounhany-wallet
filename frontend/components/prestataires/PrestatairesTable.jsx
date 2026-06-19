'use client';
import {
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Box, Typography, Avatar,
  Chip, Button, Skeleton, TablePagination,
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import GarageIcon from '@mui/icons-material/Garage';
import { useState, useEffect } from 'react';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 });

const BalanceChip = ({ value, color }) => (
  <Chip
    label={`${fmt(value)} MAD`}
    size="small"
    sx={{
      bgcolor: `${color}12`, color,
      fontWeight: 700, fontSize: '0.72rem',
      border: `1px solid ${color}25`,
    }}
  />
);

export default function PrestatairesTable({
  prestataires, balances, balancesLoading, onWallet,
}) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(8);

  useEffect(() => { setPage(0); }, [prestataires]);

  const paginated = (prestataires || []).slice(
    page * rowsPerPage, page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <TableContainer sx={{ flex: 1 }}>
        <Table>
          <TableHead>
            <TableRow>
              {['Garage', 'Statut', 'Contact', 'Disponible', 'Bloqué', 'Créances', 'Actions'].map((h) => (
                <TableCell
                  key={h}
                  sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                >
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <GarageIcon sx={{ fontSize: 48, color: 'rgba(0,0,0,0.1)' }} />
                    <Typography variant="body2" color="text.secondary">
                      Aucun prestataire trouvé
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((p, idx) => {
                const bal = balances[p.prestataire_id];
                const isActive = p.active !== false;

                return (
                  <TableRow key={p.prestataire_id ?? idx} hover sx={{ opacity: isActive ? 1 : 0.6 }}>

                    {/* Garage */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{
                          width: 34, height: 34,
                          bgcolor: isActive ? '#FAC345' : '#6B7280',
                          color: '#212529', fontWeight: 700, fontSize: '0.8rem',
                        }}>
                          {p.name?.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.name}</Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontFamily: 'monospace', fontSize: '0.68rem' }}
                          >
                            {p.prestataire_id}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    {/* Statut */}
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

                    {/* Contact */}
                    <TableCell>
                      <Typography variant="body2">{p.email || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">{p.phone || '—'}</Typography>
                    </TableCell>

                    {/* Disponible */}
                    <TableCell>
                      {balancesLoading && !bal
                        ? <Skeleton width={80} height={24} />
                        : bal
                          ? <BalanceChip value={bal.available} color="#10B981" />
                          : '—'}
                    </TableCell>

                    {/* Bloqué */}
                    <TableCell>
                      {balancesLoading && !bal
                        ? <Skeleton width={80} height={24} />
                        : bal
                          ? <BalanceChip value={bal.blocked} color="#F59E0B" />
                          : '—'}
                    </TableCell>

                    {/* Créances */}
                    <TableCell>
                      {balancesLoading && !bal
                        ? <Skeleton width={80} height={24} />
                        : bal
                          ? <BalanceChip value={bal.receivable} color="#EF4444" />
                          : '—'}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      {isActive && (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<AccountBalanceWalletIcon sx={{ fontSize: '14px !important' }} />}
                          onClick={() => onWallet(p.prestataire_id)}
                          sx={{
                            fontSize: '0.72rem', py: 0.3,
                            bgcolor: '#FAC345', color: '#212529',
                            boxShadow: 'none',
                            '&:hover': { bgcolor: '#E0A820', boxShadow: 'none' },
                          }}
                        >
                          Wallet
                        </Button>
                      )}
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
        count={prestataires?.length || 0}
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