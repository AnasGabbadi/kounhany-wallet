'use client';
import {
  Card, CardContent, Typography, Box, Chip, Table,
  TableBody, TableCell, TableContainer, TableHead,
  TableRow, Button, Menu, MenuItem, ListItemIcon,
  ListItemText, Divider, TablePagination,
} from '@mui/material';
import ReceiptIcon from '@mui/icons-material/Receipt';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PaymentIcon from '@mui/icons-material/Payment';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { useState } from 'react';
import StatusBadge from '@/components/common/StatusBadge';
import LockOpenIcon from '@mui/icons-material/LockOpen';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });

const ACTIONS = [
  { key: 'pay', label: 'Recharger le wallet', desc: 'Ajouter des fonds au compte disponible', icon: <AddCircleOutlineIcon fontSize="small" />, color: '#10B981' },
  { key: 'block', label: 'Bloquer un montant', desc: 'Réserver du compte disponible', icon: <BlockIcon fontSize="small" />, color: '#F59E0B' },
  { key: 'confirm', label: 'Confirmer un blocage', desc: 'Consommer un montant bloqué', icon: <CheckCircleOutlineIcon fontSize="small" />, color: '#3B82F6' },
  { key: 'unblock', label: 'Débloquer un montant', desc: 'Restituer un montant bloqué vers le disponible', icon: <LockOpenIcon fontSize="small" />, color: '#F59E0B' },
  { key: 'external-debt', label: 'Dette Dolibarr', desc: 'Enregistrer une facture externe', icon: <ReceiptLongIcon fontSize="small" />, color: '#EF4444' },
  { key: 'external-payment', label: 'Paiement Dolibarr', desc: 'Enregistrer un paiement externe', icon: <PaymentIcon fontSize="small" />, color: '#10B981' },
];

export default function TransactionTable({ transactions, onAction }) {
  const [anchor, setAnchor] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  const paginated = transactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Card sx={{
      width: '100%',
      minHeight: 'calc(100vh - 220px)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <CardContent sx={{
        p: 3,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        '&:last-child': { pb: 2 },
      }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Historique des transactions
            </Typography>
            <Chip
              label={`${transactions.length} transaction${transactions.length > 1 ? 's' : ''}`}
              size="small"
              sx={{ bgcolor: 'rgba(0,0,0,0.06)', fontWeight: 600 }}
            />
          </Box>

          <Button
            variant="contained"
            endIcon={<KeyboardArrowDownIcon />}
            onClick={(e) => setAnchor(e.currentTarget)}
            sx={{ bgcolor: '#FAC345', color: '#212529', fontWeight: 700, '&:hover': { bgcolor: '#E0A820' } }}
          >
            Actions wallet
          </Button>

          <Menu
            anchorEl={anchor}
            open={Boolean(anchor)}
            onClose={() => setAnchor(null)}
            PaperProps={{
              sx: { borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.08)', minWidth: 260, mt: 0.5 },
            }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Opérations disponibles
              </Typography>
            </Box>
            <Divider />
            {ACTIONS.map((action, i) => (
              <Box key={action.key}>
                <MenuItem
                  onClick={() => { onAction(action.key); setAnchor(null); }}
                  sx={{ py: 1.5, px: 2, '&:hover': { bgcolor: `${action.color}08` } }}
                >
                  <ListItemIcon sx={{ color: action.color, minWidth: 36 }}>{action.icon}</ListItemIcon>
                  <ListItemText
                    primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>{action.label}</Typography>}
                    secondary={<Typography variant="caption" color="text.secondary">{action.desc}</Typography>}
                  />
                </MenuItem>
                {i < ACTIONS.length - 1 && <Divider sx={{ mx: 2, opacity: 0.5 }} />}
              </Box>
            ))}
          </Menu>
        </Box>

        {/* Tableau — hauteur fixe */}
        <TableContainer sx={{ flex: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Type', 'Montant', 'Description', 'Référence', 'Statut', 'Date'].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ border: 'none' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
                      <ReceiptIcon sx={{ fontSize: 48, color: 'rgba(0,0,0,0.1)', mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        Aucune transaction
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((tx) => (
                  <TableRow key={tx.id} hover>
                    <TableCell><StatusBadge status={tx.type} /></TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {fmt(tx.amount)} MAD
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 150 }} noWrap>
                        {tx.description || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'text.secondary' }}>
                        {tx.reference?.slice(0, 16)}...
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={tx.status}
                        size="small"
                        sx={{
                          bgcolor: tx.status === 'SUCCESS' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          color: tx.status === 'SUCCESS' ? '#10B981' : '#EF4444',
                          fontWeight: 700, fontSize: '0.68rem',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {new Date(tx.created_at).toLocaleString('fr-FR', {
                          day: '2-digit', month: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          component="div"
          count={transactions.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50]}
          labelRowsPerPage="Lignes"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
        />
      </CardContent>
    </Card>
  );
}