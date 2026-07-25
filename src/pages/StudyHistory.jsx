import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  History,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Navbar from '../components/Navbar';
import {
  deleteStudyGeneration,
  listStudyGenerations,
} from '../data/studyHistoryService';
import './Study.css';

const FORMAT_LABELS = {
  mock_exam: 'Mock exam',
  quiz: 'Quiz',
  summary: 'Summary',
};

const HISTORY_DATE_FORMATTER = new Intl.DateTimeFormat('en-SG', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatHistoryDate(value) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Unknown date'
    : HISTORY_DATE_FORMATTER.format(date);
}

function getFormatLabel(format) {
  return FORMAT_LABELS[format] || 'Study material';
}

export default function StudyHistory() {
  const [deletingHistoryId, setDeletingHistoryId] = useState('');
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    let isActive = true;

    async function loadHistory() {
      setIsHistoryLoading(true);
      setHistoryError('');

      try {
        const generations = await listStudyGenerations();

        if (isActive) {
          setHistory(generations);
          setSelectedItem(generations[0] || null);
        }
      } catch {
        if (isActive) {
          setHistoryError(
            'History is unavailable. Run the Phase 19 database migration in Supabase, then refresh.',
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

  async function removeHistoryItem(item) {
    if (!window.confirm(`Delete "${item.title}" from your study history?`)) {
      return;
    }

    setDeletingHistoryId(item.id);
    setHistoryError('');

    try {
      await deleteStudyGeneration(item.id);

      const remainingItems = history.filter(
        historyItem => historyItem.id !== item.id,
      );

      setHistory(remainingItems);

      if (selectedItem?.id === item.id) {
        setSelectedItem(remainingItems[0] || null);
      }
    } catch {
      setHistoryError('Could not delete that saved item. Try again.');
    } finally {
      setDeletingHistoryId('');
    }
  }

  return (
    <div className="study-page study-history-page">
      <Navbar activePage="Study" />

      <main className="study-main">
        <header className="study-heading">
          <div>
            <p className="study-kicker">
              <History aria-hidden="true" size={16} />
              Saved materials
            </p>
            <h1>Generation history</h1>
            <p className="study-subheading">
              Review or delete your saved summaries, quizzes and mock exams.
            </p>
          </div>

          <div className="study-heading-actions">
            <Link className="study-history-toggle" to="/study">
              <ArrowLeft aria-hidden="true" size={17} />
              Back to Study
            </Link>
            <div className="study-private-badge">Your private workspace</div>
          </div>
        </header>

        <div className="study-history-layout">
          <section
            aria-labelledby="study-history-heading"
            className="study-history-panel"
          >
            <div className="study-history-header">
              <h2 id="study-history-heading">Saved generations</h2>
              <p>Choose an item to open it.</p>
            </div>

            {isHistoryLoading && (
              <p className="study-history-message">Loading history...</p>
            )}

            {historyError && (
              <p className="study-history-error" role="alert">
                {historyError}
              </p>
            )}

            {!isHistoryLoading && !historyError && history.length === 0 && (
              <p className="study-history-message">
                No saved generations yet. Return to Study to create a summary,
                quiz or mock exam.
              </p>
            )}

            {history.length > 0 && (
              <ul className="study-history-list">
                {history.map(item => (
                  <li
                    className={selectedItem?.id === item.id ? 'is-current' : ''}
                    key={item.id}
                  >
                    <button
                      className="study-history-open"
                      onClick={() => setSelectedItem(item)}
                      type="button"
                    >
                      <span className="study-history-format">
                        {getFormatLabel(item.format)}
                      </span>
                      <strong>{item.title}</strong>
                      <small>
                        {item.source_label} |{' '}
                        {formatHistoryDate(item.created_at)}
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

          {selectedItem ? (
            <section className="study-result is-ready study-history-detail">
              <div className="study-result-icon">
                <Sparkles aria-hidden="true" size={24} />
              </div>
              <div className="study-result-content">
                <p className="study-result-label">
                  Saved {getFormatLabel(selectedItem.format).toLowerCase()}
                </p>
                <h2>{selectedItem.title}</h2>
                <p className="study-history-detail-meta">
                  {selectedItem.source_label} |{' '}
                  {formatHistoryDate(selectedItem.created_at)}
                </p>
                <div className="study-generated-content">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {selectedItem.output}
                  </Markdown>
                </div>
              </div>
            </section>
          ) : (
            <section className="study-result is-disabled study-history-detail">
              <div className="study-result-icon">
                <Sparkles aria-hidden="true" size={24} />
              </div>
              <div>
                <p className="study-result-label">Saved output</p>
                <h2>Your saved material will appear here</h2>
                <p>Select a generation from the history list.</p>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
