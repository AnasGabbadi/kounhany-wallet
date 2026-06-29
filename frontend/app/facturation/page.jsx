'use client';
import useSWR from 'swr';
import { useState } from 'react';
import {
  Box, Typography, Alert, CircularProgress, Button, Card,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Tooltip, Stack,
} from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import { billingSchedulesApi } from '@/lib/api';

const STATUS_CONFIG = {
  PENDING: { label: 'Planifié',  color: '#6B7280' },
  RUNNING: { label: 'En cours',  color: '#3B82F6' },
  DONE:    { label: 'Terminé',   color: '#10B981' },
  ERROR:   { label: 'Erreur',    color: '#EF4444' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <Box component="span" sx={{
      display: 'inline-block', px: 1.5, py: 0.4,
      bgcolor: `${cfg.color}20`, color: cfg.color,
      borderRadius: 1, fontWeight: 600, fontSize: '0.75rem',
      border: `1px solid ${cfg.color}40`,
    }}>
      {cfg.label}
    </Box>
  );
}

const EMPTY_FORM = { label: '', period: '', scheduled_at: '' };

export default function FacturationPage() {
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
  const isImmediate = form.scheduled_at && new Date(form.scheduled_at) <= new Date();

  const openCreate = () => {
    setEditSchedule(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (schedule) => {
    setEditSchedule(schedule);
    setForm({
      label: schedule.label,
      period: schedule.period,
      scheduled_at: schedule.scheduled_at
        ? new Date(schedule.scheduled_at).toISOString().slice(0, 16)
        : '',
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
        <Button
          variant="contained"
          startIcon={<ReceiptLongIcon />}
          onClick={openCreate}
          sx={{ bgcolor: '#FAC345', color: '#212529', boxShadow: 'none', fontWeight: 700, '&:hover': { bgcolor: '#a8832d', boxShadow: 'none' } }}
        >
          Planifier une facturation
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.8rem', color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider' } }}>
                <TableCell>Label</TableCell>
                <TableCell>Période</TableCell>
                <TableCell>Date d&apos;exécution</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <CircularProgress sx={{ color: '#FAC345' }} />
                  </TableCell>
                </TableRow>
              ) : schedules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    Aucune planification — cliquez sur &quot;Planifier une facturation&quot; pour commencer.
                  </TableCell>
                </TableRow>
              ) : schedules.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{s.label}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{s.period}</TableCell>
                  <TableCell sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                    {new Date(s.scheduled_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      {s.status === 'RUNNING' && (
                        <CircularProgress size={20} sx={{ color: '#3B82F6', m: 1 }} />
                      )}
                      {s.status === 'PENDING' && (
                        <>
                          <Tooltip title="Modifier">
                            <IconButton size="small" onClick={() => openEdit(s)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Supprimer">
                            <IconButton size="small" onClick={() => setDeleteDialogId(s.id)} sx={{ '&:hover': { color: '#EF4444' } }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Exécuter maintenant">
                            <IconButton size="small" onClick={() => handleRunNow(s)} disabled={runningId === s.id} sx={{ '&:hover': { color: '#10B981' } }}>
                              {runningId === s.id ? <CircularProgress size={16} /> : <PlayArrowIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      {(s.status === 'DONE' || s.status === 'ERROR') && (
                        <Tooltip title="Relancer">
                          <IconButton size="small" onClick={() => handleRunNow(s)} disabled={runningId === s.id} sx={{ '&:hover': { color: '#FAC345' } }}>
                            {runningId === s.id ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
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
