import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ClipboardCheck,
  FileQuestion,
  FileText,
  History,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Navbar from '../components/Navbar';
import {
  deleteStudyGeneration,
  listStudyGenerations,
} from '../data/studyHistoryService';
import { supabase } from '../lib/supabase';
import {
  extractNotesFromFiles,
  MAX_NOTE_CHARACTERS,
} from '../utils/noteExtraction';
import './Study.css';

const MAX_FILES = 5;
const ACCEPTED_EXTENSIONS = new Set(['pdf', 'docx', 'txt']);
const HISTORY_DATE_FORMATTER = new Intl.DateTimeFormat('en-SG', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

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

function formatHistoryDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown date'
    : HISTORY_DATE_FORMATTER.format(date);
}

function getFormatLabel(format) {
  return STUDY_FORMATS.find(item => item.id === format)?.label || 'Study material';
}

function getSourceLabel(sourceMode, files) {
  if (sourceMode === 'paste') {
    return 'Pasted notes';
  }

  return (files.map(file => file.name).join(', ') || 'Uploaded notes').slice(0, 300);
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
  const [currentHistoryId, setCurrentHistoryId] = useState('');
  const [deletingHistoryId, setDeletingHistoryId] = useState('');
  const [generationError, setGenerationError] = useState('');
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySaveWarning, setHistorySaveWarning] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [result, setResult] = useState('');
  const [resultFormat, setResultFormat] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [sourceMode, setSourceMode] = useState('upload');
  const [settings, setSettings] = useState({
    examCount: '20',
    examDifficulty: 'mixed',
    examDuration: '60',
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
  const generatedFormat = useMemo(
    () => STUDY_FORMATS.find(item => item.id === resultFormat),
    [resultFormat]
  );
  const sourceReady = sourceMode === 'upload'
    ? files.length > 0
    : notesText.trim().length >= 30;

  useEffect(() => {
    let isActive = true;

    async function loadHistory() {
      setIsHistoryLoading(true);
      setHistoryError('');

      try {
        const generations = await listStudyGenerations();
        if (isActive) {
          setHistory(generations);
        }
      } catch {
        if (isActive) {
          setHistoryError(
            'History is unavailable. Run the Phase 19 database migration in Supabase, then refresh.'
          );
        }
      } finally {
        if (isActive) {
          setIsHistoryLoading(false);
        }
      }
    }

    loadHistory();
    return () => {
      isActive = false;
    };
  }, []);

  function markDraftChanged() {
    setCurrentHistoryId('');
    setGenerationError('');
    setHistorySaveWarning('');
    setResult('');
    setResultFormat('');
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
    ));

    if (invalidFile) {
      setSourceError(`${invalidFile.name} is not a PDF, DOCX or TXT file.`);
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

  function scrollToResult() {
    window.setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  async function handleGenerate(event) {
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
    setGenerationError('');
    setCurrentHistoryId('');
    setHistorySaveWarning('');
    setResult('');
    setResultFormat('');
    setIsGenerating(true);
    scrollToResult();

    try {
      const notes = sourceMode === 'upload'
        ? await extractNotesFromFiles(files)
        : notesText.trim();

      if (notes.length < 30) {
        throw new Error('Add at least 30 characters of readable notes.');
      }

      if (notes.length > MAX_NOTE_CHARACTERS) {
        throw new Error(
          `Reduce your notes to ${MAX_NOTE_CHARACTERS.toLocaleString()} characters or fewer.`
        );
      }

      if (!supabase) {
        throw new Error('Study authentication is not configured for this website.');
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error('Your session has expired. Sign in again before using Study.');
      }

      const response = await fetch('/api/study-generate', {
        body: JSON.stringify({
          format,
          notes,
          settings,
          sourceLabel: getSourceLabel(sourceMode, files),
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'Study generation failed. Try again.');
      }

      if (typeof payload.output !== 'string' || !payload.output.trim()) {
        throw new Error('Estha returned an empty response. Try again.');
      }

      setResult(payload.output.trim());
      setResultFormat(format);
      setCurrentHistoryId(payload.history?.id || '');
      setHistorySaveWarning(
        payload.historySaved
          ? ''
          : 'Generated successfully, but it was not saved to history. Run Phase 19 in Supabase and try again.'
      );

      if (payload.history) {
        setHistory(current => [
          payload.history,
          ...current.filter(item => item.id !== payload.history.id),
        ]);
      }
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : 'Study generation failed. Try again.'
      );
    } finally {
      setIsGenerating(false);
      scrollToResult();
    }
  }

  function openHistoryItem(item) {
    setCurrentHistoryId(item.id);
    setGenerationError('');
    setHistorySaveWarning('');
    setResult(item.output);
    setResultFormat(item.format);
    scrollToResult();
  }

  async function removeHistoryItem(item) {
    if (!window.confirm(`Delete "${item.title}" from your study history?`)) {
      return;
    }

    setDeletingHistoryId(item.id);
    setHistoryError('');

    try {
      await deleteStudyGeneration(item.id);
      setHistory(current => current.filter(historyItem => historyItem.id !== item.id));

      if (currentHistoryId === item.id) {
        setCurrentHistoryId('');
        setResult('');
        setResultFormat('');
      }
    } catch {
      setHistoryError('Could not delete that saved item. Try again.');
    } finally {
      setDeletingHistoryId('');
    }
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
          <div className="study-heading-actions">
            <button
              aria-expanded={historyOpen}
              className="study-history-toggle"
              onClick={() => setHistoryOpen(current => !current)}
              type="button"
            >
              <History aria-hidden="true" size={17} />
              History
              {history.length > 0 && <span>{history.length}</span>}
            </button>
            <div className="study-private-badge">
              Your private workspace
            </div>
          </div>
        </header>

        {historyOpen && (
          <section
            aria-labelledby="study-history-heading"
            className="study-history-panel"
          >
            <div className="study-history-header">
              <p className="study-kicker">Saved materials</p>
              <h2 id="study-history-heading">Generation history</h2>
              <p>Open or delete your latest saved study materials.</p>
            </div>

            {isHistoryLoading && (
              <p className="study-history-message">Loading history...</p>
            )}

            {historyError && (
              <p className="study-history-error" role="alert">{historyError}</p>
            )}

            {!isHistoryLoading && !historyError && history.length === 0 && (
              <p className="study-history-message">
                No saved generations yet. Create a summary, quiz or mock exam
                to start your history.
              </p>
            )}

            {history.length > 0 && (
              <ul className="study-history-list">
                {history.map(item => (
                  <li
                    className={currentHistoryId === item.id ? 'is-current' : ''}
                    key={item.id}
                  >
                    <button
                      className="study-history-open"
                      onClick={() => openHistoryItem(item)}
                      type="button"
                    >
                      <span className="study-history-format">
                        {getFormatLabel(item.format)}
                      </span>
                      <strong>{item.title}</strong>
                      <small>
                        {item.source_label} · {formatHistoryDate(item.created_at)}
                      </small>
                    </button>
                    <button
                      aria-label={`Delete ${item.title}`}
                      className="study-history-delete"
                      disabled={deletingHistoryId === item.id}
                      onClick={() => removeHistoryItem(item)}
                      title={`Delete ${item.title}`}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={17} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <form onSubmit={handleGenerate}>
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
                    <span>PDF, DOCX or TXT</span>
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
                      disabled={!sourceReady || isGenerating}
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
              disabled={!sourceReady || isGenerating}
              type="submit"
            >
              <Sparkles aria-hidden="true" size={17} />
              {isGenerating
                ? `Creating ${selectedFormat.label.toLowerCase()}...`
                : `Create ${selectedFormat.label.toLowerCase()}`}
            </button>
          </section>
        </form>

        <section
          aria-live="polite"
          aria-busy={isGenerating}
          className={`study-result${
            isGenerating
              ? ' is-loading'
              : result
                ? ' is-ready'
                : generationError
                  ? ' has-error'
                  : ' is-disabled'
          }`}
          ref={resultRef}
        >
          <div className="study-result-icon">
            <Sparkles aria-hidden="true" size={22} />
          </div>
          {isGenerating ? (
            <div>
              <p className="study-result-label">Creating material</p>
              <h2>Estha is preparing your {selectedFormat.label.toLowerCase()}</h2>
              <p>This can take up to a minute for longer notes.</p>
            </div>
          ) : generationError ? (
            <div>
              <p className="study-result-label">Could not generate</p>
              <h2>Check your notes and try again</h2>
              <p className="study-result-error" role="alert">{generationError}</p>
            </div>
          ) : result ? (
            <div className="study-result-content">
              <p className="study-result-label">
                {currentHistoryId ? 'Saved study output' : 'Study output'}
              </p>
              <h2>Your {generatedFormat?.label.toLowerCase() || 'study material'}</h2>
              <div className="study-generated-content">
                <Markdown remarkPlugins={[remarkGfm]}>{result}</Markdown>
              </div>
              {historySaveWarning && (
                <p className="study-history-warning" role="status">
                  {historySaveWarning}
                </p>
              )}
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
