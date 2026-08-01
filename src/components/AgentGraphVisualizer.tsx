import React from 'react';
import { AgentStep } from '../types';
import { ShieldCheck, UserCheck, Database, Search, Award, Mail, Cpu, CheckCircle2, ArrowRight } from 'lucide-react';

interface AgentGraphVisualizerProps {
  agentSteps?: AgentStep[];
  activeStepNode?: string;
}

export const AgentGraphVisualizer: React.FC<AgentGraphVisualizerProps> = ({
  agentSteps = [],
  activeStepNode,
}) => {
  const nodes = [
    { id: 'START', label: 'Start Flow', icon: Cpu, color: 'border-slate-700 bg-slate-900 text-slate-300' },
    { id: 'Authenticate User', label: 'Auth Agent', icon: ShieldCheck, color: 'border-indigo-500/40 bg-indigo-950/40 text-indigo-300' },
    { id: 'Intent Classification', label: 'Intent Classifier', icon: Search, color: 'border-purple-500/40 bg-purple-950/40 text-purple-300' },
    { id: 'SQL Agent', label: 'PostgreSQL Agent', icon: Database, color: 'border-blue-500/40 bg-blue-950/40 text-blue-300' },
    { id: 'RAG Retriever', label: 'RAG Vector Agent', icon: Search, color: 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300' },
    { id: 'LLM Synthesis', label: 'Gemini LLM Node', icon: Award, color: 'border-amber-500/40 bg-amber-950/40 text-amber-300' },
    { id: 'END', label: 'End Response', icon: CheckCircle2, color: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300' },
  ];

  const executedNodeIds = new Set(agentSteps.map((s) => s.node));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            LangGraph Execution Workflow Architecture
          </h3>
          <p className="text-xs text-slate-400">8-Agent State Graph pipeline with SQL Agent & ChromaDB RAG</p>
        </div>
        <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
          Live Trace
        </span>
      </div>

      {/* Visual Graph Diagram Nodes Flow */}
      <div className="flex flex-wrap items-center justify-center gap-2 lg:gap-3 py-2">
        {nodes.map((node, idx) => {
          const Icon = node.icon;
          const isExecuted = executedNodeIds.has(node.id as any);
          const isActive = activeStepNode === node.id;

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

      {/* Step Execution Logs */}
      {agentSteps.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <h4 className="text-xs font-semibold text-slate-300">Detailed Step Reasoning Log:</h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-[11px] font-mono">
            {agentSteps.map((step, idx) => (
              <div
                key={idx}
                className="bg-slate-950 border border-slate-800/80 p-2 rounded-lg flex items-start justify-between text-slate-300"
              >
                <div className="space-y-0.5">
                  <span className="font-bold text-cyan-400">[{step.label}]</span>{' '}
                  <span className="text-slate-300">{step.description}</span>
                  {step.data && (
                    <div className="text-[10px] text-slate-400 mt-0.5 bg-slate-900/80 p-1.5 rounded border border-slate-800/60 overflow-x-auto">
                      {JSON.stringify(step.data)}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 whitespace-nowrap ml-2">{step.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
