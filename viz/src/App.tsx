import "./App.css";
import { lazy, Suspense } from "react";
import { createHashRouter, RouterProvider, Navigate } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import ErrorBoundary from "./components/ErrorBoundary";
import { SAEProvider } from "./SAEContext";
import { DEFAULT_SAE_MODEL } from "./config";
import { SAE_CONFIGS } from "./SAEConfigs";
import proteinEmoji from "./protein.png";

// Lazy load heavy pages that use Molstar/Recharts
const SAEVisualizerPage = lazy(() => import("./SAEVisualizerPage"));
const CustomSeqSearchPage = lazy(() => import("./components/CustomSeqSearchPage"));
const AboutPage = lazy(() => import("./components/AboutPage"));
const BlindRatingsPage = lazy(() => import("./components/BlindRatingsPage"));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center w-full h-screen">
      <img src={proteinEmoji} alt="Loading..." className="w-12 h-12 animate-wiggle" />
    </div>
  );
}

const router = createHashRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/about",
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <AboutPage />
      </Suspense>
    ),
  },
  {
    path: "/blind-ratings",
    element: (
      <Suspense fallback={<LoadingFallback />}>
        <BlindRatingsPage />
      </Suspense>
    ),
  },
  {
    path: "/sae-viz",
    element: (
      <Navigate
        to={`/sae-viz/${DEFAULT_SAE_MODEL}/${SAE_CONFIGS[DEFAULT_SAE_MODEL].defaultDim}`}
        replace
      />
    ),
  },
  {
    path: "/sae-viz/:model/",
    element: (
      <SAEProvider>
        <Suspense fallback={<LoadingFallback />}>
          <CustomSeqSearchPage />
        </Suspense>
      </SAEProvider>
    ),
  },
  {
    path: "/sae-viz/:model/:feature",
    element: (
      <SAEProvider>
        <Suspense fallback={<LoadingFallback />}>
          <SAEVisualizerPage />
        </Suspense>
      </SAEProvider>
    ),
  },
]);

function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}

export default App;
