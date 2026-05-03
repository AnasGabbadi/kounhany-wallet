'use client';
import {
  Card, CardContent, Typography, Chip, Box,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Tooltip,
  CircularProgress, TablePagination, Avatar, Button,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { useState } from 'react';
import OrderDetailDialog from '@/components/orders/OrderDetailDialog';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });

const STATUS_CONFIG = {
  BLOCKED:   { label: 'Bloqué',     bg: 'rgba(245,158,11,0.1)',  color: '#F59E0B' },
  CONFIRMED: { label: 'Confirmé',   bg: 'rgba(59,130,246,0.1)',  color: '#3B82F6' },
  CANCELLED: { label: 'Annulé',     bg: 'rgba(239,68,68,0.1)',   color: '#EF4444' },
  PAID:      { label: 'Payé',       bg: 'rgba(16,185,129,0.1)',  color: '#10B981' },
  PENDING:   { label: 'En attente', bg: 'rgba(107,114,128,0.1)', color: '#6B7280' },
};

const TYPE_CONFIG = {
  FLEET:      { label: 'Fleet',      bg: '#FAC34515', color: '#B8860B' },
  LOGISTIQUE: { label: 'Logistique', bg: '#3B82F615', color: '#3B82F6' },
  B2C:        { label: 'B2C',        bg: '#10B98115', color: '#10B981' },
};

export default function OrdersTable({ orders = [], onConfirm, onCancel, actionLoading, showClient = false }) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const paginated = orders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const headers = showClient
    ? ['Client', 'Réf.', 'Type', 'Montant', 'Description', 'Statut', 'Date', 'Actions']
    : ['Réf.', 'Type', 'Montant', 'Description', 'Statut', 'Date', 'Actions'];

  return (
    <>
      <Card sx={{ width: '100%', minHeight: 'calc(100vh - 380px)', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column', '&:last-child': { pb: 2 } }}>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Liste des commandes</Typography>
            <Chip
              label={`${orders.length} commande${orders.length > 1 ? 's' : ''}`}
              size="small"
              sx={{ bgcolor: 'rgba(0,0,0,0.06)', fontWeight: 600 }}
            />
          </Box>

          <TableContainer sx={{ flex: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {headers.map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={headers.length} sx={{ border: 'none' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
                        <ShoppingBagOutlinedIcon sx={{ fontSize: 48, color: 'rgba(0,0,0,0.1)', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">Aucune commande</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((order) => {
                    const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
                    const type = TYPE_CONFIG[order.order_type] || {};
                    const isLoading = actionLoading === order.id;

                    return (
                      <TableRow key={order.id} hover>

                        {/* Colonne Client — même style que ClientsTable */}
                        {showClient && (
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Avatar sx={{
                                width: 34, height: 34,
                                bgcolor: '#FAC345', color: '#212529',
                                fontWeight: 700, fontSize: '0.8rem', flexShrink: 0,
                              }}>
                                {order.client_name?.charAt(0).toUpperCase() || '?'}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {order.client_name || '—'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.68rem' }}>
                                  {order.client_id}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                        )}

                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'text.secondary' }}>
                            {order.reference?.slice(0, 16)}...
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Chip label={type.label || order.order_type} size="small"
                            sx={{ bgcolor: type.bg, color: type.color, fontWeight: 700, fontSize: '0.65rem', height: 20 }} />
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {fmt(order.amount)} MAD
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 180 }} noWrap>
                            {order.description || '—'}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Chip label={status.label} size="small"
                            sx={{ bgcolor: status.bg, color: status.color, fontWeight: 700, fontSize: '0.68rem' }} />
                        </TableCell>

                        <TableCell>
                          <Typography variant="body2">
                            {new Date(order.created_at).toLocaleDateString('fr-FR')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        </TableCell>

                        {/* Actions */}
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                            {order.status === 'BLOCKED' && (
                              <>
                                <Tooltip title="Confirmer">
                                  <span>
                                    <IconButton size="small" onClick={() => onConfirm(order.id)} disabled={isLoading}
                                      sx={{ color: '#3B82F6', '&:hover': { bgcolor: 'rgba(59,130,246,0.08)' } }}>
                                      {isLoading ? <CircularProgress size={14} /> : <CheckCircleOutlineIcon fontSize="small" />}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                                <Tooltip title="Annuler">
                                  <span>
                                    <IconButton size="small" onClick={() => onCancel(order.id)} disabled={isLoading}
                                      sx={{ color: '#EF4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.08)' } }}>
                                      <CancelOutlinedIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </>
                            )}
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<ReceiptIcon sx={{ fontSize: '13px !important' }} />}
                              onClick={() => setSelectedOrder(order)}
                              sx={{
                                fontSize: '0.7rem', py: 0.2, px: 1,
                                borderColor: 'rgba(0,0,0,0.2)', color: 'text.secondary',
                                '&:hover': { borderColor: 'rgba(0,0,0,0.4)', bgcolor: 'rgba(0,0,0,0.04)' },
                              }}
                            >
                              Détail
                            </Button>
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
            count={orders.length}
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

      <OrderDetailDialog
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </>
  );
}