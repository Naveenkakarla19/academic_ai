import React, { useState } from 'react';
import { EmailLog } from '../types';
import { triggerEmailReminders } from '../lib/api';
import { Mail, Send, Clock, CheckCircle2, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';

interface EmailReminderCenterProps {
  emailLogs: EmailLog[];
  onRefreshData: () => void;
}

export const EmailReminderCenter: React.FC<EmailReminderCenterProps> = ({
  emailLogs,
  onRefreshData,
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleRunAgent = async () => {
    setLoading(true);
    setStatusMsg('Running Email Reminder Agent scanner...');
    try {
      const res = await triggerEmailReminders();
      setStatusMsg(res.message);
      onRefreshData();
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
              Automated Email Agent
            </span>
            <span className="text-xs text-slate-400">20-Day Countdown Trigger</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-1">Supplementary Exam Email Reminders</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Checks student backlogs daily. If a backlog exam is within 20 days, generates a personalized encouraging AI email using Gemini and sends it automatically via SMTP / Gmail API.
          </p>
        </div>

        <button
          onClick={handleRunAgent}
          disabled={loading}
          className="flex items-center space-x-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer whitespace-nowrap"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span>Run 20-Day Backlog Email Scanner Now</span>
        </button>
      </div>

      {statusMsg && (
        <div className="bg-indigo-950/80 border border-indigo-800 p-3.5 rounded-xl text-xs text-indigo-300 font-mono">
          {statusMsg}
        </div>
      )}

      {/* Email History Logs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-400" />
            Sent Email Audit History ({emailLogs.length})
          </h3>
          <span className="text-xs text-slate-400">SMTP Server Status: Active</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {emailLogs.map((log) => (
            <div key={log.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
                    {log.status}
                  </span>
                  <h4 className="text-sm font-bold text-white mt-1.5">{log.studentName}</h4>
                  <p className="text-xs text-slate-400 font-mono">{log.studentEmail}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {log.daysRemaining} Days
                  </span>
                  <span className="text-[10px] text-slate-500 block">{log.sentAt}</span>
                </div>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="text-xs font-semibold text-indigo-300 block">{log.emailSubject}</span>
                <p className="text-[11px] text-slate-300 line-clamp-3 whitespace-pre-wrap">{log.emailBody}</p>
              </div>

              <button
                onClick={() => setSelectedEmail(log)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
              >
                View Full Email Body →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Email Preview Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedEmail.emailSubject}</h3>
                <p className="text-xs text-slate-400">To: {selectedEmail.studentName} ({selectedEmail.studentEmail})</p>
              </div>
              <button onClick={() => setSelectedEmail(null)} className="text-slate-400 hover:text-white font-bold text-sm">
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-sans text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
              {selectedEmail.emailBody}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <span>Exam Date: {selectedEmail.examDate}</span>
              <button
                onClick={() => setSelectedEmail(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
