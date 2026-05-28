import { Link, NavLink, Route, Routes, useParams } from 'react-router-dom';
import { Sparkles, LayoutGrid, Network, NotebookText, FileInput, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import Dashboard from '@/pages/Dashboard';
import CreateCampaign from '@/pages/CreateCampaign';
import AnalyzePage from '@/pages/AnalyzePage';
import GraphPage from '@/pages/GraphPage';
import SessionPrepPage from '@/pages/SessionPrepPage';
import ImportExportPage from '@/pages/ImportExportPage';

function CampaignNav() {
  const { id } = useParams();
  if (!id) return null;
  const link = (to: string, label: string, Icon: typeof Sparkles) => (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
          isActive
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
  return (
    <nav className="flex items-center gap-1">
      {link(`/campaigns/${id}/analyze`, 'Analyse', Sparkles)}
      {link(`/campaigns/${id}/graph`, 'Graph', Network)}
      {link(`/campaigns/${id}/session-prep`, 'Session Prep', NotebookText)}
      {link(`/campaigns/${id}/import-export`, 'Im-/Export', FileInput)}
    </nav>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <span className="font-display text-lg tracking-wider">LoreGraph</span>
          </Link>
          <Routes>
            <Route path="/campaigns/:id/*" element={<CampaignNav />} />
          </Routes>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <LayoutGrid className="h-4 w-4" />
              Kampagnen
            </Link>
            <Link
              to="/campaigns/import-export"
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Upload className="h-4 w-4" />
              Import
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/campaigns/new" element={<CreateCampaign />} />
          <Route path="/campaigns/import-export" element={<ImportExportPage />} />
          <Route path="/campaigns/:id/analyze" element={<AnalyzePage />} />
          <Route path="/campaigns/:id/graph" element={<GraphPage />} />
          <Route path="/campaigns/:id/session-prep" element={<SessionPrepPage />} />
          <Route path="/campaigns/:id/import-export" element={<ImportExportPage />} />
          <Route
            path="*"
            element={
              <div className="container py-24 text-center text-muted-foreground">
                Seite nicht gefunden.
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
