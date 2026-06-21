import { useEffect, useState } from "react";
import "@/App.css";
import "@/index.css";
import axios from "axios";
import { 
  Mail, 
  PlayCircle, 
  PauseCircle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  Link as LinkIcon
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [workflowStatus, setWorkflowStatus] = useState({
    enabled: false,
    last_run: null,
    total_processed: 0,
    total_errors: 0,
    is_authenticated: false
  });
  const [processedEmails, setProcessedEmails] = useState([]);
  const [errors, setErrors] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('emails');
  const [runningWorkflow, setRunningWorkflow] = useState(false);

  // Fetch workflow status
  const fetchWorkflowStatus = async () => {
    try {
      const response = await axios.get(`${API}/workflow/status`);
      setWorkflowStatus(response.data);
    } catch (error) {
      console.error("Error fetching workflow status:", error);
    }
  };

  // Fetch processed emails
  const fetchProcessedEmails = async () => {
    try {
      const response = await axios.get(`${API}/emails/processed`);
      setProcessedEmails(response.data);
    } catch (error) {
      console.error("Error fetching emails:", error);
    }
  };

  // Fetch errors
  const fetchErrors = async () => {
    try {
      const response = await axios.get(`${API}/errors`);
      setErrors(response.data);
    } catch (error) {
      console.error("Error fetching errors:", error);
    }
  };

  // Toggle workflow
  const toggleWorkflow = async () => {
    try {
      const response = await axios.post(`${API}/workflow/toggle`);
      await fetchWorkflowStatus();
      alert(response.data.message);
    } catch (error) {
      console.error("Error toggling workflow:", error);
      alert("Failed to toggle workflow");
    }
  };

  // Trigger workflow manually
  const triggerWorkflowNow = async () => {
    setRunningWorkflow(true);
    try {
      const response = await axios.post(`${API}/workflow/trigger`);
      if (response.data.success) {
        alert('✓ Workflow completed! Check processed emails below.');
      } else {
        alert('⚠️ Workflow completed with errors. Check Error Logs tab.');
      }
      // Refresh data after trigger
      await refreshData();
    } catch (error) {
      console.error("Error triggering workflow:", error);
      alert("✗ Failed to trigger workflow: " + (error.response?.data?.message || error.message));
    } finally {
      setRunningWorkflow(false);
    }
  };

  // Connect Gmail
  const connectGmail = () => {
    window.location.href = `${API}/oauth/gmail/login?user_id=default_user`;
  };

  // Refresh data
  const refreshData = async () => {
    setLoading(true);
    await Promise.all([
      fetchWorkflowStatus(),
      fetchProcessedEmails(),
      fetchErrors()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    refreshData();
    
    // Poll every 30 seconds
    const interval = setInterval(() => {
      fetchWorkflowStatus();
      fetchProcessedEmails();
      fetchErrors();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusBadge = () => {
    if (!workflowStatus.is_authenticated) {
      return <span className="status-badge status-error" data-testid="status-badge">Not Connected</span>;
    }
    if (workflowStatus.enabled) {
      return <span className="status-badge status-active" data-testid="status-badge">Active</span>;
    }
    return <span className="status-badge status-inactive" data-testid="status-badge">Inactive</span>;
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div style={{ padding: '2rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <Mail size={28} color="#002FA7" />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>AutoReply</h1>
          </div>
          
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              data-testid="nav-dashboard-btn"
              onClick={() => setActiveTab('emails')}
              style={{
                textAlign: 'left',
                padding: '0.75rem 1rem',
                background: activeTab === 'emails' ? '#F3F4F6' : 'transparent',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                fontWeight: activeTab === 'emails' ? 600 : 400,
                color: activeTab === 'emails' ? '#002FA7' : '#525252'
              }}
            >
              Dashboard
            </button>
            <button
              data-testid="nav-errors-btn"
              onClick={() => setActiveTab('errors')}
              style={{
                textAlign: 'left',
                padding: '0.75rem 1rem',
                background: activeTab === 'errors' ? '#F3F4F6' : 'transparent',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                fontWeight: activeTab === 'errors' ? 600 : 400,
                color: activeTab === 'errors' ? '#002FA7' : '#525252'
              }}
            >
              Error Logs
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Email Auto-Responder
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                AI-powered email workflow automation
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                data-testid="refresh-btn"
                onClick={refreshData}
                className="btn-secondary"
                disabled={loading}
                style={{
                  opacity: loading ? 0.6 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                <RefreshCw size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                {loading ? 'Loading...' : 'Refresh'}
              </button>
              {workflowStatus.is_authenticated && (
                <button
                  data-testid="run-now-btn"
                  onClick={triggerWorkflowNow}
                  className="btn-secondary"
                  disabled={runningWorkflow}
                  style={{
                    backgroundColor: runningWorkflow ? '#6B7280' : '#059669',
                    color: 'white',
                    borderColor: runningWorkflow ? '#6B7280' : '#059669',
                    opacity: runningWorkflow ? 0.7 : 1,
                    cursor: runningWorkflow ? 'not-allowed' : 'pointer'
                  }}
                >
                  <PlayCircle size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                  {runningWorkflow ? 'Processing...' : 'Run Now'}
                </button>
              )}
              {!workflowStatus.is_authenticated ? (
                <button
                  data-testid="connect-gmail-btn"
                  onClick={connectGmail}
                  className="btn-primary"
                >
                  <LinkIcon size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                  Connect Gmail
                </button>
              ) : (
                <button
                  data-testid="toggle-workflow-btn"
                  onClick={toggleWorkflow}
                  className="btn-primary"
                  style={{
                    backgroundColor: workflowStatus.enabled ? '#E53935' : '#002FA7'
                  }}
                >
                  {workflowStatus.enabled ? (
                    <>
                      <PauseCircle size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                      Stop Workflow
                    </>
                  ) : (
                    <>
                      <PlayCircle size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                      Start Workflow
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid-layout" style={{ marginBottom: '2rem' }}>
          <div className="metric-card" data-testid="status-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="overline" style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Status
                </p>
                {getStatusBadge()}
              </div>
              <Clock size={24} color="#002FA7" />
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
              Last run: {formatDate(workflowStatus.last_run)}
            </p>
          </div>

          <div className="metric-card" data-testid="processed-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="overline" style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Processed
                </p>
                <h3 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-success)' }}>
                  {workflowStatus.total_processed}
                </h3>
              </div>
              <CheckCircle size={24} color="#059669" />
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
              Total emails processed
            </p>
          </div>

          <div className="metric-card" data-testid="errors-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="overline" style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Errors
                </p>
                <h3 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-error)' }}>
                  {workflowStatus.total_errors}
                </h3>
              </div>
              <XCircle size={24} color="#E53935" />
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
              Total errors logged
            </p>
          </div>
        </div>

        {/* Content Tabs */}
        {activeTab === 'emails' ? (
          <div style={{ display: 'grid', gridTemplateColumns: selectedEmail ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
            {/* Email List */}
            <div className="card" data-testid="email-list-card">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
                Processed Emails
              </h3>
              
              {processedEmails.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <Mail size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                  <p>No emails processed yet</p>
                  <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    {workflowStatus.is_authenticated 
                      ? 'Start the workflow to begin processing emails'
                      : 'Connect your Gmail account to get started'
                    }
                  </p>
                </div>
              ) : (
                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  {processedEmails.map((email) => (
                    <div
                      key={email.id}
                      data-testid={`email-row-${email.id}`}
                      className="email-row"
                      onClick={() => setSelectedEmail(email)}
                      style={{
                        backgroundColor: selectedEmail?.id === email.id ? '#F3F4F6' : 'transparent'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <CheckCircle size={16} color="#059669" />
                        <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{email.subject}</p>
                      </div>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        From: {email.from_email}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {formatDate(email.processed_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Email Detail */}
            {selectedEmail && (
              <div className="card" data-testid="email-detail-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>AI Draft Preview</h3>
                  <button
                    data-testid="close-detail-btn"
                    onClick={() => setSelectedEmail(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      color: 'var(--text-muted)'
                    }}
                  >
                    <XCircle size={20} />
                  </button>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <p className="overline" style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    Original Email
                  </p>
                  <div style={{ 
                    backgroundColor: '#F9FAFB', 
                    padding: '1rem', 
                    borderLeft: '3px solid #002FA7',
                    marginBottom: '0.5rem'
                  }}>
                    <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{selectedEmail.subject}</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      From: {selectedEmail.from_email}
                    </p>
                    <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{selectedEmail.body}</p>
                  </div>
                </div>

                <div>
                  <p className="overline" style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    AI-Generated Reply
                  </p>
                  <div style={{ 
                    backgroundColor: '#F0F9FF', 
                    padding: '1rem', 
                    borderLeft: '3px solid #059669'
                  }}>
                    <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{selectedEmail.ai_reply}</p>
                  </div>
                  {selectedEmail.draft_id && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      Draft ID: <code className="mono">{selectedEmail.draft_id}</code>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Error Logs */
          <div className="card" data-testid="error-logs-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Error Logs</h3>
              <AlertTriangle size={24} color="#E53935" />
            </div>

            {errors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                <CheckCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                <p>No errors recorded</p>
              </div>
            ) : (
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {errors.map((error) => (
                  <div key={error.id} className="error-log" data-testid={`error-log-${error.id}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--accent-error)', fontWeight: 600 }}>
                        [{error.error_type}]
                      </span>
                      <span style={{ fontSize: '0.75rem' }}>{formatDate(error.timestamp)}</span>
                    </div>
                    <p>{error.error_message}</p>
                    {error.email_id && (
                      <p style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
                        Email ID: {error.email_id}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
