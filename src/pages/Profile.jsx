import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import OpportunityDataState from '../components/OpportunityDataState';
import { CATEGORIES, MAJORS } from '../data/opportunityFilters';
import { useOpportunities } from '../hooks/useOpportunities';

const PROFILE_INTERESTS = CATEGORIES.filter(category => category.key !== 'all');

const DELIVERY_MODES = [
  { key: 'online', label: 'Online' },
  { key: 'hybrid', label: 'Hybrid' },
  { key: 'in_person', label: 'In person' },
];

const OPTIONAL_FIELDS = {
  opportunity_budget_sgd: '',
  preferred_delivery_modes: [],
  preferred_locations: '',
  skills_experience: '',
  weekly_availability_hours: '',
  willing_to_travel: '',
  workload_preference: '',
};

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
    career_goals: formChanges.career_goals ?? profile?.career_goals ?? '',
    faculty: formChanges.faculty ?? profile?.faculty ?? '',
    full_name: formChanges.full_name
      ?? profile?.full_name
      ?? user?.user_metadata?.full_name
      ?? '',
    major: formChanges.major ?? profile?.major ?? '',
    opportunity_budget_sgd: formChanges.opportunity_budget_sgd
      ?? profile?.opportunity_budget_sgd?.toString()
      ?? '',
    opportunity_interests: formChanges.opportunity_interests
      ?? profile?.opportunity_interests
      ?? [],
    preferred_delivery_modes: formChanges.preferred_delivery_modes
      ?? profile?.preferred_delivery_modes
      ?? [],
    preferred_locations: formChanges.preferred_locations
      ?? profile?.preferred_locations
      ?? '',
    skills_experience: formChanges.skills_experience
      ?? profile?.skills_experience
      ?? '',
    weekly_availability_hours: formChanges.weekly_availability_hours
      ?? profile?.weekly_availability_hours?.toString()
      ?? '',
    willing_to_travel: formChanges.willing_to_travel
      ?? (profile?.willing_to_travel === true
        ? 'yes'
        : profile?.willing_to_travel === false
          ? 'no'
          : ''),
    workload_preference: formChanges.workload_preference
      ?? profile?.workload_preference
      ?? '',
    year_of_study: formChanges.year_of_study
      ?? profile?.year_of_study?.toString()
      ?? '',
  };

  function updateField(event) {
    const { name, value } = event.target;
    setFormChanges(current => ({ ...current, [name]: value }));
  }

  function toggleListField(field, value) {
    setFormChanges(current => {
      const selected = current[field] ?? form[field];
      return {
        ...current,
        [field]: selected.includes(value)
          ? selected.filter(item => item !== value)
          : [...selected, value],
      };
    });
  }

  function clearOptionalDetails() {
    setFormChanges(current => ({ ...current, ...OPTIONAL_FIELDS }));
    setMessage('Optional recommendation details cleared. Save your profile to apply.');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    if (!form.full_name.trim()) {
      setMessage('Add your full name.');
      return;
    }

    if (!form.faculty.trim()) {
      setMessage('Add your faculty or school.');
      return;
    }

    if (!form.major) {
      setMessage('Select your major.');
      return;
    }

    if (!form.year_of_study) {
      setMessage('Select your year of study.');
      return;
    }

    if (form.opportunity_interests.length === 0) {
      setMessage('Choose at least one opportunity interest.');
      return;
    }

    if (!form.career_goals.trim()) {
      setMessage('Add your career or learning goals.');
      return;
    }

    setSaving(true);

    try {
      await updateProfile({
        ...form,
        opportunity_budget_sgd: form.opportunity_budget_sgd === ''
          ? null
          : Number(form.opportunity_budget_sgd),
        weekly_availability_hours: form.weekly_availability_hours === ''
          ? null
          : Number(form.weekly_availability_hours),
        willing_to_travel: form.willing_to_travel === ''
          ? null
          : form.willing_to_travel === 'yes',
        year_of_study: form.year_of_study
          ? Number(form.year_of_study)
          : null,
      });
      setFormChanges({});
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
              Tell Fledge what you are looking for to receive more relevant
              opportunity recommendations.
            </p>
          </div>
          <div style={headingLinksStyle}>
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
            <section style={sectionStyle}>
              <div style={sectionHeadingStyle}>
                <div>
                  <p style={eyebrowStyle}>Account</p>
                  <h2 style={sectionTitleStyle}>Your details</h2>
                </div>
                <p style={sectionDescriptionStyle}>
                  These identify your private Fledge profile.
                </p>
              </div>

              <div style={fieldGridStyle}>
                <div style={fieldStyle}>
                  <label htmlFor="profile-name" style={labelStyle}>
                    Full name <span style={requiredStyle}>Required</span>
                  </label>
                  <input
                    autoComplete="name"
                    id="profile-name"
                    maxLength={120}
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
              </div>
            </section>

            <section style={sectionStyle}>
              <div style={sectionHeadingStyle}>
                <div>
                  <p style={eyebrowStyle}>Required</p>
                  <h2 style={sectionTitleStyle}>Recommendation essentials</h2>
                </div>
                <p style={sectionDescriptionStyle}>
                  Used to filter eligibility and understand what you want to pursue.
                </p>
              </div>

              <div style={fieldGridStyle}>
                <div style={fieldStyle}>
                  <label htmlFor="profile-faculty" style={labelStyle}>
                    Faculty or school <span style={requiredStyle}>Required</span>
                  </label>
                  <input
                    id="profile-faculty"
                    maxLength={150}
                    name="faculty"
                    onChange={updateField}
                    placeholder="For example, School of Computing"
                    required
                    style={inputStyle}
                    type="text"
                    value={form.faculty}
                  />
                </div>

                <div style={fieldStyle}>
                  <label htmlFor="profile-major" style={labelStyle}>
                    Major <span style={requiredStyle}>Required</span>
                  </label>
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
                  <label htmlFor="profile-year" style={labelStyle}>
                    Year of study <span style={requiredStyle}>Required</span>
                  </label>
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
              </div>

              <fieldset style={fieldsetStyle}>
                <legend style={legendStyle}>
                  Opportunity interests <span style={requiredStyle}>Required</span>
                </legend>
                <p style={helperTextStyle}>Choose at least one.</p>
                <div style={choiceGridStyle}>
                  {PROFILE_INTERESTS.map(interest => (
                    <label key={interest.key} style={choiceStyle}>
                      <input
                        checked={form.opportunity_interests.includes(interest.key)}
                        onChange={() => toggleListField(
                          'opportunity_interests',
                          interest.key
                        )}
                        type="checkbox"
                      />
                      <span>{interest.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div style={fullWidthFieldStyle}>
                <label htmlFor="profile-goals" style={labelStyle}>
                  Career or learning goals <span style={requiredStyle}>Required</span>
                </label>
                <textarea
                  id="profile-goals"
                  maxLength={1000}
                  name="career_goals"
                  onChange={updateField}
                  placeholder="For example, explore product management and gain startup experience."
                  required
                  rows={4}
                  style={textareaStyle}
                  value={form.career_goals}
                />
              </div>
            </section>

            <section style={sectionStyle}>
              <div style={sectionHeadingStyle}>
                <div>
                  <p style={eyebrowStyle}>Optional</p>
                  <h2 style={sectionTitleStyle}>Fine-tune your recommendations</h2>
                </div>
                <button
                  onClick={clearOptionalDetails}
                  style={clearButtonStyle}
                  type="button"
                >
                  Clear optional details
                </button>
              </div>

              <div style={privacyNoteStyle}>
                Fledge asks for these optional details only to improve your
                opportunity recommendations. They are stored privately in your
                account, not used for advertising, and never shown on a public
                profile. You can leave them blank, edit them, or clear them at
                any time.
              </div>

              <div style={fieldGridStyle}>
                <div style={fullWidthFieldStyle}>
                  <label htmlFor="profile-skills" style={labelStyle}>
                    Skills and past experience
                  </label>
                  <textarea
                    id="profile-skills"
                    maxLength={1500}
                    name="skills_experience"
                    onChange={updateField}
                    placeholder="For example, Python, event planning, case competitions."
                    rows={4}
                    style={textareaStyle}
                    value={form.skills_experience}
                  />
                </div>

                <div style={fieldStyle}>
                  <label htmlFor="profile-availability" style={labelStyle}>
                    Weekly availability
                  </label>
                  <div style={inputSuffixStyle}>
                    <input
                      id="profile-availability"
                      max={168}
                      min={0}
                      name="weekly_availability_hours"
                      onChange={updateField}
                      placeholder="For example, 6"
                      style={suffixInputStyle}
                      type="number"
                      value={form.weekly_availability_hours}
                    />
                    <span style={suffixStyle}>hours</span>
                  </div>
                </div>

                <div style={fieldStyle}>
                  <label htmlFor="profile-workload" style={labelStyle}>
                    Workload preference
                  </label>
                  <select
                    id="profile-workload"
                    name="workload_preference"
                    onChange={updateField}
                    style={inputStyle}
                    value={form.workload_preference}
                  >
                    <option value="">No preference</option>
                    <option value="light">Light</option>
                    <option value="moderate">Moderate</option>
                    <option value="intensive">Intensive</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </div>

                <div style={fieldStyle}>
                  <label htmlFor="profile-budget" style={labelStyle}>
                    Maximum opportunity budget
                  </label>
                  <div style={inputSuffixStyle}>
                    <span style={prefixStyle}>S$</span>
                    <input
                      id="profile-budget"
                      max={100000}
                      min={0}
                      name="opportunity_budget_sgd"
                      onChange={updateField}
                      placeholder="No limit stated"
                      style={prefixInputStyle}
                      type="number"
                      value={form.opportunity_budget_sgd}
                    />
                  </div>
                </div>

                <div style={fieldStyle}>
                  <label htmlFor="profile-locations" style={labelStyle}>
                    Preferred locations
                  </label>
                  <input
                    id="profile-locations"
                    maxLength={300}
                    name="preferred_locations"
                    onChange={updateField}
                    placeholder="For example, Singapore, Japan, Europe"
                    style={inputStyle}
                    type="text"
                    value={form.preferred_locations}
                  />
                </div>

                <div style={fieldStyle}>
                  <label htmlFor="profile-travel" style={labelStyle}>
                    Willing to travel
                  </label>
                  <select
                    id="profile-travel"
                    name="willing_to_travel"
                    onChange={updateField}
                    style={inputStyle}
                    value={form.willing_to_travel}
                  >
                    <option value="">No preference stated</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>

              <fieldset style={fieldsetStyle}>
                <legend style={legendStyle}>Preferred delivery modes</legend>
                <div style={compactChoiceGridStyle}>
                  {DELIVERY_MODES.map(mode => (
                    <label key={mode.key} style={choiceStyle}>
                      <input
                        checked={form.preferred_delivery_modes.includes(mode.key)}
                        onChange={() => toggleListField(
                          'preferred_delivery_modes',
                          mode.key
                        )}
                        type="checkbox"
                      />
                      <span>{mode.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>

            {message && (
              <p
                role={message === 'Your profile has been saved.' ? 'status' : 'alert'}
                style={message === 'Your profile has been saved.'
                  ? successStyle
                  : message.startsWith('Optional recommendation')
                    ? infoStyle
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
  maxWidth: '1040px',
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

const headingLinksStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '16px',
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
  padding: '0 28px 28px',
};

const sectionStyle = {
  borderBottom: '1px solid #E4DED7',
  padding: '28px 0',
};

const sectionHeadingStyle = {
  alignItems: 'flex-start',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px 28px',
  justifyContent: 'space-between',
  marginBottom: '22px',
};

const eyebrowStyle = {
  color: '#C94F1A',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: 0,
  margin: '0 0 5px',
  textTransform: 'uppercase',
};

const sectionTitleStyle = {
  fontFamily: "'Fraunces', serif",
  fontSize: '23px',
  fontWeight: 600,
  margin: 0,
};

const sectionDescriptionStyle = {
  color: '#6E6E64',
  fontSize: '13px',
  lineHeight: 1.5,
  margin: 0,
  maxWidth: '420px',
};

const fieldGridStyle = {
  display: 'grid',
  gap: '20px 24px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 270px), 1fr))',
};

const fieldStyle = { minWidth: 0 };

const fullWidthFieldStyle = {
  gridColumn: '1 / -1',
  minWidth: 0,
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  marginBottom: '7px',
};

const requiredStyle = {
  color: '#9B421B',
  fontSize: '10px',
  fontWeight: 600,
  marginLeft: '5px',
  textTransform: 'uppercase',
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

const textareaStyle = {
  ...inputStyle,
  lineHeight: 1.55,
  minHeight: '104px',
  resize: 'vertical',
};

const disabledInputStyle = {
  ...inputStyle,
  background: '#EEEAE4',
  color: '#6E6E64',
};

const fieldsetStyle = {
  border: 0,
  gridColumn: '1 / -1',
  margin: '22px 0 0',
  minWidth: 0,
  padding: 0,
};

const legendStyle = {
  fontSize: '13px',
  fontWeight: 600,
  padding: 0,
};

const helperTextStyle = {
  color: '#6E6E64',
  fontSize: '12px',
  margin: '5px 0 12px',
};

const choiceGridStyle = {
  display: 'grid',
  gap: '8px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
};

const compactChoiceGridStyle = {
  ...choiceGridStyle,
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  maxWidth: '620px',
};

const choiceStyle = {
  alignItems: 'center',
  background: '#FAFAF7',
  border: '1px solid #DDD7CF',
  borderRadius: '6px',
  cursor: 'pointer',
  display: 'flex',
  fontSize: '13px',
  gap: '9px',
  minHeight: '40px',
  padding: '8px 10px',
};

const privacyNoteStyle = {
  background: '#FFF8E7',
  borderLeft: '3px solid #D99A00',
  color: '#5C4A1B',
  fontSize: '13px',
  lineHeight: 1.55,
  marginBottom: '22px',
  padding: '12px 14px',
};

const clearButtonStyle = {
  background: 'transparent',
  border: 0,
  color: '#9B421B',
  cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '12px',
  fontWeight: 600,
  padding: '3px 0',
};

const inputSuffixStyle = {
  alignItems: 'stretch',
  display: 'flex',
};

const suffixInputStyle = {
  ...inputStyle,
  borderRadius: '6px 0 0 6px',
};

const prefixInputStyle = {
  ...inputStyle,
  borderRadius: '0 6px 6px 0',
};

const suffixStyle = {
  alignItems: 'center',
  background: '#EEEAE4',
  border: '1px solid #D7D1C9',
  borderLeft: 0,
  borderRadius: '0 6px 6px 0',
  color: '#6E6E64',
  display: 'flex',
  fontSize: '12px',
  padding: '0 11px',
};

const prefixStyle = {
  ...suffixStyle,
  borderLeft: '1px solid #D7D1C9',
  borderRadius: '6px 0 0 6px',
  borderRight: 0,
};

const actionsStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  paddingTop: '24px',
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
  margin: '24px 0 0',
  padding: '11px 13px',
};

const infoStyle = {
  ...successStyle,
  background: '#EEF4FA',
  color: '#2F5875',
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
