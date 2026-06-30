'use client';
import useSWR from 'swr';
import { useState } from 'react';
import {
  Box, Typography, Alert, CircularProgress, Button, Card, CardContent,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Tooltip, Stack,
} from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import { billingSchedulesApi } from '@/lib/api';
import { usePermissions } from '@/lib/permissions';

const STATUS_CONFIG = {
  PENDING: { label: 'Planifié', bg: 'rgba(107,114,128,0.1)', color: '#6B7280' },
  RUNNING: { label: 'En cours', bg: 'rgba(59,130,246,0.1)',  color: '#3B82F6' },
  DONE:    { label: 'Terminé',  bg: 'rgba(16,185,129,0.1)',  color: '#10B981' },
  ERROR:   { label: 'Erreur',   bg: 'rgba(239,68,68,0.1)',   color: '#EF4444' },
};

const HEADERS = ['Label', 'Période', "Date d'exécution", 'Statut', 'Actions'];
const EMPTY_FORM = { label: '', period: '', scheduled_at: '' };

export default function FacturationPage() {
  const { hasPermission } = usePermissions();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteDialogId, setDeleteDialogId] = useState(null);
  const [runningId, setRunningId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const { data, isLoading, mutate } = useSWR(
    'billing-schedules',
    () => billingSchedulesApi.list(),
    { refreshInterval: 10000 }
  );

  const schedules = data?.data || [];
  const paginated = schedules.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const isImmediate = form.scheduled_at && new Date(form.scheduled_at) <= new Date();

  const openCreate = () => {
    setEditSchedule(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const toLocalInputValue = (iso) => {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openEdit = (schedule) => {
    setEditSchedule(schedule);
    setForm({
      label: schedule.label,
      period: schedule.period,
      scheduled_at: schedule.scheduled_at ? toLocalInputValue(schedule.scheduled_at) : '',
    });
    setModalOpen(true);
  };

  const handleField = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        label: form.label,
        period: form.period,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
      };
      if (editSchedule) {
        await billingSchedulesApi.update(editSchedule.id, payload);
        setSuccess('Planification modifiée');
      } else {
        await billingSchedulesApi.create(payload);
        setSuccess(isImmediate ? 'Facturation lancée immédiatement' : 'Planification créée');
      }
      setModalOpen(false);
      mutate();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await billingSchedulesApi.delete(deleteDialogId);
      setDeleteDialogId(null);
      setSuccess('Planification supprimée');
      mutate();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRunNow = async (schedule) => {
    setRunningId(schedule.id);
    setError(null);
    try {
      await billingSchedulesApi.runNow(schedule.id);
      setSuccess('Exécution lancée');
      setTimeout(() => mutate(), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunningId(null);
    }
  };

  const formValid = form.label.trim() && /^\d{4}-\d{2}$/.test(form.period) && form.scheduled_at;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <ReceiptLongIcon sx={{ color: '#FAC345', fontSize: 24 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Facturation Logistique</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {schedules.length} planification{schedules.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
        {hasPermission('facturation.create') && (
          <Button
            variant="contained"
            startIcon={<ReceiptLongIcon />}
            onClick={openCreate}
            sx={{ bgcolor: '#FAC345', color: '#212529', boxShadow: 'none', fontWeight: 700, '&:hover': { bgcolor: '#a8832d', boxShadow: 'none' } }}
          >
            Planifier une facturation
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Table */}
      <Card sx={{ width: '100%', minHeight: 'calc(100vh - 380px)', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column', '&:last-child': { pb: 2 } }}>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Planifications</Typography>
            <Chip
              label={`${schedules.length} planification${schedules.length !== 1 ? 's' : ''}`}
              size="small"
              sx={{ bgcolor: 'rgba(0,0,0,0.06)', fontWeight: 600 }}
            />
          </Box>

          <TableContainer sx={{ flex: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {HEADERS.map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={HEADERS.length} align="center" sx={{ py: 6, border: 'none' }}>
                      <CircularProgress sx={{ color: '#FAC345' }} />
                    </TableCell>
                  </TableRow>
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={HEADERS.length} sx={{ border: 'none' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
                        <ReceiptLongIcon sx={{ fontSize: 48, color: 'rgba(0,0,0,0.1)', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                          Aucune planification — cliquez sur &quot;Planifier une facturation&quot; pour commencer.
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : paginated.map((s) => {
                  const status = STATUS_CONFIG[s.status] || STATUS_CONFIG.PENDING;
                  return (
                    <TableRow key={s.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.label}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {s.period}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(s.scheduled_at).toLocaleDateString('fr-FR')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(s.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={status.label}
                          size="small"
                          sx={{ bgcolor: status.bg, color: status.color, fontWeight: 700, fontSize: '0.68rem' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {s.status === 'RUNNING' && (
                            <CircularProgress size={20} sx={{ color: '#3B82F6', m: 1 }} />
                          )}
                          {s.status === 'PENDING' && (
                            <>
                              {hasPermission('facturation.edit') && (
                                <Tooltip title="Modifier">
                                  <IconButton size="small" onClick={() => openEdit(s)}>
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {hasPermission('facturation.delete') && (
                                <Tooltip title="Supprimer">
                                  <IconButton size="small" onClick={() => setDeleteDialogId(s.id)} sx={{ '&:hover': { color: '#EF4444' } }}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {hasPermission('facturation.run') && (
                                <Tooltip title="Exécuter maintenant">
                                  <span>
                                    <IconButton size="small" onClick={() => handleRunNow(s)} disabled={runningId === s.id} sx={{ '&:hover': { color: '#10B981' } }}>
                                      {runningId === s.id ? <CircularProgress size={16} /> : <PlayArrowIcon fontSize="small" />}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              )}
                            </>
                          )}
                          {(s.status === 'DONE' || s.status === 'ERROR') && hasPermission('facturation.run') && (
                            <Tooltip title="Relancer">
                              <span>
                                <IconButton size="small" onClick={() => handleRunNow(s)} disabled={runningId === s.id} sx={{ '&:hover': { color: '#FAC345' } }}>
                                  {runningId === s.id ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={schedules.length}
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

      {/* Modal Créer / Modifier */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editSchedule ? 'Modifier la planification' : 'Planifier une facturation'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Label"
              value={form.label}
              onChange={handleField('label')}
              fullWidth
              size="small"
              placeholder="Ex : Facturation juin 2026"
            />
            <TextField
              label="Période à facturer (YYYY-MM)"
              value={form.period}
              onChange={handleField('period')}
              fullWidth
              size="small"
              placeholder="2026-06"
              inputProps={{ pattern: '\\d{4}-\\d{2}' }}
            />
            <TextField
              label="Date d'exécution planifiée"
              type="datetime-local"
              value={form.scheduled_at}
              onChange={handleField('scheduled_at')}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            {isImmediate && (
              <Alert severity="info" sx={{ py: 0.5 }}>
                Cette facturation sera exécutée immédiatement.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setModalOpen(false)} color="inherit">Annuler</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !formValid}
            sx={{ bgcolor: '#FAC345', color: '#212529', boxShadow: 'none', fontWeight: 700, '&:hover': { bgcolor: '#a8832d', boxShadow: 'none' } }}
          >
            {saving ? <CircularProgress size={18} sx={{ color: '#212529' }} /> : (editSchedule ? 'Enregistrer' : 'Planifier')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation suppression */}
      <Dialog open={!!deleteDialogId} onClose={() => setDeleteDialogId(null)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Supprimer la planification ?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Cette action est irréversible. La planification sera supprimée définitivement.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogId(null)} color="inherit">Annuler</Button>
          <Button
            variant="contained"
            onClick={handleDelete}
            sx={{ bgcolor: '#EF4444', color: 'white', boxShadow: 'none', '&:hover': { bgcolor: '#b91c1c', boxShadow: 'none' } }}
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
