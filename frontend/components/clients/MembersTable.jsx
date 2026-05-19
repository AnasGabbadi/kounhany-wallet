'use client';
import { useState } from 'react';
import {
    Box, Typography, Avatar, Chip, Table, TableBody,
    TableCell, TableHead, TableRow, TableContainer, TablePagination,
} from '@mui/material';

export default function MembersTable({ members = [] }) {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(8);

    const paginated = members.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    if (members.length === 0) {
        return (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                Aucun membre dans cette organisation
            </Typography>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <TableContainer sx={{ flex: 1 }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            {['Membre', 'Email', 'Commandes', 'Total consommé', 'Statut', 'Depuis'].map(h => (
                                <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                                    {h}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginated.map((m) => (
                            <TableRow key={m.client_id} hover sx={{ opacity: m.active ? 1 : 0.6 }}>
                                <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <Avatar sx={{
                                            width: 34, height: 34,
                                            bgcolor: m.active ? '#FAC345' : '#6B7280',
                                            color: '#212529', fontWeight: 700, fontSize: '0.8rem',
                                        }}>
                                            {m.name?.charAt(0).toUpperCase()}
                                        </Avatar>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.name}</Typography>
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">{m.email || '—'}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={`${m.total_orders} commande${m.total_orders > 1 ? 's' : ''}`}
                                        size="small"
                                        sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: '#3B82F6', fontWeight: 700, fontSize: '0.68rem' }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#10B981' }}>
                                        {Number(m.total_amount || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={m.active ? 'Actif' : 'Inactif'}
                                        size="small"
                                        sx={{
                                            fontWeight: 700, fontSize: '0.72rem',
                                            bgcolor: m.active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                                            color: m.active ? '#10B981' : '#EF4444',
                                            border: `1px solid ${m.active ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                        }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Typography variant="caption" color="text.secondary">
                                        {m.created_at ? new Date(m.created_at).toLocaleDateString('fr-FR') : '—'}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <TablePagination
                component="div"
                count={members.length}
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
