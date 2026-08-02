import React, { useState, useEffect } from 'react';
import { EmailLog, EmailQueueItem, EmailQueueStatus } from '../types';
import { triggerEmailReminders, sendSingleEmail, fetchEmailQueueStatus, clearEmailQueue } from '../lib/api';
import { initAuth, googleSignIn, logout, getAccessToken } from '../lib/firebaseAuth';
import { User } from 'firebase/auth';
import { Mail, Send, Clock, CheckCircle2, AlertTriangle, Sparkles, RefreshCw, UserCheck, LogOut, ShieldCheck, Layers, Loader2, XCircle, Trash2 } from 'lucide-react';

interface EmailReminderCenterProps {
  emailLogs: EmailLog[];
  onRefreshData: () => void;
}

export const EmailReminderCenter: React.FC<EmailReminderCenterProps> = ({
  emailLogs,
  onRefreshData,
}) => {
  const [loading, setLoading] = useState(false);
  const [sendingSingle, setSendingSingle] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Queue State
  const [queueStatus, setQueueStatus] = useState<EmailQueueStatus>({
    total: 0,
    pending: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    progressPercent: 0,
    isProcessing: false,
    isPaused: false,
    pauseSecondsRemaining: 0,
    pauseReason: '',
  });
  const [queueItems, setQueueItems] = useState<EmailQueueItem[]>([]);
  const [liveEmailLogs, setLiveEmailLogs] = useState<EmailLog[]>(emailLogs);

  // Google OAuth State
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Custom Email form state
  const [studentQuery, setStudentQuery] = useState('23981A42E7');
  const [studentEmail, setStudentEmail] = useState('dhaneshmamillapalli8@gmail.com');
  const [customSubject, setCustomSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  useEffect(() => {
    setLiveEmailLogs(emailLogs);
  }, [emailLogs]);

  const pollQueueStatus = async () => {
    try {
      const data = await fetchEmailQueueStatus();
      if (data) {
        setQueueStatus(data.summary);
        setQueueItems(data.queue);
        if (data.logs && data.logs.length > 0) {
          setLiveEmailLogs(data.logs);
        }
      }
    } catch (e) {
      // Ignore transient network errors
    }
  };

  useEffect(() => {
    pollQueueStatus();
    const interval = setInterval(pollQueueStatus, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = initAuth(
      (u, token) => {
        setUser(u);
        setAccessToken(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setStatusMsg('Connecting Google Account via Gmail API OAuth...');
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
        setStatusMsg(`Connected as ${res.user.email}! Gmail API active for direct inbox delivery.`);
      }
    } catch (err: any) {
      console.error('Google Sign in failed:', err);
      setStatusMsg(`Google Sign-in failed: ${err.message || err}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setStatusMsg('Signed out of Google Account.');
  };

  const handleRunAgent = async () => {
    setLoading(true);
    setStatusMsg('Scanning students for supplementary exams within 20 days and populating queue...');
    try {
      const tokenToUse = accessToken || (await getAccessToken()) || undefined;
      const res = await triggerEmailReminders(tokenToUse);
      setStatusMsg(res.message);
      await pollQueueStatus();
      onRefreshData();
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearQueue = async () => {
    try {
      const res = await clearEmailQueue();
      setQueueStatus(res.summary);
      await pollQueueStatus();
    } catch (err: any) {
      console.error('Failed to clear queue:', err);
    }
  };

  const handleSendSingleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentQuery.trim()) return;

    setSendingSingle(true);
    setStatusMsg('Generating and dispatching email via AI Email Service...');
    try {
      const tokenToUse = accessToken || (await getAccessToken()) || undefined;
      const res = await sendSingleEmail({
        studentQuery,
        studentEmail: studentEmail || undefined,
        subject: customSubject || undefined,
        message: customMessage || undefined,
        accessToken: tokenToUse,
      });
      setStatusMsg(res.message);
      await pollQueueStatus();
      onRefreshData();
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setSendingSingle(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
              Automated Throttled Email Agent
            </span>
            <span className="text-xs text-slate-400">20-Day Countdown • Rate Limit Shield Active</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-1">Supplementary Exam Email Reminders</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Scans student backlogs. Emails are queued for supplementary exams within 20 days and dispatched 1-by-1 every 7s with 60s auto-cooldown on rate limits.
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
        <div className="bg-indigo-950/80 border border-indigo-800 p-3.5 rounded-xl text-xs text-indigo-300 font-mono flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Google Account OAuth Status Banner for Real Gmail Delivery */}
      <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-xs font-bold text-white">Google Workspace / Gmail API Delivery</h4>
              {user ? (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                  Gmail Authorization Active
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-800 text-slate-400 rounded-full">
                  OAuth Ready
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {user
                ? `Authorized as ${user.email}. Emails will be sent directly via your Google Account's Gmail API.`
                : 'Sign in with your Google account to grant Gmail send authorization and dispatch real emails directly to external inboxes.'}
            </p>
          </div>
        </div>

        <div>
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Disconnect ({user.email?.split('@')[0]})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="flex items-center space-x-2.5 px-4 py-2 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-900 font-semibold text-xs rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isLoggingIn ? 'Signing in...' : 'Sign in with Google'}</span>
            </button>
          )}
        </div>
      </div>

      {/* In-Memory Email Queue Live Progress Dashboard */}
      <div className="bg-slate-900 border border-indigo-500/20 rounded-2xl p-6 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full flex items-center gap-1">
                <Layers className="w-3 h-3" /> In-Memory Queue Engine
              </span>
              <span className="text-xs text-slate-400">1 Email / 7s Throttling • Auto 60s Rate Limit Cooldown</span>
            </div>
            <h3 className="text-base font-bold text-white mt-1">20-Day Supplementary Exam Email Dispatch Queue</h3>
          </div>

          <div className="flex items-center space-x-2">
            {queueItems.length > 0 && (
              <button
                onClick={handleClearQueue}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                title="Clear completed or failed queue items"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Clear Completed</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Metrics Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-slate-950 border border-amber-500/20 rounded-xl p-3.5 text-center">
            <div className="text-[11px] font-semibold text-amber-400 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Pending
            </div>
            <div className="text-2xl font-black text-white mt-1">{queueStatus.pending}</div>
          </div>

          <div className="bg-slate-950 border border-blue-500/20 rounded-xl p-3.5 text-center">
            <div className="text-[11px] font-semibold text-cyan-400 flex items-center justify-center gap-1">
              <Loader2 className={`w-3.5 h-3.5 ${queueStatus.sending > 0 ? 'animate-spin' : ''}`} /> Sending
            </div>
            <div className="text-2xl font-black text-white mt-1">{queueStatus.sending}</div>
          </div>

          <div className="bg-slate-950 border border-emerald-500/20 rounded-xl p-3.5 text-center">
            <div className="text-[11px] font-semibold text-emerald-400 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Sent
            </div>
            <div className="text-2xl font-black text-white mt-1">{queueStatus.sent}</div>
          </div>

          <div className="bg-slate-950 border border-rose-500/20 rounded-xl p-3.5 text-center">
            <div className="text-[11px] font-semibold text-rose-400 flex items-center justify-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> Failed
            </div>
            <div className="text-2xl font-black text-white mt-1">{queueStatus.failed}</div>
          </div>

          <div className="bg-slate-950 border border-indigo-500/20 rounded-xl p-3.5 text-center col-span-2 sm:col-span-1">
            <div className="text-[11px] font-semibold text-indigo-400 flex items-center justify-center gap-1">
              <Mail className="w-3.5 h-3.5" /> Total
            </div>
            <div className="text-2xl font-black text-white mt-1">{queueStatus.total}</div>
          </div>
        </div>

        {/* Live Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-300 flex items-center gap-1.5">
              {queueStatus.isPaused ? (
                <span className="text-amber-400 flex items-center gap-1 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-400 animate-bounce" />
                  Rate-Limit Cooldown Active ({queueStatus.pauseSecondsRemaining}s remaining)
                </span>
              ) : queueStatus.isProcessing ? (
                <span className="text-cyan-300 flex items-center gap-1">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  Dispatching emails sequentially (1 email / 7s)...
                </span>
              ) : queueStatus.total > 0 && queueStatus.pending === 0 && queueStatus.sending === 0 ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Queue Complete: All eligible 20-day backlog emails processed.
                </span>
              ) : (
                <span className="text-slate-400">Queue Idle — Click scanner above to queue 20-day backlog reminders.</span>
              )}
            </span>
            <span className="text-indigo-400 font-bold font-mono">{queueStatus.progressPercent}%</span>
          </div>

          <div className="w-full h-3 bg-slate-950 border border-slate-800 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                queueStatus.isPaused
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                  : 'bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500'
              }`}
              style={{ width: `${queueStatus.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Rate Limit Pause Warning Alert */}
        {queueStatus.isPaused && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold text-amber-300 text-sm block">Gmail Rate Limit / Quota Exceeded Cooldown</strong>
              <p className="mt-0.5 text-amber-200/90">
                Gmail returned a rate-limit notice. Sending paused for <strong>60 seconds</strong> to protect quota limits.
                Queue resumes automatically in <strong>{queueStatus.pauseSecondsRemaining}s</strong> (Retries up to 3 times per email).
              </p>
            </div>
          </div>
        )}

        {/* Queue Items Live Table */}
        {queueItems.length > 0 && (
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Queue Work Items ({queueItems.length})</h4>
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-900/80 text-[11px] font-semibold text-slate-400 border-b border-slate-800">
                    <th className="py-2.5 px-3.5">Student</th>
                    <th className="py-2.5 px-3.5">Backlog Subject</th>
                    <th className="py-2.5 px-3.5">Exam Date</th>
                    <th className="py-2.5 px-3.5">Status</th>
                    <th className="py-2.5 px-3.5">Retries / Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {queueItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3.5">
                        <div className="font-semibold text-white">{item.studentName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{item.studentEmail}</div>
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-300 font-medium">
                        {item.subjectName} <span className="text-[10px] text-slate-500">({item.subjectCode})</span>
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className="text-amber-400 font-semibold">{item.examDate}</span>
                        <span className="text-[10px] text-slate-500 block">{item.daysRemaining} days remaining</span>
                      </td>
                      <td className="py-2.5 px-3.5">
                        {item.status === 'PENDING' && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-full inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                        {item.status === 'SENDING' && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-full inline-flex items-center gap-1 animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin text-cyan-400" /> Sending...
                          </span>
                        )}
                        {item.status === 'SENT' && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Sent
                          </span>
                        )}
                        {item.status === 'FAILED' && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full inline-flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-[11px] text-slate-400">
                        {item.retryCount > 0 && (
                          <span className="text-amber-300 font-semibold block">Retry #{item.retryCount}/3</span>
                        )}
                        {item.errorNote ? (
                          <span className="text-rose-300 line-clamp-1">{item.errorNote}</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Info Notice about Email Delivery */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold text-amber-300">How Email Dispatch Works:</strong> Dispatched emails are generated using Gemini AI and stored live in <strong>Email History Logs</strong>. When authorized with Google Sign-In above, emails are dispatched directly into recipient inboxes using Google Gmail API (`https://www.googleapis.com/auth/gmail.send`). Rate limit guards ensure 1 email is sent every 7s, with 60s cooldowns on Gmail quota limits.
        </div>
      </div>

      {/* Direct Email Dispatcher Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            Instant Direct Email Dispatcher
          </h3>
          <span className="text-[11px] text-slate-400">Target Student ID or Email</span>
        </div>

        <form onSubmit={handleSendSingleEmail} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300">Student ID or Name</label>
            <input
              type="text"
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="e.g. 23981A42E7 or K. Naveen"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300">Recipient Email Address</label>
            <input
              type="email"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              placeholder="karlanaveen19@gmail.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-[11px] font-semibold text-slate-300">Custom Email Subject (Optional)</label>
            <input
              type="text"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              placeholder="Leave blank to let AI generate personalized subject..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-[11px] font-semibold text-slate-300">Custom Message / Prompt (Optional)</label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={2}
              placeholder="Leave blank for AI-generated supplementary exam reminder message..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={sendingSingle}
              className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-semibold text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              {sendingSingle ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Send Direct Email Now</span>
            </button>
          </div>
        </form>
      </div>

      {/* Email History Logs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-400" />
            Sent Email Audit History ({liveEmailLogs.length})
          </h3>
          <span className="text-xs text-slate-400">SMTP / Gmail API Status: Active</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {liveEmailLogs.map((log) => (
            <div key={log.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold border rounded-md ${
                    log.status === 'FAILED'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
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
