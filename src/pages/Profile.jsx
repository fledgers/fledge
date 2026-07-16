import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import OpportunityDataState from '../components/OpportunityDataState';
import { MAJORS } from '../data/opportunityFilters';
import { useOpportunities } from '../hooks/useOpportunities';

export default function Profile() {
  const {
    error,
    isLoading,
    profile,
    refresh,
    updateProfile,
    user,
  } = useOpportunities();
  const [formChanges, setFormChanges] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const form = {
    faculty: formChanges.faculty ?? profile?.faculty ?? '',
    full_name: formChanges.full_name
      ?? profile?.full_name
      ?? user?.user_metadata?.full_name
      ?? '',
    major: formChanges.major ?? profile?.major ?? '',
    year_of_study: formChanges.year_of_study
      ?? profile?.year_of_study?.toString()
      ?? '',
  };

  function updateField(event) {
    const { name, value } = event.target;
    setFormChanges(current => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setSaving(true);

    try {
      await updateProfile({
        ...form,
        year_of_study: form.year_of_study
          ? Number(form.year_of_study)
          : null,
      });
      setMessage('Your profile has been saved.');
    } catch (saveError) {
      setMessage(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={pageStyle}>
      <Navbar />

      <main style={mainStyle}>
        <div style={headingRowStyle}>
          <div>
            <h1 style={headingStyle}>Student profile</h1>
            <p style={subheadingStyle}>
              Keep your NUS study details current for filtering and eligibility checks.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Link to="/outlook" style={backLinkStyle}>Manage Outlook</Link>
            <Link to="/explore" style={backLinkStyle}>Back to Explore</Link>
          </div>
        </div>

        {isLoading || error ? (
          <OpportunityDataState
            error={error}
            isLoading={isLoading}
            onRetry={refresh}
          />
        ) : !user ? (
          <section style={noticeStyle}>
            <h2 style={noticeHeadingStyle}>Log in to edit your profile</h2>
            <p style={noticeTextStyle}>
              Your profile is connected to your Fledge account.
            </p>
            <Link to="/login" style={primaryLinkStyle}>Log in</Link>
          </section>
        ) : (
          <form onSubmit={handleSubmit} style={formStyle}>
            <div style={fieldStyle}>
              <label htmlFor="profile-name" style={labelStyle}>Full name</label>
              <input
                autoComplete="name"
                id="profile-name"
                name="full_name"
                onChange={updateField}
                required
                style={inputStyle}
                type="text"
                value={form.full_name}
              />
            </div>

            <div style={fieldStyle}>
              <label htmlFor="profile-email" style={labelStyle}>Account email</label>
              <input
                disabled
                id="profile-email"
                style={disabledInputStyle}
                type="email"
                value={user.email || ''}
              />
            </div>

            <div style={fieldStyle}>
              <label htmlFor="profile-university" style={labelStyle}>University</label>
              <input
                disabled
                id="profile-university"
                style={disabledInputStyle}
                type="text"
                value="National University of Singapore"
              />
            </div>

            <div style={fieldStyle}>
              <label htmlFor="profile-faculty" style={labelStyle}>Faculty or school</label>
              <input
                id="profile-faculty"
                name="faculty"
                onChange={updateField}
                placeholder="For example, School of Computing"
                style={inputStyle}
                type="text"
                value={form.faculty}
              />
            </div>

            <div style={fieldStyle}>
              <label htmlFor="profile-major" style={labelStyle}>Major</label>
              <select
                id="profile-major"
                name="major"
                onChange={updateField}
                required
                style={inputStyle}
                value={form.major}
              >
                <option value="">Select your major</option>
                {MAJORS.map(major => (
                  <option key={major.key} value={major.key}>{major.label}</option>
                ))}
              </select>
            </div>

            <div style={fieldStyle}>
              <label htmlFor="profile-year" style={labelStyle}>Year of study</label>
              <select
                id="profile-year"
                name="year_of_study"
                onChange={updateField}
                required
                style={inputStyle}
                value={form.year_of_study}
              >
                <option value="">Select your year</option>
                {[1, 2, 3, 4].map(year => (
                  <option key={year} value={year}>Year {year}</option>
                ))}
              </select>
            </div>

            {message && (
              <p
                role={message === 'Your profile has been saved.' ? 'status' : 'alert'}
                style={message === 'Your profile has been saved.'
                  ? successStyle
                  : errorStyle}
              >
                {message}
              </p>
            )}

            <div style={actionsStyle}>
              <button disabled={saving} style={saveButtonStyle} type="submit">
                {saving ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </form>
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
  maxWidth: '920px',
  padding: '44px 32px 72px',
};

const headingRowStyle = {
  alignItems: 'flex-end',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '24px',
  justifyContent: 'space-between',
  marginBottom: '28px',
};

const headingStyle = {
  fontFamily: "'Fraunces', serif",
  fontSize: '34px',
  fontWeight: 600,
  margin: '0 0 7px',
};

const subheadingStyle = {
  color: '#6E6E64',
  fontSize: '14px',
  lineHeight: 1.5,
  margin: 0,
};

const backLinkStyle = {
  color: '#C94F1A',
  fontSize: '13px',
  fontWeight: 600,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

const formStyle = {
  background: '#FFFFFF',
  border: '1px solid #D7D1C9',
  borderRadius: '8px',
  display: 'grid',
  gap: '20px 24px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  padding: '28px',
};

const fieldStyle = { minWidth: 0 };

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  marginBottom: '7px',
};

const inputStyle = {
  background: '#FAFAF7',
  border: '1px solid #D7D1C9',
  borderRadius: '6px',
  boxSizing: 'border-box',
  color: '#1A1A18',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '14px',
  minHeight: '42px',
  padding: '10px 12px',
  width: '100%',
};

const disabledInputStyle = {
  ...inputStyle,
  background: '#EEEAE4',
  color: '#6E6E64',
};

const actionsStyle = {
  display: 'flex',
  gridColumn: '1 / -1',
  justifyContent: 'flex-end',
};

const saveButtonStyle = {
  background: '#C94F1A',
  border: 'none',
  borderRadius: '6px',
  color: '#FFFFFF',
  cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '14px',
  fontWeight: 600,
  minWidth: '130px',
  padding: '11px 18px',
};

const successStyle = {
  background: '#E8F5E9',
  borderRadius: '6px',
  color: '#2A6E2A',
  fontSize: '13px',
  gridColumn: '1 / -1',
  margin: 0,
  padding: '11px 13px',
};

const errorStyle = {
  ...successStyle,
  background: '#FFF1ED',
  color: '#713217',
};

const noticeStyle = {
  background: '#FFFFFF',
  border: '1px solid #D7D1C9',
  borderRadius: '8px',
  padding: '32px',
};

const noticeHeadingStyle = {
  fontFamily: "'Fraunces', serif",
  fontSize: '21px',
  margin: '0 0 8px',
};

const noticeTextStyle = {
  color: '#6E6E64',
  fontSize: '14px',
  margin: '0 0 20px',
};

const primaryLinkStyle = {
  ...saveButtonStyle,
  display: 'inline-block',
  textAlign: 'center',
  textDecoration: 'none',
};
