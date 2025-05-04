import "./App.css";
import { createHashRouter, RouterProvider, Navigate } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import SAEVisualizerPage from "./SAEVisualizerPage";
import ErrorBoundary from "./components/ErrorBoundary";
import CustomSeqSearchPage from "./components/CustomSeqSearchPage";
import AboutPage from "./components/AboutPage";
import BlindRatingsPage from "./components/BlindRatingsPage";
import { SAEProvider } from "./SAEContext";
import { DEFAULT_SAE_MODEL } from "./config";
import { SAE_CONFIGS } from "./SAEConfigs";

const router = createHashRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/about",
    element: <AboutPage />,
  },
  {
    path: "/blind-ratings",
    element: <BlindRatingsPage />,
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
        <CustomSeqSearchPage />
      </SAEProvider>
    ),
  },
  {
    path: "/sae-viz/:model/:feature",
    element: (
      <SAEProvider>
        <SAEVisualizerPage />
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
