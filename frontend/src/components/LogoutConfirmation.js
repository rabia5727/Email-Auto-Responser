import { useState } from "react";
import { X, LogOut, AlertTriangle } from "lucide-react";

export default function LogoutConfirmation({ isOpen, onClose, onConfirm }) {
  const [clearData, setClearData] = useState(true);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(clearData);
    onClose();
  };

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
        maxWidth: '500px',
        padding: '2rem',
        border: '1px solid #E5E5E5'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <LogOut size={24} color="#E53935" />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Disconnect Gmail?</h2>
          </div>
          <button
            onClick={onClose}
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

        {/* Warning Box */}
        <div style={{
          backgroundColor: '#FFF9E6',
          border: '2px solid #FFC107',
          borderRadius: '4px',
          padding: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <AlertTriangle size={20} color="#FFC107" style={{ flexShrink: 0, marginTop: '0.25rem' }} />
            <div>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>This action will disconnect your Gmail account</p>
              <p style={{ fontSize: '0.875rem', color: '#525252' }}>
                You can reconnect anytime with the same or a different account.
              </p>
            </div>
          </div>
        </div>

        {/* Clear Data Option */}
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={clearData}
              onChange={(e) => setClearData(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '0.25rem' }}
            />
            <div>
              <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                Clear all data (Recommended)
              </span>
              <span style={{ fontSize: '0.875rem', color: '#525252' }}>
                Remove all processed emails, error logs, and workflow settings. Start fresh with a clean slate.
              </span>
            </div>
          </label>

          {!clearData && (
            <div style={{
              marginTop: '0.75rem',
              marginLeft: '2rem',
              padding: '0.75rem',
              backgroundColor: '#FEE2E2',
              borderRadius: '4px',
              fontSize: '0.875rem',
              color: '#7F1D1D'
            }}>
              <strong>Warning:</strong> Old data will remain visible. This may cause confusion if connecting a different account.
            </div>
          )}
        </div>

        {/* What will be affected */}
        <div style={{ marginBottom: '2rem', fontSize: '0.875rem' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
            {clearData ? 'The following will be deleted:' : 'Only Gmail connection will be removed:'}
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#525252' }}>
            <li>Gmail OAuth token (disconnects account)</li>
            {clearData && (
              <>
                <li>All processed emails ({localStorage.getItem('emailsCount') || '0'})</li>
                <li>All error logs</li>
                <li>Workflow configuration & settings</li>
              </>
            )}
          </ul>
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
            onClick={handleConfirm}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#E53935',
              color: 'white',
              border: 'none',
              borderRadius: '2px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'IBM Plex Sans, sans-serif'
            }}
          >
            <LogOut size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            {clearData ? 'Disconnect & Clear Data' : 'Disconnect Only'}
          </button>
        </div>
      </div>
    </div>
  );
}
