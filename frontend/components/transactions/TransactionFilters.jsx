'use client';
import {
  Box, TextField, InputAdornment, Select, MenuItem,
  FormControl, InputLabel, Button, Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FilterListIcon from '@mui/icons-material/FilterList';

const TYPES = ['PAYMENT', 'BLOCK', 'CONFIRM', 'EXTERNAL_DEBT', 'EXTERNAL_PAYMENT'];

export default function TransactionFilters({
  search, setSearch,
  typeFilter, setTypeFilter,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  onExport,
  filteredCount, totalCount,
}) {
  const hasFilters = search || typeFilter || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Client, référence, description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ width: { xs: '100%', sm: 250 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Type</InputLabel>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} label="Type">
            <MenuItem value="">Tous</MenuItem>
            {TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>

        <TextField
          label="Date début"
          type="date"
          size="small"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 150 }}
        />

        <TextField
          label="Date fin"
          type="date"
          size="small"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 150 }}
        />

        {hasFilters && (
          <Chip
            label={`${filteredCount}/${totalCount} résultats`}
            size="small"
            onDelete={clearFilters}
            sx={{ bgcolor: 'rgba(250,195,69,0.1)', color: '#E0A820', fontWeight: 600 }}
          />
        )}

        <Box sx={{ ml: 'auto' }}>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={onExport}
            size="small"
            sx={{ borderColor: 'rgba(0,0,0,0.2)', color: 'text.secondary', fontWeight: 600 }}
          >
            Export CSV
          </Button>
        </Box>
      </Box>
    </Box>
  );
}