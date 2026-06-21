import { useState, useEffect } from "react";
import { X, Settings as SettingsIcon, Save } from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Settings({ isOpen, onClose, onSave }) {
  const [settings, setSettings] = useState({
    processing_limit: 5,
    auto_send_drafts: false,
    custom_prompt: "You are a professional email assistant. Reply to emails in a helpful, professional, and concise manner.",
    sender_whitelist: [],
    sender_blacklist: [],
    vip_senders: []
  });
  const [whitelistInput, setWhitelistInput] = useState("");
  const [blacklistInput, setBlacklistInput] = useState("");
  const [vipInput, setVipInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      setSettings(response.data);
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/settings`, settings);
      alert("✓ Settings saved successfully!");
      onSave();
      onClose();
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("✗ Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const addToWhitelist = () => {
    if (whitelistInput.trim()) {
      setSettings({
        ...settings,
        sender_whitelist: [...settings.sender_whitelist, whitelistInput.trim()]
      });
      setWhitelistInput("");
    }
  };

  const removeFromWhitelist = (email) => {
    setSettings({
      ...settings,
      sender_whitelist: settings.sender_whitelist.filter(e => e !== email)
    });
  };

  const addToBlacklist = () => {
    if (blacklistInput.trim()) {
      setSettings({
        ...settings,
        sender_blacklist: [...settings.sender_blacklist, blacklistInput.trim()]
      });
      setBlacklistInput("");
    }
  };

  const removeFromBlacklist = (email) => {
    setSettings({
      ...settings,
      sender_blacklist: settings.sender_blacklist.filter(e => e !== email)
    });
  };

  const addToVIP = () => {
    if (vipInput.trim()) {
      setSettings({
        ...settings,
        vip_senders: [...settings.vip_senders, vipInput.trim()]
      });
      setVipInput("");
    }
  };

  const removeFromVIP = (email) => {
    setSettings({
      ...settings,
      vip_senders: settings.vip_senders.filter(e => e !== email)
    });
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '4px',
        width: '90%',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflow: 'auto',
        padding: '2rem',
        border: '1px solid #E5E5E5'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <SettingsIcon size={24} color="#002FA7" />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Workflow Settings</h2>
          </div>
          <button
            onClick={onClose}
            data-testid="close-settings-btn"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Processing Limit */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
            Processing Limit (emails per run)
          </label>
          <input
            type="number"
            data-testid="processing-limit-input"
            value={settings.processing_limit}
            onChange={(e) => setSettings({ ...settings, processing_limit: parseInt(e.target.value) })}
            min="1"
            max="50"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #E5E5E5',
              borderRadius: '2px',
              fontSize: '0.95rem'
            }}
          />
          <p style={{ fontSize: '0.875rem', color: '#525252', marginTop: '0.25rem' }}>
            Max emails to process per workflow run (1-50)
          </p>
        </div>

        {/* Auto-send Drafts */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              data-testid="auto-send-checkbox"
              checked={settings.auto_send_drafts}
              onChange={(e) => setSettings({ ...settings, auto_send_drafts: e.target.checked })}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 600 }}>Auto-send drafts (replies sent automatically)</span>
          </label>
          <p style={{ fontSize: '0.875rem', color: '#525252', marginTop: '0.25rem', marginLeft: '1.75rem' }}>
            ⚠️ When enabled, AI replies are sent immediately without review
          </p>
        </div>

        {/* Custom Prompt */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
            AI System Prompt
          </label>
          <textarea
            data-testid="custom-prompt-textarea"
            value={settings.custom_prompt}
            onChange={(e) => setSettings({ ...settings, custom_prompt: e.target.value })}
            rows={4}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #E5E5E5',
              borderRadius: '2px',
              fontSize: '0.95rem',
              fontFamily: 'IBM Plex Sans, sans-serif',
              resize: 'vertical'
            }}
          />
          <p style={{ fontSize: '0.875rem', color: '#525252', marginTop: '0.25rem' }}>
            Customize how the AI responds to emails
          </p>
        </div>

        {/* Whitelist */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
            Sender Whitelist (only process these)
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="email"
              data-testid="whitelist-input"
              value={whitelistInput}
              onChange={(e) => setWhitelistInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addToWhitelist()}
              placeholder="email@example.com"
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #E5E5E5',
                borderRadius: '2px',
                fontSize: '0.95rem'
              }}
            />
            <button
              onClick={addToWhitelist}
              data-testid="add-whitelist-btn"
              className="btn-secondary"
              style={{ padding: '0.75rem 1.5rem' }}
            >
              Add
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {settings.sender_whitelist.map((email, idx) => (
              <span
                key={idx}
                data-testid={`whitelist-item-${idx}`}
                style={{
                  backgroundColor: '#D1FAE5',
                  color: '#059669',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '2px',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {email}
                <button
                  onClick={() => removeFromWhitelist(email)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex'
                  }}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
          <p style={{ fontSize: '0.875rem', color: '#525252', marginTop: '0.25rem' }}>
            Leave empty to process all emails
          </p>
        </div>

        {/* Blacklist */}
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
            Sender Blacklist (never process these)
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="email"
              data-testid="blacklist-input"
              value={blacklistInput}
              onChange={(e) => setBlacklistInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addToBlacklist()}
              placeholder="spam@example.com"
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #E5E5E5',
                borderRadius: '2px',
                fontSize: '0.95rem'
              }}
            />
            <button
              onClick={addToBlacklist}
              data-testid="add-blacklist-btn"
              className="btn-secondary"
              style={{ padding: '0.75rem 1.5rem' }}
            >
              Add
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {settings.sender_blacklist.map((email, idx) => (
              <span
                key={idx}
                data-testid={`blacklist-item-${idx}`}
                style={{
                  backgroundColor: '#FEE2E2',
                  color: '#E53935',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '2px',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {email}
                <button
                  onClick={() => removeFromBlacklist(email)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex'
                  }}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* VIP Senders */}
        <div style={{ marginBottom: '2rem', backgroundColor: '#FFF9E6', padding: '1.5rem', borderRadius: '4px', border: '2px solid #FFC107' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#000' }}>
            ⭐ VIP Senders (Skip for Manual Reply)
          </label>
          <p style={{ fontSize: '0.875rem', color: '#525252', marginBottom: '0.75rem' }}>
            Important contacts that require personal attention. These emails will NOT be auto-replied.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="email"
              data-testid="vip-input"
              value={vipInput}
              onChange={(e) => setVipInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addToVIP()}
              placeholder="boss@company.com"
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #E5E5E5',
                borderRadius: '2px',
                fontSize: '0.95rem'
              }}
            />
            <button
              onClick={addToVIP}
              data-testid="add-vip-btn"
              className="btn-secondary"
              style={{ padding: '0.75rem 1.5rem', backgroundColor: '#FFC107', borderColor: '#FFC107', color: '#000' }}
            >
              Add VIP
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {settings.vip_senders.map((email, idx) => (
              <span
                key={idx}
                data-testid={`vip-item-${idx}`}
                style={{
                  backgroundColor: '#FFF3CD',
                  color: '#856404',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '2px',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 600
                }}
              >
                ⭐ {email}
                <button
                  onClick={() => removeFromVIP(email)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex'
                  }}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '0.75rem 1.5rem' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            data-testid="save-settings-btn"
            className="btn-primary"
            disabled={saving}
            style={{
              padding: '0.75rem 1.5rem',
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            <Save size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
