import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout.tsx';
import Landing from '@/routes/Landing.tsx';
import VibeCheck from '@/routes/VibeCheck.tsx';
import Results from '@/routes/Results.tsx';
import Browse from '@/routes/Browse.tsx';
import GameDetail from '@/routes/GameDetail.tsx';
import DailySpin from '@/routes/DailySpin.tsx';
import Collection from '@/routes/Collection.tsx';
import About from '@/routes/About.tsx';
import NotFound from '@/routes/NotFound.tsx';

/**
 * Routes are imported eagerly rather than lazily: the whole app including the
 * dataset is a few hundred kilobytes, and code-splitting six small routes would
 * trade a fast first paint for a spinner on every navigation.
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Landing />} />
          <Route path="vibe-check" element={<VibeCheck />} />
          <Route path="results" element={<Results />} />
          <Route path="browse" element={<Browse />} />
          <Route path="game/:slug" element={<GameDetail />} />
          <Route path="spin" element={<DailySpin />} />
          <Route path="collection" element={<Collection />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
