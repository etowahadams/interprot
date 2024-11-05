import React from "react";
import { Link } from "react-router-dom";
import { useIsMobile } from "../hooks/use-mobile";
import HomeNavigator from "./HomeNavigator";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { DEFAULT_SAE_MODEL } from "@/config";
import { SAE_CONFIGS } from "@/SAEConfigs";

const LandingPage: React.FC = () => {
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="flex justify-between items-center">
        <HomeNavigator />
        {isMobile ? (
          <div className="relative">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-600 hover:text-gray-900"
            >
              <Menu />
            </button>
            {isMobileMenuOpen && (
              <nav className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center space-y-8">
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="absolute top-9 right-6 text-gray-600 hover:text-gray-900"
                >
                  <X />
                </button>
                <Link
                  to={`/sae-viz/${DEFAULT_SAE_MODEL}/${SAE_CONFIGS[DEFAULT_SAE_MODEL].defaultDim}`}
                  className="text-2xl text-gray-600 hover:text-gray-900"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Visualizer
                </Link>
                <Link
                  to="https://github.com/etowahadams/plm-interpretability/tree/main"
                  className="text-2xl text-gray-600 hover:text-gray-900"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  GitHub
                </Link>
                <Link
                  to="https://huggingface.co/liambai/InterProt-ESM2-SAEs"
                  className="text-2xl text-gray-600 hover:text-gray-900"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Models
                </Link>
                <a
                  href="mailto:liambai2000@gmail.com"
                  className="text-2xl text-gray-600 hover:text-gray-900"
                >
                  Contact
                </a>
              </nav>
            )}
          </div>
        ) : (
          <nav className="space-x-4 flex">
            <Link to="/sae-viz" className="text-gray-600 hover:text-gray-900">
              Visualizer
            </Link>
            <Link
              to="https://github.com/etowahadams/plm-interpretability/tree/main"
              className="text-gray-600 hover:text-gray-900"
            >
              GitHub
            </Link>
            <Link
              to="https://huggingface.co/liambai/InterProt-ESM2-SAEs"
              className="text-gray-600 hover:text-gray-900"
            >
              Models
            </Link>
            <a href="mailto:liambai2000@gmail.com" className="text-gray-600 hover:text-gray-900">
              Contact
            </a>
          </nav>
        )}
      </header>

      <main
        className={`flex-grow flex flex-col items-center ${
          isMobile ? "text-left mt-16" : "text-center justify-center px-4"
        }`}
      >
        <h1 className="text-3xl font-semibold mb-4">
          Interpreting Proteins through Language Models
        </h1>
        <p className="text-base sm:text-xl mb-8 max-w-2xl mt-4 sm:mt-0">
          InterProt is an open-source project applying mechanistic interpretability to protein
          language models. The goal is to better understand these models and steer them to design
          new proteins.
        </p>
        <p className="text-base sm:text-xl mb-8 max-w-2xl order-3 sm:order-none">
          The project was started by{" "}
          <a href="https://etowahadams.com" className="underline">
            Etowah
          </a>{" "}
          and{" "}
          <a href="https://liambai.com" className="underline">
            Liam
          </a>
          . They trained some Sparse Autoencoders on ESM2 and built an interactive visualizer. More
          soon!
        </p>
        <Link
          to={`/sae-viz/${DEFAULT_SAE_MODEL}/${SAE_CONFIGS[DEFAULT_SAE_MODEL].defaultDim}`}
          className="bg-black text-white px-6 py-3 rounded-full text-lg inline-block order-2 sm:order-none mb-8 w-full sm:w-auto text-center"
        >
          SAE Visualizer
        </Link>
      </main>
    </div>
  );
};

export default LandingPage;
