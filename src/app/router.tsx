import { createBrowserRouter } from 'react-router';
import type { RouteObject } from 'react-router';
import { AppShell } from './AppShell';
import { Home } from '../screens/Home';
import { Login } from '../screens/Login';
import { PlacementQuiz } from '../screens/PlacementQuiz';
import { PlacementResult } from '../screens/PlacementResult';
import { NewLoaf } from '../screens/NewLoaf';
import { BuiltReview } from '../screens/NewLoaf/BuiltReview';
import { ChooseLoaf } from '../screens/ChooseLoaf';
import { Lesson } from '../screens/Lesson';
import { Lessons } from '../screens/Lessons';
import { LoafQuiz } from '../screens/LoafQuiz';
import { SavingSetup } from '../screens/SavingSetup';
import { LoafComplete } from '../screens/LoafComplete';
import { RiskQuiz } from '../screens/RiskQuiz';
import { RiskResult } from '../screens/RiskResult';
import { Shelf } from '../screens/Shelf';
import { Points } from '../screens/Points';
import { Settings } from '../screens/Settings';

/** Exported so tests can mount the same routes in a memory router. */
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/login', element: <Login /> },
      { path: '/placement', element: <PlacementQuiz /> },
      { path: '/placement/result', element: <PlacementResult /> },
      { path: '/new-loaf', element: <NewLoaf /> },
      { path: '/built-review', element: <BuiltReview /> },
      { path: '/choose-loaf', element: <ChooseLoaf /> },
      { path: '/lessons', element: <Lessons /> },
      { path: '/lessons/:lessonId', element: <Lesson /> },
      { path: '/quiz', element: <LoafQuiz /> },
      { path: '/saving-setup', element: <SavingSetup /> },
      { path: '/loaf-complete', element: <LoafComplete /> },
      { path: '/shelf', element: <Shelf /> },
      { path: '/risk-quiz', element: <RiskQuiz /> },
      { path: '/risk-result', element: <RiskResult /> },
      { path: '/points', element: <Points /> },
      { path: '/settings', element: <Settings /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
