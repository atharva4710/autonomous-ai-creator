
import { useHealthCheck } from './hooks/useHealthCheck';

export default function App() {
  const { status, lastChecked, isChecking, check } = useHealthCheck();

  // Helper to get status details
  const getStatusDetails = () => {
    switch (status) {
      case 'connected':
        return {
          label: 'Backend: Connected',
          colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          indicatorClass: 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]',
          message: 'Frontend is successfully connected to the Autonomous AI Creator backend.',
        };
      case 'offline':
        return {
          label: 'Backend: Offline',
          colorClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          indicatorClass: 'bg-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]',
          message: 'Unable to reach the backend. Check that the server is running and configuration is correct.',
        };
      case 'checking':
      default:
        return {
          label: 'Backend: Checking...',
          colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          indicatorClass: 'bg-amber-500 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.5)]',
          message: 'Pinging backend health check endpoint...',
        };
    }
  };

  const statusDetails = getStatusDetails();
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-violet-500/30 selection:text-violet-200">
      {/* Top Header Navigation */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" stroke="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-zinc-50 to-zinc-300 bg-clip-text text-transparent">
                Autonomous AI Creator
              </span>
              <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
                Stage 0
              </span>
            </div>
          </div>

          {/* Quick status pill in header */}
          <div className="flex items-center space-x-2">
            <span className={`flex items-center text-xs font-semibold px-3 py-1 rounded-full border ${statusDetails.colorClass}`}>
              <span className={`h-2. w-2 rounded-full mr-2 ${statusDetails.indicatorClass}`} />
              {statusDetails.label}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-10 flex flex-col justify-center">

        {/* Banner/Hero area */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent mb-4">
            Autonomous AI Creator
          </h1>
          <p className="text-zinc-400 text-base sm:text-lg">
            A foundation layer visualizing autonomous tech personas, generative feeds, and editorial choices. Currently setting up system diagnostics.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Diagnostic Console Panel */}
          <div className="lg:col-span-1 bg-zinc-900/50 border border-zinc-900 rounded-2xl p-6 backdrop-blur-sm flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-zinc-100 mb-4 flex items-center">
                <svg className="h-5 w-5 mr-2 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" stroke="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                System Status
              </h3>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-900">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-semibold">Active Status</div>
                  <div className="flex items-center space-x-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${statusDetails.indicatorClass}`} />
                    <span className="font-semibold text-sm text-zinc-200">{statusDetails.label}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-900 space-y-2">
                  <div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Configured Endpoint</div>
                    <code className="text-xs text-violet-400 break-all select-all font-mono block mt-1">
                      {apiBaseUrl}/health
                    </code>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-900">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-semibold">Last Checked</div>
                  <div className="text-sm text-zinc-300 font-mono">
                    {lastChecked ? lastChecked.toLocaleTimeString() : 'Never'}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-zinc-900">
              <button
                type="button"
                onClick={check}
                disabled={isChecking}
                className="w-full flex items-center justify-center px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:border-zinc-900 border border-violet-500/20 text-white font-medium text-sm transition-all duration-200 shadow-lg shadow-violet-500/10 cursor-pointer disabled:cursor-not-allowed"
              >
                {isChecking ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Pinging API...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" stroke="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3 3L22 4" />
                    </svg>
                    Check Connection Now
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Locked Dashboard Mockups - Clean visual preview of Stage 1+ roadmap */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center">
                <svg className="h-5 w-5 mr-2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" stroke="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Core Capabilities Roadmap
              </h3>
              <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Upcoming Stages</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Persona Engine */}
              <div className="bg-zinc-900/25 border border-zinc-900/60 rounded-xl p-5 opacity-40 select-none relative overflow-hidden group">
                <div className="absolute top-3 right-3 flex items-center space-x-1.5 bg-zinc-950 px-2 py-0.5 rounded text-[10px] text-zinc-500 border border-zinc-900">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" stroke="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>STAGE 1</span>
                </div>
                <h4 className="font-semibold text-zinc-300 text-sm mb-1 flex items-center">
                  Persona & Branding Engine
                </h4>
                <p className="text-xs text-zinc-500">
                  Define voice parameters, styling rules, target demographics, and brand alignments for the creator.
                </p>
              </div>

              {/* Multi-Agent Orchestrator */}
              <div className="bg-zinc-900/25 border border-zinc-900/60 rounded-xl p-5 opacity-40 select-none relative overflow-hidden group">
                <div className="absolute top-3 right-3 flex items-center space-x-1.5 bg-zinc-950 px-2 py-0.5 rounded text-[10px] text-zinc-500 border border-zinc-900">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" stroke="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>STAGE 1</span>
                </div>
                <h4 className="font-semibold text-zinc-300 text-sm mb-1">
                  Multi-Agent Scheduler
                </h4>
                <p className="text-xs text-zinc-500">
                  Monitor search loops, research tasks, drafting routines, and direct publication triggers.
                </p>
              </div>

              {/* Editorial Decision Room */}
              <div className="bg-zinc-900/25 border border-zinc-900/60 rounded-xl p-5 opacity-40 select-none relative overflow-hidden group">
                <div className="absolute top-3 right-3 flex items-center space-x-1.5 bg-zinc-950 px-2 py-0.5 rounded text-[10px] text-zinc-500 border border-zinc-900">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" stroke="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>STAGE 2</span>
                </div>
                <h4 className="font-semibold text-zinc-300 text-sm mb-1">
                  Editorial Decision Room
                </h4>
                <p className="text-xs text-zinc-500">
                  Inspect generated outlines, confidence scores, sources checklist, and editing logs.
                </p>
              </div>

              {/* Feed & Publication Stream */}
              <div className="bg-zinc-900/25 border border-zinc-900/60 rounded-xl p-5 opacity-40 select-none relative overflow-hidden group">
                <div className="absolute top-3 right-3 flex items-center space-x-1.5 bg-zinc-950 px-2 py-0.5 rounded text-[10px] text-zinc-500 border border-zinc-900">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" stroke="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>STAGE 2</span>
                </div>
                <h4 className="font-semibold text-zinc-300 text-sm mb-1">
                  Creative Output Feed
                </h4>
                <p className="text-xs text-zinc-500">
                  Review generated posts, formatted copy, and scheduled release metadata.
                </p>
              </div>

            </div>

            {/* Warning block about Stage 0 constraints */}
            <div className="bg-zinc-900/30 border border-zinc-900/80 rounded-xl p-5 flex items-start space-x-3.5">
              <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 mt-0.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" stroke="12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Stage 0 Isolation Rules</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Interactive database modules, login portals, agent scheduling parameters, and media rendering nodes are bypassed in Stage 0. The interface will activate these systems once the core diagnostics pass and the backend endpoints are online.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-6">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-600">
          <div className="mb-4 sm:mb-0">
            &copy; 2026 Autonomous AI Creator. Hackathon Project.
          </div>
          <div className="flex space-x-6">
            <span>Developer 1: Backend & LLM Orchestrator</span>
            <span>Developer 2: Frontend Engineer</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
