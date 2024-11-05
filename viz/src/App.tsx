import "./App.css";
import { createHashRouter, RouterProvider, Navigate } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import SAEVisualizerPage from "./SAEVisualizerPage";
import ErrorBoundary from "./components/ErrorBoundary";
import CustomSeqSearchPage from "./components/CustomSeqSearchPage";
import { SAEProvider } from "./SAEContext";

const router = createHashRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/sae-viz",
    element: <Navigate to="/sae-viz/SAE4096-L24/2293" replace />,
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
