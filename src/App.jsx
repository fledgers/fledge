// App.jsx
// The root file. Sets up routing — this is what makes clicking
// "Explore" / "Saved" / "Sign up" etc actually change the page
// without reloading the browser.

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Explore from './pages/Explore';
import Saved from './pages/Saved';
import ForYou from './pages/ForYou';
import SignUp from './pages/SignUp';
import LogIn from './pages/LogIn';
import Profile from './pages/Profile';
import ResetPassword from './pages/ResetPassword';
import Outlook from './pages/Outlook';
import OutlookGate from './components/OutlookGate';
import OpportunitiesProvider from './providers/OpportunitiesProvider';

// Load fonts once, globally
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,600;1,600&family=DM+Sans:wght@400;500&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

export default function App() {
  return (
    <BrowserRouter>
      <OpportunitiesProvider>
        <Routes>
          <Route path="/" element={<OutlookGate><Landing /></OutlookGate>} />
          <Route path="/explore" element={<OutlookGate><Explore /></OutlookGate>} />
          <Route path="/saved" element={<OutlookGate><Saved /></OutlookGate>} />
          <Route path="/for-you" element={<OutlookGate><ForYou /></OutlookGate>} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/login" element={<LogIn />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/outlook" element={<Outlook />} />
        </Routes>
      </OpportunitiesProvider>
    </BrowserRouter>
  );
}
