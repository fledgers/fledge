import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  OPPORTUNITY_REPORT_REASONS,
  submitOpportunityReport,
} from '../utils/opportunityReports';

export default function OpportunityReportDialog({ opportunity, onClose }) {
  const [reason, setReason] = useState('incorrect_information');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape' && status !== 'submitting') onClose();
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose, status]);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('submitting');
    setError(null);

    try {
      await submitOpportunityReport({
        opportunityId: opportunity.id,
        reason,
        details,
      });
      setStatus('submitted');
    } catch (submissionError) {
      setStatus('idle');
      setError({
        code: submissionError.code || 'SUBMISSION_FAILED',
        message: submissionError.message,
      });
    }
  }

  return (
    <div
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget && status !== 'submitting') {
          onClose();
        }
      }}
      style={{
        alignItems: 'center',
        background: 'rgba(26, 26, 24, 0.56)',
        display: 'flex',
        inset: 0,
        justifyContent: 'center',
        padding: '20px',
        position: 'fixed',
        zIndex: 1000,
      }}
    >
      <div
        aria-labelledby={`report-title-${opportunity.id}`}
        aria-modal="true"
        role="dialog"
        style={{
          background: '#FFFFFF',
          border: '1px solid #C4BDB5',
          borderRadius: '8px',
          boxShadow: '0 18px 50px rgba(0, 0, 0, 0.22)',
          maxWidth: '460px',
          padding: '22px',
          width: '100%',
        }}
      >
        <div style={{ alignItems: 'flex-start', display: 'flex', gap: '14px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              id={`report-title-${opportunity.id}`}
              style={{ fontSize: '18px', margin: 0 }}
            >
              Report opportunity
            </h2>
            <p style={{ color: '#6E6E64', fontSize: '13px', margin: '5px 0 0' }}>
              {opportunity.title}
            </p>
          </div>
          <button
            aria-label="Close report dialog"
            disabled={status === 'submitting'}
            onClick={onClose}
            title="Close"
            type="button"
            style={iconButtonStyle}
          >
            <X aria-hidden="true" size={17} />
          </button>
        </div>

        {status === 'submitted' ? (
          <div style={{ paddingTop: '24px', textAlign: 'center' }}>
            <CheckCircle2
              aria-hidden="true"
              color="#2A6E2A"
              size={34}
              style={{ marginBottom: '10px' }}
            />
            <p style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 6px' }}>
              Report submitted
            </p>
            <p style={{ color: '#6E6E64', fontSize: '13px', lineHeight: 1.5 }}>
              It will remain in the review queue until an administrator checks it.
            </p>
            <button onClick={onClose} style={primaryButtonStyle} type="button">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: '22px' }}>
            <label htmlFor={`report-reason-${opportunity.id}`} style={labelStyle}>
              What is wrong?
            </label>
            <select
              id={`report-reason-${opportunity.id}`}
              onChange={event => setReason(event.target.value)}
              value={reason}
              style={fieldStyle}
            >
              {OPPORTUNITY_REPORT_REASONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label htmlFor={`report-details-${opportunity.id}`} style={labelStyle}>
              Details {reason === 'other' ? '(required)' : '(optional)'}
            </label>
            <textarea
              id={`report-details-${opportunity.id}`}
              maxLength={1000}
              onChange={event => setDetails(event.target.value)}
              placeholder="Briefly describe the issue."
              rows={4}
              value={details}
              style={{ ...fieldStyle, resize: 'vertical' }}
            />
            <div style={{ color: '#8A8880', fontSize: '11px', textAlign: 'right' }}>
              {details.length}/1000
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  alignItems: 'flex-start',
                  background: '#FFF1ED',
                  borderLeft: '3px solid #C94F1A',
                  color: '#713217',
                  display: 'flex',
                  fontSize: '12px',
                  gap: '8px',
                  lineHeight: 1.45,
                  marginTop: '14px',
                  padding: '9px 10px',
                }}
              >
                <AlertTriangle aria-hidden="true" size={16} />
                <span>
                  {error.message}{' '}
                  {error.code === 'AUTH_REQUIRED' && (
                    <Link to="/login" style={{ color: '#9A3510', fontWeight: 600 }}>
                      Log in
                    </Link>
                  )}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                disabled={status === 'submitting'}
                onClick={onClose}
                style={secondaryButtonStyle}
                type="button"
              >
                Cancel
              </button>
              <button
                disabled={status === 'submitting'}
                style={primaryButtonStyle}
                type="submit"
              >
                {status === 'submitting' ? 'Submitting...' : 'Submit report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const iconButtonStyle = {
  alignItems: 'center',
  background: '#EDEAE5',
  border: '1px solid #C4BDB5',
  borderRadius: '6px',
  color: '#4F4F49',
  cursor: 'pointer',
  display: 'flex',
  height: '30px',
  justifyContent: 'center',
  padding: 0,
  width: '30px',
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  margin: '0 0 7px',
};

const fieldStyle = {
  background: '#FAFAF7',
  border: '1px solid #C4BDB5',
  borderRadius: '6px',
  boxSizing: 'border-box',
  color: '#1A1A18',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '13px',
  marginBottom: '16px',
  padding: '10px 11px',
  width: '100%',
};

const primaryButtonStyle = {
  background: '#C94F1A',
  border: 'none',
  borderRadius: '6px',
  color: '#FFFFFF',
  cursor: 'pointer',
  flex: 1,
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '13px',
  fontWeight: 600,
  padding: '10px 14px',
};

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  background: '#EDEAE5',
  border: '1px solid #C4BDB5',
  color: '#1A1A18',
};
