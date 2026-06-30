'use client';
import useSWR from 'swr';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert,
  TablePagination, Avatar, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, FormControlLabel, Switch,
  Accordion, AccordionSummary, AccordionDetails, Divider,
} from '@mui/material';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import { adminApi, permissionsApi } from '@/lib/api';
import { getLocalRole } from '@/lib/permissions';

const ROLE_CONFIG = {
  admin:   { label: 'Admin',   bg: 'rgba(239,68,68,0.1)',   color: '#EF4444' },
  manager: { label: 'Manager', bg: 'rgba(250,195,69,0.1)',  color: '#D97706' },
};

const STATUS_CONFIG = {
  true:  { label: 'Actif',   bg: 'rgba(16,185,129,0.1)', color: '#10B981' },
  false: { label: 'Inactif', bg: 'rgba(107,114,128,0.1)', color: '#6B7280' },
};

// Groupe les permissions par module
function groupByModule(definitions) {
  const grouped = {};
  for (const [module, perms] of Object.entries(definitions)) {
    grouped[module] = perms;
  }
  return grouped;
}

function PermissionsDialog({ open, onClose, onSaved }) {
  const [permissions, setPermissions] = useState({});
  const [definitions, setDefinitions] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    Promise.all([
      permissionsApi.definitions(),
      permissionsApi.getManager(),
    ]).then(([defs, current]) => {
      setDefinitions(defs.data || {});
      setPermissions(current.data || {});
      setLoading(false);
    }).catch(err => {
      setError(err.message);
      setLoading(false);
    });
  }, [open]);

  const toggle = (key) => setPermissions(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await permissionsApi.updateManager(permissions);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        Permissions Managers
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: '#FAC345' }} />
          </Box>
        ) : (
          Object.entries(definitions).map(([module, perms]) => (
            <Accordion key={module} disableGutters elevation={0}
              sx={{ border: '1px solid rgba(0,0,0,0.08)', mb: 1, borderRadius: '8px !important', '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}
                sx={{ borderRadius: 2, '&.Mui-expanded': { borderBottom: '1px solid rgba(0,0,0,0.06)' } }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{module}</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 1.5, pb: 1 }}>
                {perms.map(perm => (
                  <FormControlLabel
                    key={perm.key}
                    control={
                      <Switch
                        checked={Boolean(permissions[perm.key])}
                        onChange={() => toggle(perm.key)}
                        size="small"
                        sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#FAC345' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#FAC345' } }}
                      />
                    }
                    label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>{perm.label}</Typography>}
                    sx={{ display: 'flex', mb: 0.5, ml: 0 }}
                  />
                ))}
              </AccordionDetails>
            </Accordion>
          ))
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Annuler</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || loading}
          sx={{ bgcolor: '#FAC345', color: '#212529', boxShadow: 'none', fontWeight: 700, '&:hover': { bgcolor: '#a8832d', boxShadow: 'none' } }}
        >
          {saving ? <CircularProgress size={18} sx={{ color: '#212529' }} /> : 'Enregistrer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function UtilisateursPage() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Protection : admin uniquement
  useEffect(() => {
    if (getLocalRole() !== 'admin') {
      router.replace('/');
    }
  }, [router]);

  const { data, isLoading, error, mutate } = useSWR(
    'admin-users',
    () => adminApi.listUsers(),
    { refreshInterval: 5 * 60 * 1000 }
  );

  const users = data?.data || [];
  const paginated = users.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleSaved = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <PeopleOutlineIcon sx={{ color: '#FAC345', fontSize: 24 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Utilisateurs</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {users.length} utilisateur{users.length !== 1 ? 's' : ''} (Admins + Managers)
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<ManageAccountsIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{ bgcolor: '#FAC345', color: '#212529', boxShadow: 'none', fontWeight: 700, '&:hover': { bgcolor: '#a8832d', boxShadow: 'none' } }}
        >
          Gérer les permissions Managers
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error.message}</Alert>}
      {savedSuccess && <Alert severity="success" sx={{ mb: 3 }}>Permissions managers mises à jour</Alert>}

      <Card sx={{ width: '100%', minHeight: 'calc(100vh - 320px)', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column', '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Liste des utilisateurs</Typography>
            <Chip label={`${users.length}`} size="small" sx={{ bgcolor: 'rgba(0,0,0,0.06)', fontWeight: 600 }} />
          </Box>

          <TableContainer sx={{ flex: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Nom', 'Email', 'Rôle', 'Statut'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ border: 'none', textAlign: 'center', py: 6 }}>
                      <CircularProgress sx={{ color: '#FAC345' }} />
                    </TableCell>
                  </TableRow>
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ border: 'none' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
                        <PeopleOutlineIcon sx={{ fontSize: 48, color: 'rgba(0,0,0,0.1)', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">Aucun utilisateur</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : paginated.map((user) => {
                  const roleCfg = ROLE_CONFIG[user.role] || ROLE_CONFIG.manager;
                  const statusCfg = STATUS_CONFIG[String(user.is_active)];
                  return (
                    <TableRow key={user.username} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: '#FAC345', color: '#212529', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                            {(user.name || user.username || '?').charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {user.name || user.username}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                          {user.email || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={roleCfg.label} size="small"
                          sx={{ bgcolor: roleCfg.bg, color: roleCfg.color, fontWeight: 700, fontSize: '0.68rem', height: 20 }} />
                      </TableCell>
                      <TableCell>
                        <Chip label={statusCfg.label} size="small"
                          sx={{ bgcolor: statusCfg.bg, color: statusCfg.color, fontWeight: 700, fontSize: '0.68rem', height: 20 }} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={users.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
            rowsPerPageOptions={[10, 25, 50]}
            labelRowsPerPage="Lignes"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
          />
        </CardContent>
      </Card>

      <PermissionsDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />
    </Box>
  );
}
