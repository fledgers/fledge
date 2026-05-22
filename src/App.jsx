// App.jsx
// This is the root of your app.
// It imports all components and assembles the landing page.
// Think of it as the "frame" that holds everything together.

import { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import OpportunitiesSection from './components/OpportunitiesSection';
import CTA from './components/CTA';
import Footer from './components/Footer';

// Google Fonts — paste this in your index.html <head> instead if you prefer
// For now this works fine here
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,600;1,600&family=DM+Sans:wght@400;500&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

export default function App() {
  // Bookmarks state lives here so both Navbar and OpportunitiesSection can access it
  // Later this moves into useOpportunities.js when you wire up the full logic
  const [bookmarks, setBookmarks] = useState([]);

  function toggleBookmark(id) {
    setBookmarks(prev =>
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  }

  return (
    // The outer div just resets any default browser margins
    <div style={{ margin: 0, padding: 0, minHeight: '100vh' }}>
      <Navbar />
      <Hero />
      <OpportunitiesSection bookmarks={bookmarks} onBookmark={toggleBookmark} />
      <CTA />
      <Footer />
    </div>
  );
}
