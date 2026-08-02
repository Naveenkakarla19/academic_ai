import React, { useState } from 'react';
import { AgentStep } from '../types';
import { ShieldCheck, Database, Search, Award, Cpu, CheckCircle2, ArrowRight, Send, Bot, Sparkles, MessageSquare } from 'lucide-react';
import { sendAgentQuery } from '../lib/api';

interface AgentGraphVisualizerProps {
  agentSteps?: AgentStep[];
  activeStepNode?: string;
}

export const AgentGraphVisualizer: React.FC<AgentGraphVisualizerProps> = ({
  agentSteps: propAgentSteps = [],
  activeStepNode: propActiveStepNode,
}) => {
  const [userQuery, setUserQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [responseMarkdown, setResponseMarkdown] = useState<string | null>(null);
  const [liveAgentSteps, setLiveAgentSteps] = useState<AgentStep[]>(propAgentSteps);
  const [activeNode, setActiveNode] = useState<string | undefined>(propActiveStepNode);

  const [showStepLogs, setShowStepLogs] = useState(false);

  const nodes = [
    { id: 'START', label: 'Start Flow', icon: Cpu },
    { id: 'Authenticate User', label: 'Auth Agent', icon: ShieldCheck },
    { id: 'Intent Classification', label: 'Intent Classifier', icon: Search },
    { id: 'SQL Agent', label: 'PostgreSQL Agent', icon: Database },
    { id: 'RAG Retriever', label: 'RAG Vector Agent', icon: Search },
    { id: 'LLM Synthesis', label: 'Gemini LLM Node', icon: Award },
    { id: 'END', label: 'End Response', icon: CheckCircle2 },
  ];

  const currentSteps = liveAgentSteps.length > 0 ? liveAgentSteps : propAgentSteps;
  const executedNodeIds = new Set(currentSteps.map((s) => s.node));

  const sampleQueries = [
    'Who are the top rankers in college?',
    'What are the backlog regulations and rules?',
    'Show me the CS302 examination schedule',
    'How many students are eligible for campus placement drives?',
  ];

  const handleQuerySubmit = async (queryToRun?: string) => {
    const query = queryToRun || userQuery;
    if (!query.trim() || loading) return;

    setLoading(true);
    setResponseMarkdown(null);
    setLiveAgentSteps([]);
    setActiveNode('START');

    try {
      const res = await sendAgentQuery(query, '', 'admin');

      setResponseMarkdown(res.text);
      if (res.agentSteps && res.agentSteps.length > 0) {
        setLiveAgentSteps(res.agentSteps);
        setActiveNode(res.agentSteps[res.agentSteps.length - 1].node);
      }
    } catch (err: any) {
      setResponseMarkdown(`⚠️ **Query Execution Error**: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Interactive Agent Query Console Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              LangGraph Multi-Agent Architecture & Live Inspector
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ask any institutional or student academic query to trigger the 8-Node LangGraph State Machine
            </p>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            LangGraph Agent Core Active
          </span>
        </div>

        {/* Query Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleQuerySubmit();
          }}
          className="space-y-3"
        >
          <div className="relative flex items-center">
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Ask anything (e.g., 'Who are top rankers?', 'What are backlog rules?', 'Placement criteria')..."
              className="w-full bg-slate-950 text-white placeholder-slate-500 text-sm border border-slate-700/80 rounded-xl pl-4 pr-24 py-3 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={loading || !userQuery.trim()}
              className="absolute right-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-xs rounded-lg shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Tracing...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Run Query</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Prompts */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> Try Prompts:
            </span>
            {sampleQueries.map((sq, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setUserQuery(sq);
                  handleQuerySubmit(sq);
                }}
                className="bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 px-2.5 py-1 rounded-lg text-[11px] transition-colors"
              >
                {sq}
              </button>
            ))}
          </div>
        </form>

        {/* Visual Graph Diagram Nodes Flow */}
        <div className="pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">Live Agent Pipeline Nodes:</span>
            {loading && (
              <span className="text-[11px] text-cyan-400 font-mono animate-pulse">
                ⚡ Agent routing state machine...
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 lg:gap-3 py-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            {nodes.map((node, idx) => {
              const Icon = node.icon;
              const isExecuted = executedNodeIds.has(node.id as any);
              const isActive = activeNode === node.id || (loading && idx === 2);

              return (
                <React.Fragment key={node.id}>
                  <div
                    className={`flex items-center space-x-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      isActive
                        ? 'border-cyan-400 bg-cyan-950/90 text-cyan-200 ring-2 ring-cyan-500/40 scale-105 shadow-lg shadow-cyan-500/20'
                        : isExecuted
                        ? 'border-indigo-500/60 bg-indigo-950/50 text-indigo-200 shadow-md'
                        : 'border-slate-800 bg-slate-950/60 text-slate-500 opacity-60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{node.label}</span>
                    {isExecuted && <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-1" />}
                  </div>

                  {idx < nodes.length - 1 && (
                    <ArrowRight className={`w-3.5 h-3.5 hidden sm:block ${isExecuted ? 'text-indigo-400' : 'text-slate-700'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step Execution Logs */}
        {currentSteps.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-300">Detailed LangGraph Step Execution Log</h4>
              <button
                type="button"
                onClick={() => setShowStepLogs(!showStepLogs)}
                className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 transition-colors"
              >
                {showStepLogs ? 'Hide Detailed Execution Log' : 'Show Detailed Execution Log'}
              </button>
            </div>
            {showStepLogs && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-[11px] font-mono">
                {currentSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 border border-slate-800/80 p-2 rounded-lg flex items-start justify-between text-slate-300"
                  >
                    <div className="space-y-0.5">
                      <span className="font-bold text-cyan-400">[{step.label}]</span>{' '}
                      <span className="text-slate-300">{step.description}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap ml-2">{step.timestamp}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Answer Response Output Container */}
      {responseMarkdown && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-xl">
          <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-sm border-b border-slate-800 pb-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            <span>LangGraph Agent Answer Output</span>
          </div>
          <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed whitespace-pre-line">
            {responseMarkdown}
          </div>
        </div>
      )}
    </div>
  );
};
