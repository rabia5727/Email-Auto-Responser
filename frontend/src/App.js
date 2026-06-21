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
  Link as LinkIcon,
  Settings as SettingsIcon,
  LogOut,
  Download
} from "lucide-react";
import Settings from "@/components/Settings";
import LogoutConfirmation from "@/components/LogoutConfirmation";

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
  const [emailsTotal, setEmailsTotal] = useState(0);
  const [emailsPage, setEmailsPage] = useState(0);
  const [emailsFilter, setEmailsFilter] = useState('all'); // 'all', '7days', '30days'
  const [errors, setErrors] = useState([]);
  const [errorsTotal, setErrorsTotal] = useState(0);
  const [errorsPage, setErrorsPage] = useState(0);
  const [errorsFilter, setErrorsFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [runningWorkflow, setRunningWorkflow] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const ITEMS_PER_PAGE = 20;

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
  const fetchProcessedEmails = async (page = 0, filter = 'all') => {
    try {
      const days = filter === '7days' ? 7 : filter === '30days' ? 30 : null;
      const params = new URLSearchParams({
        limit: ITEMS_PER_PAGE,
        skip: page * ITEMS_PER_PAGE,
        ...(days && { days })
      });
      const response = await axios.get(`${API}/emails/processed?${params}`);
      setProcessedEmails(response.data.emails);
      setEmailsTotal(response.data.total);
    } catch (error) {
      console.error("Error fetching emails:", error);
    }
  };

  // Fetch errors
  const fetchErrors = async (page = 0, filter = 'all') => {
    try {
      const days = filter === '7days' ? 7 : filter === '30days' ? 30 : null;
      const params = new URLSearchParams({
        limit: ITEMS_PER_PAGE,
        skip: page * ITEMS_PER_PAGE,
        ...(days && { days })
      });
      const response = await axios.get(`${API}/errors?${params}`);
      setErrors(response.data.errors);
      setErrorsTotal(response.data.total);
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

  // Logout
  const handleLogout = async (clearData = true) => {
    try {
      const response = await axios.post(`${API}/auth/logout?user_id=default_user&clear_data=${clearData}`);
      
      if (clearData) {
        // Clear local state
        setProcessedEmails([]);
        setEmailsTotal(0);
        setEmailsPage(0);
        setErrors([]);
        setErrorsTotal(0);
        setErrorsPage(0);
        setSelectedEmail(null);
      }
      
      // Refresh workflow status
      await fetchWorkflowStatus();
      
      alert("✓ " + response.data.message);
      
      // Navigate to dashboard
      setActiveTab('dashboard');
    } catch (error) {
      console.error("Error logging out:", error);
      alert("✗ Failed to disconnect Gmail");
    }
  };

  // Export CSV
  const handleExport = () => {
    window.open(`${API}/emails/export`, '_blank');
  };

  // Connect Gmail
  const connectGmail = () => {
    // Don't use loading state for redirect
    // Just redirect immediately
    const redirectUrl = `${API}/oauth/gmail/login?user_id=default_user`;
    window.location.href = redirectUrl;
  };

  // Refresh data
  const refreshData = async () => {
    setLoading(true);
    await Promise.all([
      fetchWorkflowStatus(),
      fetchProcessedEmails(emailsPage, emailsFilter),
      fetchErrors(errorsPage, errorsFilter)
    ]);
    setLoading(false);
  };

  // Cleanup old data
  const cleanupOldData = async (type, days) => {
    if (!window.confirm(`Delete all ${type} older than ${days} days? This cannot be undone.`)) {
      return;
    }
    try {
      const endpoint = type === 'emails' ? '/emails/cleanup' : '/errors/cleanup';
      const response = await axios.delete(`${API}${endpoint}?days=${days}`);
      alert(`✓ ${response.data.message}`);
      refreshData();
    } catch (error) {
      console.error(`Error cleaning up ${type}:`, error);
      alert(`✗ Failed to cleanup ${type}`);
    }
  };

  useEffect(() => {
    refreshData();
    
    // Poll every 30 seconds
    const interval = setInterval(() => {
      fetchWorkflowStatus();
      fetchProcessedEmails(emailsPage, emailsFilter);
      fetchErrors(errorsPage, errorsFilter);
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Refetch when page or filter changes
  useEffect(() => {
    fetchProcessedEmails(emailsPage, emailsFilter);
  }, [emailsPage, emailsFilter]);

  useEffect(() => {
    fetchErrors(errorsPage, errorsFilter);
  }, [errorsPage, errorsFilter]);

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
              onClick={() => setActiveTab('dashboard')}
              style={{
                textAlign: 'left',
                padding: '0.75rem 1rem',
                background: activeTab === 'dashboard' ? '#F3F4F6' : 'transparent',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                fontWeight: activeTab === 'dashboard' ? 600 : 400,
                color: activeTab === 'dashboard' ? '#002FA7' : '#525252'
              }}
            >
              Dashboard
            </button>
            <button
              data-testid="nav-emails-btn"
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
              Processed Emails
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

          {/* Settings & Logout */}
          {workflowStatus.is_authenticated && (
            <div style={{ marginTop: 'auto', paddingTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                data-testid="nav-settings-btn"
                onClick={() => setShowSettings(true)}
                style={{
                  textAlign: 'left',
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  color: '#525252',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <SettingsIcon size={18} />
                Settings
              </button>
              <button
                data-testid="logout-btn"
                onClick={() => setShowLogoutModal(true)}
                style={{
                  textAlign: 'left',
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  color: '#E53935',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <LogOut size={18} />
                Disconnect
              </button>
            </div>
          )}
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
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
              {workflowStatus.is_authenticated && workflowStatus.total_processed > 0 && (
                <button
                  data-testid="export-btn"
                  onClick={handleExport}
                  className="btn-secondary"
                  style={{
                    backgroundColor: '#002FA7',
                    color: 'white',
                    borderColor: '#002FA7'
                  }}
                >
                  <Download size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                  Export CSV
                </button>
              )}
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
        {activeTab === 'dashboard' ? (
          /* Dashboard Overview */
          <div>
            <div className="card" data-testid="dashboard-overview">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>
                Workflow Overview
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Status
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                    {workflowStatus.enabled ? '🟢 Active' : '⚪ Inactive'}
                  </p>
                </div>
                
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Success Rate
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>
                    {workflowStatus.total_processed > 0 
                      ? Math.round((workflowStatus.total_processed / (workflowStatus.total_processed + workflowStatus.total_errors)) * 100) 
                      : 0}%
                  </p>
                </div>
                
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Last Run
                  </p>
                  <p style={{ fontSize: '1rem', fontWeight: 600 }}>
                    {workflowStatus.last_run ? new Date(workflowStatus.last_run).toLocaleTimeString() : 'Never'}
                  </p>
                </div>
              </div>

              {!workflowStatus.is_authenticated ? (
                <div style={{ 
                  backgroundColor: '#FFF9E6', 
                  border: '2px solid #FFC107', 
                  borderRadius: '4px', 
                  padding: '2rem', 
                  textAlign: 'center' 
                }}>
                  <h4 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
                    🔗 Get Started
                  </h4>
                  <p style={{ marginBottom: '1.5rem', color: '#525252' }}>
                    Connect your Gmail account to start automating email replies
                  </p>
                  <button
                    onClick={connectGmail}
                    className="btn-primary"
                    style={{ padding: '1rem 2rem', fontSize: '1rem' }}
                  >
                    <LinkIcon size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />
                    Connect Gmail Now
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ 
                    backgroundColor: '#F0F9FF', 
                    border: '1px solid #002FA7', 
                    borderRadius: '4px', 
                    padding: '1.5rem', 
                    marginBottom: '2rem' 
                  }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#002FA7' }}>
                      💡 Quick Tips
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#525252' }}>
                      <li style={{ marginBottom: '0.5rem' }}>
                        Click <strong>"Run Now"</strong> to immediately process unread emails
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        Use <strong>"Settings"</strong> to add VIP senders (emails that skip auto-reply)
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        Enable <strong>"Start Workflow"</strong> for automatic processing every 5 minutes
                      </li>
                      <li>
                        Turn OFF <strong>"Auto-send"</strong> to review drafts before sending
                      </li>
                    </ul>
                  </div>

                  {/* Recent Activity */}
                  <h4 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>
                    Recent Activity
                  </h4>
                  {processedEmails.slice(0, 5).length > 0 ? (
                    <div>
                      {processedEmails.slice(0, 5).map((email) => (
                        <div
                          key={email.id}
                          style={{
                            borderBottom: '1px solid #E5E5E5',
                            padding: '1rem 0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{email.subject}</p>
                            <p style={{ fontSize: '0.875rem', color: '#525252' }}>From: {email.from_email}</p>
                          </div>
                          <span style={{
                            backgroundColor: email.status === 'success' ? '#D1FAE5' : '#FEE2E2',
                            color: email.status === 'success' ? '#059669' : '#E53935',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '2px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textTransform: 'uppercase'
                          }}>
                            {email.status === 'success' ? '✓ Processed' : '✗ Failed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#525252', textAlign: 'center', padding: '2rem' }}>
                      No emails processed yet. Click "Run Now" to start!
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        ) : activeTab === 'emails' ? (
          <div style={{ display: 'grid', gridTemplateColumns: selectedEmail ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
            {/* Email List */}
            <div className="card" data-testid="email-list-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  Processed Emails
                </h3>
                
                {/* Filters & Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={emailsFilter}
                    onChange={(e) => { setEmailsFilter(e.target.value); setEmailsPage(0); }}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #E5E5E5',
                      borderRadius: '2px',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="all">All Time</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                  </select>
                  
                  <button
                    onClick={() => cleanupOldData('emails', 30)}
                    className="btn-secondary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                  >
                    Clear Old
                  </button>
                </div>
              </div>

              {/* Count Info */}
              <p style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '1rem' }}>
                Showing {processedEmails.length} of {emailsTotal} emails
              </p>
              
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

              {/* Pagination */}
              {emailsTotal > ITEMS_PER_PAGE && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  gap: '1rem', 
                  marginTop: '1.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid #E5E5E5'
                }}>
                  <button
                    onClick={() => setEmailsPage(Math.max(0, emailsPage - 1))}
                    disabled={emailsPage === 0}
                    className="btn-secondary"
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      opacity: emailsPage === 0 ? 0.5 : 1,
                      cursor: emailsPage === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: '0.875rem', color: '#525252' }}>
                    Page {emailsPage + 1} of {Math.ceil(emailsTotal / ITEMS_PER_PAGE)}
                  </span>
                  <button
                    onClick={() => setEmailsPage(emailsPage + 1)}
                    disabled={(emailsPage + 1) * ITEMS_PER_PAGE >= emailsTotal}
                    className="btn-secondary"
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      opacity: (emailsPage + 1) * ITEMS_PER_PAGE >= emailsTotal ? 0.5 : 1,
                      cursor: (emailsPage + 1) * ITEMS_PER_PAGE >= emailsTotal ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next
                  </button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Error Logs</h3>
                <AlertTriangle size={24} color="#E53935" />
              </div>

              {/* Filters & Actions */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select
                  value={errorsFilter}
                  onChange={(e) => { setErrorsFilter(e.target.value); setErrorsPage(0); }}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #E5E5E5',
                    borderRadius: '2px',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="all">All Time</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                </select>
                
                <button
                  onClick={() => cleanupOldData('errors', 30)}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Clear Old
                </button>
              </div>
            </div>

            {/* Count Info */}
            <p style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '1rem' }}>
              Showing {errors.length} of {errorsTotal} errors
            </p>

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

            {/* Pagination */}
            {errorsTotal > ITEMS_PER_PAGE && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '1rem', 
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid #E5E5E5'
              }}>
                <button
                  onClick={() => setErrorsPage(Math.max(0, errorsPage - 1))}
                  disabled={errorsPage === 0}
                  className="btn-secondary"
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    opacity: errorsPage === 0 ? 0.5 : 1,
                    cursor: errorsPage === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Previous
                </button>
                <span style={{ fontSize: '0.875rem', color: '#525252' }}>
                  Page {errorsPage + 1} of {Math.ceil(errorsTotal / ITEMS_PER_PAGE)}
                </span>
                <button
                  onClick={() => setErrorsPage(errorsPage + 1)}
                  disabled={(errorsPage + 1) * ITEMS_PER_PAGE >= errorsTotal}
                  className="btn-secondary"
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    opacity: (errorsPage + 1) * ITEMS_PER_PAGE >= errorsTotal ? 0.5 : 1,
                    cursor: (errorsPage + 1) * ITEMS_PER_PAGE >= errorsTotal ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <Settings 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        onSave={refreshData}
      />

      {/* Logout Confirmation Modal */}
      <LogoutConfirmation
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />
    </div>
  );
}

export default App;
