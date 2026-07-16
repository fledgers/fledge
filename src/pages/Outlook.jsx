import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, ShieldCheck, Unplug } from 'lucide-react';
import Navbar from '../components/Navbar';
import {
  beginOutlookAuthorization,
  disconnectOutlook,
  loadOutlookStatus,
  setBrowserOutlookDecision,
} from '../data/outlookService';
import { useOpportunities } from '../hooks/useOpportunities';

function formatTimestamp(value) {
  if (!value) return 'Not synced yet';
  return new Intl.DateTimeFormat('en-SG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Singapore',
  }).format(new Date(value));
}

export default function Outlook() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, refresh, user, updateOutlookPreference } = useOpportunities();
  const [connection, setConnection] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(Boolean(user));
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  const callbackStatus = searchParams.get('outlook');
  const returnPath = location.state?.from || '/explore';

  useEffect(() => {
    if (!user) return undefined;

    let cancelled = false;
    loadOutlookStatus()
      .then(status => {
        if (cancelled) return;
        setConnection(status.connection);
        setBrowserOutlookDecision(status.onboarding_status || 'not_asked');
        setLoadingStatus(false);
        if (status.onboarding_status !== profile?.outlook_onboarding_status) {
          void refresh({ showLoading: false });
        }
      })
      .catch(error => {
        if (cancelled) return;
        setMessage(error.message);
        setLoadingStatus(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profile?.outlook_onboarding_status, refresh, user]);

  async function handleConnect() {
    setMessage('');

    if (!user) {
      navigate('/login?next=/outlook');
      return;
    }

    setWorking(true);
    try {
      await beginOutlookAuthorization();
    } catch (error) {
      setWorking(false);
      setMessage(error.message);
    }
  }

  async function handleContinueWithoutOutlook() {
    setMessage('');
    setWorking(true);

    try {
      if (user) {
        await updateOutlookPreference('declined');
      } else {
        setBrowserOutlookDecision('declined');
      }
      navigate(returnPath === '/outlook' ? '/explore' : returnPath);
    } catch (error) {
      setMessage(error.message);
      setWorking(false);
    }
  }

  async function handleDisconnect() {
    setMessage('');
    setWorking(true);

    try {
      await disconnectOutlook();
      setConnection(current => current
        ? { ...current, status: 'disconnected' }
        : null);
      await refresh({ showLoading: false });
      setMessage('Outlook has been disconnected and private Outlook opportunities were removed.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWorking(false);
    }
  }

  const isConnected = connection?.status === 'connected'
    || connection?.status === 'error';
  const callbackMessage = callbackStatus === 'connected'
    ? 'Outlook is connected. The next crawler run will scan for opportunity emails.'
    : callbackStatus === 'cancelled'
      ? 'Outlook connection was cancelled. You can continue without it.'
      : callbackStatus === 'error'
        ? 'Microsoft could not complete the Outlook connection. Try again or continue without it.'
        : '';

  return (
    <div style={pageStyle}>
      <Navbar activePage="Outlook" />

      <main style={mainStyle}>
        <div style={titleRowStyle}>
          <div>
            <h1 style={headingStyle}>NUS Outlook</h1>
            <p style={subheadingStyle}>
              Choose whether Fledge may scan your mailbox for student opportunities.
            </p>
          </div>
          <div style={statusBadgeStyle}>
            {isConnected ? 'Connected' : 'Not connected'}
          </div>
        </div>

        {(callbackMessage || message) && (
          <p
            role={message || callbackStatus === 'error' ? 'alert' : 'status'}
            style={message || callbackStatus === 'error' ? errorStyle : successStyle}
          >
            {message || callbackMessage}
          </p>
        )}

        {loadingStatus ? (
          <div role="status" style={loadingStyle}>Checking Outlook connection...</div>
        ) : isConnected ? (
          <section style={panelStyle}>
            <div style={panelHeadingStyle}>
              <ShieldCheck aria-hidden="true" size={20} />
              <h2 style={sectionHeadingStyle}>Connected mailbox</h2>
            </div>
            <dl style={detailsStyle}>
              <div>
                <dt style={termStyle}>Account</dt>
                <dd style={definitionStyle}>
                  {connection.microsoft_email || connection.microsoft_display_name || 'Microsoft account'}
                </dd>
              </div>
              <div>
                <dt style={termStyle}>Last successful scan</dt>
                <dd style={definitionStyle}>{formatTimestamp(connection.last_crawled_at)}</dd>
              </div>
              <div>
                <dt style={termStyle}>Permission</dt>
                <dd style={definitionStyle}>Read mail only; Fledge cannot send or delete email.</dd>
              </div>
            </dl>

            {connection.last_error && (
              <p role="alert" style={errorStyle}>{connection.last_error}</p>
            )}

            <div style={actionRowStyle}>
              <button
                disabled={working}
                onClick={() => navigate('/explore')}
                style={primaryButtonStyle}
                type="button"
              >
                Explore opportunities
              </button>
              <button
                disabled={working}
                onClick={handleDisconnect}
                style={secondaryButtonStyle}
                type="button"
              >
                <Unplug aria-hidden="true" size={16} />
                {working ? 'Disconnecting...' : 'Disconnect Outlook'}
              </button>
            </div>
          </section>
        ) : (
          <section style={panelStyle}>
            <div style={panelHeadingStyle}>
              <Mail aria-hidden="true" size={20} />
              <h2 style={sectionHeadingStyle}>Connect for inbox opportunities</h2>
            </div>

            <div style={consentGridStyle}>
              <div>
                <h3 style={smallHeadingStyle}>Fledge will</h3>
                <p style={bodyStyle}>
                  Read opportunity-related email content, extract structured opportunity details,
                  and keep restricted results private to your account.
                </p>
              </div>
              <div>
                <h3 style={smallHeadingStyle}>Fledge will not</h3>
                <p style={bodyStyle}>
                  Send, modify or delete email. The crawler stores extracted fields rather than
                  unrelated mailbox content.
                </p>
              </div>
            </div>

            <p style={bodyStyle}>
              Microsoft will show the delegated Mail.Read permission before anything is connected.
              You can disconnect later and remove the stored token and private Outlook results.
            </p>

            <div style={actionRowStyle}>
              <button
                disabled={working}
                onClick={handleConnect}
                style={primaryButtonStyle}
                type="button"
              >
                {user ? 'Connect Outlook' : 'Sign in to connect Outlook'}
              </button>
              <button
                disabled={working}
                onClick={handleContinueWithoutOutlook}
                style={secondaryButtonStyle}
                type="button"
              >
                Continue without Outlook
              </button>
            </div>

            {user && profile?.outlook_onboarding_status === 'declined' && (
              <p style={smallNoteStyle}>You previously continued without Outlook.</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

const pageStyle = {
  background: '#F5F2ED',
  color: '#1A1A18',
  fontFamily: "'DM Sans', sans-serif",
  minHeight: '100vh',
};

const mainStyle = {
  margin: '0 auto',
  maxWidth: '900px',
  padding: '44px 28px 72px',
};

const titleRowStyle = {
  alignItems: 'flex-end',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '20px',
  justifyContent: 'space-between',
  marginBottom: '26px',
};

const headingStyle = {
  fontFamily: "'Fraunces', serif",
  fontSize: '34px',
  margin: '0 0 7px',
};

const subheadingStyle = {
  color: '#6E6E64',
  fontSize: '14px',
  lineHeight: 1.5,
  margin: 0,
};

const statusBadgeStyle = {
  background: '#EEEAE4',
  borderRadius: '6px',
  color: '#5A5A52',
  fontSize: '12px',
  fontWeight: 600,
  padding: '7px 10px',
};

const panelStyle = {
  background: '#FFFFFF',
  border: '1px solid #D7D1C9',
  borderRadius: '8px',
  padding: '28px',
};

const panelHeadingStyle = {
  alignItems: 'center',
  display: 'flex',
  gap: '9px',
  marginBottom: '20px',
};

const sectionHeadingStyle = {
  fontFamily: "'Fraunces', serif",
  fontSize: '21px',
  margin: 0,
};

const consentGridStyle = {
  display: 'grid',
  gap: '18px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  marginBottom: '18px',
};

const smallHeadingStyle = {
  fontSize: '13px',
  margin: '0 0 6px',
};

const bodyStyle = {
  color: '#5F5F57',
  fontSize: '13px',
  lineHeight: 1.55,
  margin: 0,
};

const actionRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '24px',
};

const primaryButtonStyle = {
  background: '#C94F1A',
  border: 'none',
  borderRadius: '6px',
  color: '#FFFFFF',
  cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '13px',
  fontWeight: 600,
  padding: '11px 16px',
};

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  alignItems: 'center',
  background: '#FFFFFF',
  border: '1px solid #BDB7AF',
  color: '#3F3F3A',
  display: 'inline-flex',
  gap: '7px',
};

const detailsStyle = {
  display: 'grid',
  gap: '18px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  margin: 0,
};

const termStyle = {
  color: '#77776E',
  fontSize: '11px',
  fontWeight: 600,
  marginBottom: '4px',
  textTransform: 'uppercase',
};

const definitionStyle = {
  fontSize: '13px',
  lineHeight: 1.45,
  margin: 0,
};

const successStyle = {
  background: '#E8F5E9',
  borderRadius: '6px',
  color: '#2A6E2A',
  fontSize: '13px',
  margin: '0 0 18px',
  padding: '11px 13px',
};

const errorStyle = {
  ...successStyle,
  background: '#FFF1ED',
  color: '#713217',
};

const loadingStyle = {
  color: '#6E6E64',
  fontSize: '14px',
  padding: '40px 0',
  textAlign: 'center',
};

const smallNoteStyle = {
  color: '#77776E',
  fontSize: '12px',
  margin: '18px 0 0',
};
