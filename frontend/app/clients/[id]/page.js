'use client';
import useSWR from 'swr';
import { use, useState } from 'react';
import {
    Box, Typography, Card, CardContent, Avatar, Chip,
    Divider, CircularProgress, Button, TextField, InputAdornment,
} from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import StarIcon from '@mui/icons-material/Star';
import PeopleIcon from '@mui/icons-material/People';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BlockIcon from '@mui/icons-material/Block';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useRouter } from 'next/navigation';
import api, { kpisApi } from '@/lib/api';
import MembersTable from '@/components/clients/MembersTable';

const NIVEAU_CONFIG = {
    EXCELLENT: { color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
    BON: { color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' },
    MOYEN: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
    RISQUÉ: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
    NOUVEAU: { color: '#6B7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)' },
};

export default function OrganisationDetailPage({ params }) {
    const { id } = use(params);
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const { data: clients = [] } = useSWR('clients', () => kpisApi.clients());
    const company = clients.find(c => c.client_id === id);

    const { data: score } = useSWR(`score-${id}`, () => kpisApi.clientScore(id));

    const { data: members = [], isLoading: membersLoading } = useSWR(
        `members-${id}`,
        () => api.get(`/clients/${id}/members`).then(r => r?.data || [])
    );

    const filteredMembers = members
        .filter(m => statusFilter === 'all' || (statusFilter === 'active' ? m.active : !m.active))
        .filter(m =>
            m.name?.toLowerCase().includes(search.toLowerCase()) ||
            m.email?.toLowerCase().includes(search.toLowerCase())
        );

    const activeCount = members.filter(m => m.active).length;
    const inactiveCount = members.filter(m => !m.active).length;

    if (!company) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress sx={{ color: '#FAC345' }} />
            </Box>
        );
    }

    const niveau = score?.niveau || 'NOUVEAU';
    const scoreConfig = NIVEAU_CONFIG[niveau] || NIVEAU_CONFIG.NOUVEAU;

    return (
        <Box>
            {/* Retour + Header */}
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => router.push('/clients/organisations')}
                    sx={{ color: 'text.secondary', flexShrink: 0 }}
                >
                    Retour
                </Button>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ width: 42, height: 42, bgcolor: '#FAC345', color: '#000' }}>
                        <GroupIcon />
                    </Avatar>
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="h5" sx={{ fontWeight: 700 }}>{company.name}</Typography>
                            <Chip
                                label={company.active ? 'Actif' : 'Inactif'}
                                size="small"
                                sx={{
                                    fontWeight: 700, fontSize: '0.72rem',
                                    bgcolor: company.active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                                    color: company.active ? '#10B981' : '#EF4444',
                                    border: `1px solid ${company.active ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                }}
                            />
                            {score && (
                                <Chip
                                    icon={<StarIcon sx={{ fontSize: '11px !important', color: `${scoreConfig.color} !important` }} />}
                                    label={`${score.score}/100 · ${niveau}`}
                                    size="small"
                                    sx={{ bgcolor: scoreConfig.bg, color: scoreConfig.color, fontWeight: 700, fontSize: '0.72rem', border: `1px solid ${scoreConfig.border}` }}
                                />
                            )}
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            {company.client_id}
                        </Typography>
                    </Box>
                </Box>
            </Box>

            {/* KPI Cards */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                {[
                    {
                        label: 'Total membres',
                        value: members.length,
                        sub: 'Dans cette organisation',
                        icon: <PeopleIcon sx={{ fontSize: 22, color: '#FAC345' }} />,
                        iconBg: 'rgba(250,195,69,0.1)',
                    },
                    {
                        label: 'Membres actifs',
                        value: activeCount,
                        sub: `${members.length > 0 ? Math.round(activeCount / members.length * 100) : 0}% du total`,
                        icon: <CheckCircleOutlineIcon sx={{ fontSize: 22, color: '#10B981' }} />,
                        iconBg: 'rgba(16,185,129,0.1)',
                    },
                    {
                        label: 'Membres inactifs',
                        value: inactiveCount,
                        sub: inactiveCount === 0 ? 'Aucun inactif' : 'Accès désactivé',
                        icon: <BlockIcon sx={{ fontSize: 22, color: '#EF4444' }} />,
                        iconBg: 'rgba(239,68,68,0.1)',
                    },
                    {
                        label: 'Score',
                        value: score ? `${score.score}/100` : '—',
                        sub: niveau,
                        icon: <EmojiEventsIcon sx={{ fontSize: 22, color: scoreConfig.color }} />,
                        iconBg: scoreConfig.bg,
                    },
                ].map((kpi) => (
                    <Card key={kpi.label} sx={{ flex: 1, minWidth: 160 }}>
                        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                        {kpi.label}
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2, mt: 0.5 }}>
                                        {kpi.value}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                                        {kpi.sub}
                                    </Typography>
                                </Box>
                                <Box sx={{ p: 1, borderRadius: 2, bgcolor: kpi.iconBg }}>
                                    {kpi.icon}
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                ))}
            </Box>

            {/* Membres */}
            <Card sx={{ width: '100%', minHeight: 'calc(100vh - 420px)', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column', '&:last-child': { pb: 2 } }}>
                    {/* Filtres */}
                    <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
                        <TextField
                            placeholder="Nom, email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            size="small"
                            sx={{ width: 220 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" color="action" />
                                    </InputAdornment>
                                ),
                            }}
                        />
                        {[
                            { label: 'Tous', value: 'all' },
                            { label: `Actifs (${activeCount})`, value: 'active' },
                            { label: `Inactifs (${inactiveCount})`, value: 'inactive' },
                        ].map(f => (
                            <Chip
                                key={f.value}
                                label={f.label}
                                size="small"
                                onClick={() => setStatusFilter(f.value)}
                                sx={{
                                    cursor: 'pointer',
                                    fontWeight: statusFilter === f.value ? 700 : 400,
                                    bgcolor: statusFilter === f.value ? '#FAC345' : 'rgba(0,0,0,0.06)',
                                    color: statusFilter === f.value ? '#212529' : 'text.secondary',
                                    border: statusFilter === f.value ? '1px solid #FAC345' : '1px solid transparent',
                                    '&:hover': { bgcolor: statusFilter === f.value ? '#E0A820' : 'rgba(0,0,0,0.1)' },
                                }}
                            />
                        ))}
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                            {filteredMembers.length} membre{filteredMembers.length > 1 ? 's' : ''}
                        </Typography>
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    {membersLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress size={24} sx={{ color: '#FAC345' }} />
                        </Box>
                    ) : filteredMembers.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                            Aucun membre trouvé
                        </Typography>
                    ) : (
                        <MembersTable members={filteredMembers} />
                    )}
                </CardContent>
            </Card>
        </Box>  
    );
}