import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { DEFAULT_SAE_MODEL } from "@/config";
import { SAE_CONFIGS } from "@/SAEConfigs";
import HomeNavigator from "./HomeNavigator";
import { useIsMobile } from "../hooks/use-mobile";

const Navbar: React.FC = () => {
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
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
              <a
                href="https://www.biorxiv.org/content/10.1101/2025.02.06.636901v1"
                target="_blank"
                rel="noopener noreferrer"
                className="text-2xl text-gray-600 hover:text-gray-900"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Preprint
              </a>
              <a
                href="https://github.com/etowahadams/plm-interpretability/tree/main"
                target="_blank"
                rel="noopener noreferrer"
                className="text-2xl text-gray-600 hover:text-gray-900"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                GitHub
              </a>
              <a
                href="https://huggingface.co/liambai/InterProt-ESM2-SAEs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-2xl text-gray-600 hover:text-gray-900"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Models
              </a>
              <Link
                to="/about"
                className="text-2xl text-gray-600 hover:text-gray-900"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                About
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
          <a
            href="https://www.biorxiv.org/content/10.1101/2025.02.06.636901v1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-900"
          >
            Preprint
          </a>
          <a
            href="https://github.com/etowahadams/plm-interpretability/tree/main"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-900"
          >
            GitHub
          </a>
          <a
            href="https://huggingface.co/liambai/InterProt-ESM2-SAEs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-900"
          >
            Models
          </a>
          <Link to="/about" className="text-gray-600 hover:text-gray-900">
            About
          </Link>
          <a href="mailto:liambai2000@gmail.com" className="text-gray-600 hover:text-gray-900">
            Contact
          </a>
        </nav>
      )}
    </header>
  );
};

export default Navbar;
