import React from "react";
import { Link } from "react-router-dom";
import MolstarSimple from "./MolstarSimple";

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="p-4 flex flex-col sm:flex-row justify-between items-center">
        <Link to="/" className="text-2xl font-bold mb-4 sm:mb-0">
          InterProt
        </Link>
        <nav className="space-y-2 sm:space-y-0 sm:space-x-4 flex flex-col sm:flex-row">
          <Link to="/sae-visualizer" className="text-gray-600 hover:text-gray-900">
            Visualizer
          </Link>
          <Link
            to="https://github.com/etowahadams/plm-interpretability/tree/main"
            className="text-gray-600 hover:text-gray-900"
          >
            GitHub
          </Link>
          <a href="mailto:liambai2000@gmail.com" className="text-gray-600 hover:text-gray-900">
            Contact
          </a>
        </nav>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center px-4 text-center">
        <MolstarSimple cifData="https://alphafold.ebi.ac.uk/files/AF-A0PK11-F1-model_v4.cif" />
        <h1 className="text-3xl sm:text-4xl font-bold mb-4">
          Interpreting Proteins through Language Models
        </h1>
        <p className="text-lg sm:text-xl mb-8 max-w-2xl">
          InterProt is an open-source project applying mechanistic interpretability to protein
          language models. The goal is to better understand these models and steer them to design
          new proteins.
        </p>
        <p className="text-lg sm:text-xl mb-8 max-w-2xl">
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
          to="/sae-visualizer"
          className="bg-black text-white px-6 py-3 rounded text-lg inline-block"
        >
          SAE Visualizer
        </Link>
      </main>
    </div>
  );
};

export default LandingPage;
