import { useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ClipboardCheck,
  FileQuestion,
  FileText,
  Layers3,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import './Study.css';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;
const ACCEPTED_EXTENSIONS = new Set(['pdf', 'docx', 'txt']);

const STUDY_FORMATS = [
  {
    description: 'Turn the main ideas into a clear revision guide.',
    icon: FileText,
    id: 'summary',
    label: 'Summary',
  },
  {
    description: 'Test your understanding with marked questions.',
    icon: FileQuestion,
    id: 'quiz',
    label: 'Quiz',
  },
  {
    description: 'Review key concepts as question-and-answer cards.',
    icon: Layers3,
    id: 'flashcards',
    label: 'Flashcards',
  },
  {
    description: 'Practise under exam-style conditions.',
    icon: ClipboardCheck,
    id: 'mock_exam',
    label: 'Mock exam',
  },
];

function getFileExtension(filename) {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SettingsFields({ format, settings, updateSetting }) {
  if (format === 'summary') {
    return (
      <div className="study-settings-grid">
        <label className="study-field">
          <span>Summary length</span>
          <select
            onChange={event => updateSetting('summaryLength', event.target.value)}
            value={settings.summaryLength}
          >
            <option value="concise">Concise</option>
            <option value="standard">Standard</option>
            <option value="detailed">Detailed</option>
          </select>
        </label>
        <label className="study-field">
          <span>Focus</span>
          <select
            onChange={event => updateSetting('summaryFocus', event.target.value)}
            value={settings.summaryFocus}
          >
            <option value="key-concepts">Key concepts</option>
            <option value="definitions">Definitions and examples</option>
            <option value="exam-revision">Exam revision</option>
          </select>
        </label>
      </div>
    );
  }

  if (format === 'quiz') {
    return (
      <div className="study-settings-grid">
        <label className="study-field">
          <span>Questions</span>
          <select
            onChange={event => updateSetting('quizCount', event.target.value)}
            value={settings.quizCount}
          >
            {[5, 10, 15, 20].map(count => (
              <option key={count} value={count}>{count} questions</option>
            ))}
          </select>
        </label>
        <label className="study-field">
          <span>Question style</span>
          <select
            onChange={event => updateSetting('quizStyle', event.target.value)}
            value={settings.quizStyle}
          >
            <option value="mixed">Mixed</option>
            <option value="multiple-choice">Multiple choice</option>
            <option value="short-answer">Short answer</option>
          </select>
        </label>
        <label className="study-field">
          <span>Difficulty</span>
          <select
            onChange={event => updateSetting('quizDifficulty', event.target.value)}
            value={settings.quizDifficulty}
          >
            <option value="foundational">Foundational</option>
            <option value="mixed">Mixed</option>
            <option value="challenging">Challenging</option>
          </select>
        </label>
      </div>
    );
  }

  if (format === 'flashcards') {
    return (
      <div className="study-settings-grid">
        <label className="study-field">
          <span>Cards</span>
          <select
            onChange={event => updateSetting('flashcardCount', event.target.value)}
            value={settings.flashcardCount}
          >
            {[10, 20, 30].map(count => (
              <option key={count} value={count}>{count} cards</option>
            ))}
          </select>
        </label>
        <label className="study-field">
          <span>Card focus</span>
          <select
            onChange={event => updateSetting('flashcardFocus', event.target.value)}
            value={settings.flashcardFocus}
          >
            <option value="mixed">Mixed concepts</option>
            <option value="definitions">Definitions</option>
            <option value="applications">Applications and examples</option>
          </select>
        </label>
      </div>
    );
  }

  return (
    <div className="study-settings-grid">
      <label className="study-field">
        <span>Duration</span>
        <select
          onChange={event => updateSetting('examDuration', event.target.value)}
          value={settings.examDuration}
        >
          {[30, 60, 90].map(minutes => (
            <option key={minutes} value={minutes}>{minutes} minutes</option>
          ))}
        </select>
      </label>
      <label className="study-field">
        <span>Questions</span>
        <select
          onChange={event => updateSetting('examCount', event.target.value)}
          value={settings.examCount}
        >
          {[10, 20, 30].map(count => (
            <option key={count} value={count}>{count} questions</option>
          ))}
        </select>
      </label>
      <label className="study-field">
        <span>Difficulty</span>
        <select
          onChange={event => updateSetting('examDifficulty', event.target.value)}
          value={settings.examDifficulty}
        >
          <option value="mixed">Mixed</option>
          <option value="foundational">Foundational</option>
          <option value="challenging">Challenging</option>
        </select>
      </label>
    </div>
  );
}

export default function Study() {
  const fileInputRef = useRef(null);
  const resultRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [format, setFormat] = useState('summary');
  const [isDragging, setIsDragging] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [prepared, setPrepared] = useState(false);
  const [sourceError, setSourceError] = useState('');
  const [sourceMode, setSourceMode] = useState('upload');
  const [settings, setSettings] = useState({
    examCount: '20',
    examDifficulty: 'mixed',
    examDuration: '60',
    flashcardCount: '20',
    flashcardFocus: 'mixed',
    quizCount: '10',
    quizDifficulty: 'mixed',
    quizStyle: 'mixed',
    summaryFocus: 'key-concepts',
    summaryLength: 'standard',
  });

  const selectedFormat = useMemo(
    () => STUDY_FORMATS.find(item => item.id === format),
    [format]
  );
  const sourceReady = sourceMode === 'upload'
    ? files.length > 0
    : notesText.trim().length >= 30;

  function markDraftChanged() {
    setPrepared(false);
  }

  function addFiles(selectedFiles) {
    const incomingFiles = Array.from(selectedFiles);
    setSourceError('');
    markDraftChanged();

    if (files.length + incomingFiles.length > MAX_FILES) {
      setSourceError(`You can add up to ${MAX_FILES} files at a time.`);
      return;
    }

    const invalidFile = incomingFiles.find(file => (
      !ACCEPTED_EXTENSIONS.has(getFileExtension(file.name))
      || file.size > MAX_FILE_SIZE
    ));

    if (invalidFile) {
      const reason = invalidFile.size > MAX_FILE_SIZE
        ? 'is larger than 10 MB'
        : 'is not a PDF, DOCX or TXT file';
      setSourceError(`${invalidFile.name} ${reason}.`);
      return;
    }

    const existingKeys = new Set(
      files.map(file => `${file.name}:${file.size}:${file.lastModified}`)
    );
    const uniqueFiles = incomingFiles.filter(file => (
      !existingKeys.has(`${file.name}:${file.size}:${file.lastModified}`)
    ));

    if (uniqueFiles.length === 0 && incomingFiles.length > 0) {
      setSourceError('That file has already been added.');
      return;
    }

    setFiles(current => [...current, ...uniqueFiles]);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function removeFile(indexToRemove) {
    setFiles(current => current.filter((_, index) => index !== indexToRemove));
    setSourceError('');
    markDraftChanged();
  }

  function updateSetting(key, value) {
    setSettings(current => ({ ...current, [key]: value }));
    markDraftChanged();
  }

  function handlePrepare(event) {
    event.preventDefault();

    if (!sourceReady) {
      setSourceError(
        sourceMode === 'upload'
          ? 'Add at least one note before creating study material.'
          : 'Paste at least 30 characters of notes before continuing.'
      );
      return;
    }

    setSourceError('');
    setPrepared(true);
    window.setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  return (
    <div className="study-page">
      <Navbar activePage="Study" />

      <main className="study-main">
        <header className="study-heading">
          <div>
            <p className="study-kicker">
              <BookOpen aria-hidden="true" size={16} />
              AI study workspace
            </p>
            <h1>Study with your notes</h1>
            <p className="study-subheading">
              Add your own course material and choose what you want to create.
            </p>
          </div>
          <div className="study-private-badge">
            Your private workspace
          </div>
        </header>

        <form onSubmit={handlePrepare}>
          <div className="study-workspace">
            <section className="study-panel" aria-labelledby="study-source-heading">
              <div className="study-step-heading">
                <span className="study-step-number">1</span>
                <div>
                  <h2 id="study-source-heading">Add your notes</h2>
                  <p>Use documents or paste text directly.</p>
                </div>
              </div>

              <div className="study-source-tabs" aria-label="Note input method">
                <button
                  aria-pressed={sourceMode === 'upload'}
                  className={sourceMode === 'upload' ? 'is-active' : ''}
                  onClick={() => {
                    setSourceMode('upload');
                    setSourceError('');
                    markDraftChanged();
                  }}
                  type="button"
                >
                  Upload files
                </button>
                <button
                  aria-pressed={sourceMode === 'paste'}
                  className={sourceMode === 'paste' ? 'is-active' : ''}
                  onClick={() => {
                    setSourceMode('paste');
                    setSourceError('');
                    markDraftChanged();
                  }}
                  type="button"
                >
                  Paste notes
                </button>
              </div>

              {sourceMode === 'upload' ? (
                <>
                  <div
                    className={`study-dropzone${isDragging ? ' is-dragging' : ''}`}
                    onDragEnter={event => {
                      event.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={event => {
                      event.preventDefault();
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        setIsDragging(false);
                      }
                    }}
                    onDragOver={event => event.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <UploadCloud aria-hidden="true" size={28} />
                    <strong>Drop your notes here</strong>
                    <span>PDF, DOCX or TXT, up to 10 MB each</span>
                    <button
                      className="study-secondary-button"
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                    >
                      Choose files
                    </button>
                    <input
                      accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="study-file-input"
                      multiple
                      onChange={event => {
                        addFiles(event.target.files);
                        event.target.value = '';
                      }}
                      ref={fileInputRef}
                      type="file"
                    />
                  </div>

                  {files.length > 0 && (
                    <ul className="study-file-list" aria-label="Selected notes">
                      {files.map((file, index) => (
                        <li key={`${file.name}:${file.size}:${file.lastModified}`}>
                          <FileText aria-hidden="true" size={18} />
                          <div>
                            <strong>{file.name}</strong>
                            <span>{formatFileSize(file.size)}</span>
                          </div>
                          <button
                            aria-label={`Remove ${file.name}`}
                            onClick={() => removeFile(index)}
                            title={`Remove ${file.name}`}
                            type="button"
                          >
                            <X aria-hidden="true" size={18} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <div className="study-paste-area">
                  <label htmlFor="study-notes">Lecture notes or readings</label>
                  <textarea
                    id="study-notes"
                    onChange={event => {
                      setNotesText(event.target.value);
                      setSourceError('');
                      markDraftChanged();
                    }}
                    placeholder="Paste the material you want to study..."
                    value={notesText}
                  />
                  <span>{notesText.trim().length.toLocaleString()} characters</span>
                </div>
              )}

              {sourceError && (
                <p className="study-error" role="alert">{sourceError}</p>
              )}
            </section>

            <section
              aria-labelledby="study-format-heading"
              className={`study-panel${sourceReady ? '' : ' is-disabled'}`}
            >
              <div className="study-step-heading">
                <span className="study-step-number">2</span>
                <div>
                  <h2 id="study-format-heading">Choose a format</h2>
                  <p>Select what Estha should create from your notes.</p>
                </div>
              </div>

              <div className="study-format-grid">
                {STUDY_FORMATS.map(item => {
                  const Icon = item.icon;
                  const isSelected = format === item.id;
                  return (
                    <button
                      aria-pressed={isSelected}
                      className={isSelected ? 'is-selected' : ''}
                      disabled={!sourceReady}
                      key={item.id}
                      onClick={() => {
                        setFormat(item.id);
                        markDraftChanged();
                      }}
                      type="button"
                    >
                      <Icon aria-hidden="true" size={21} />
                      <strong>{item.label}</strong>
                      <span>{item.description}</span>
                    </button>
                  );
                })}
              </div>

              {!sourceReady && (
                <p className="study-disabled-note">
                  Add notes to unlock the study formats.
                </p>
              )}
            </section>
          </div>

          <section
            aria-labelledby="study-settings-heading"
            className={`study-settings${sourceReady ? '' : ' is-disabled'}`}
          >
            <div className="study-step-heading">
              <span className="study-step-number">3</span>
              <div>
                <h2 id="study-settings-heading">Set your preferences</h2>
                <p>Adjust the {selectedFormat.label.toLowerCase()} before creating it.</p>
              </div>
            </div>

            <SettingsFields
              format={format}
              settings={settings}
              updateSetting={updateSetting}
            />

            <button
              className="study-primary-button"
              disabled={!sourceReady}
              type="submit"
            >
              <Sparkles aria-hidden="true" size={17} />
              Create {selectedFormat.label.toLowerCase()}
            </button>
          </section>
        </form>

        <section
          aria-live="polite"
          className={`study-result${prepared ? ' is-ready' : ' is-disabled'}`}
          ref={resultRef}
        >
          <div className="study-result-icon">
            <Sparkles aria-hidden="true" size={22} />
          </div>
          {prepared ? (
            <div>
              <p className="study-result-label">Request ready</p>
              <h2>Your {selectedFormat.label.toLowerCase()} will appear here</h2>
              <p>
                Your notes and preferences are prepared. The Estha API connection is
                the next step that will generate the actual study material.
              </p>
            </div>
          ) : (
            <div>
              <p className="study-result-label">Study output</p>
              <h2>Your generated material will appear here</h2>
              <p>Add notes, choose a format and set your preferences to continue.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
