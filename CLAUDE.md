# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InterProt is a React frontend for visualizing sparse autoencoder (SAE) features learned from protein language models. It allows researchers to explore interpretable latent features that capture protein structural and functional properties.

- **Website**: https://interprot.com

## Commands

```bash
cd viz
pnpm install        # Install dependencies
pnpm run dev        # Development server at http://localhost:5173
pnpm run build      # Production build (tsc -b && vite build)
pnpm run lint       # ESLint
```

## Verifying Changes

I already have a server runs at http://localhost:5173. Key pages to test:

- **Landing page**: http://localhost:5173/
- **SAE feature viewer**: http://localhost:5173/sae-viz/SAE4096-L24/feature/0 (change feature number to test different features)
- **Custom sequence search**: http://localhost:5173/sae-viz/SAE4096-L24/ (enter a protein sequence to see SAE activations)

Always run `pnpm run build` before committing to catch TypeScript errors.

## Architecture

- **Tech stack**: React 18, TypeScript, Vite, Tailwind CSS, Radix UI
- **`SAEConfigs.ts`**: Model definitions and curated feature metadata
- **`SAEContext.tsx`**: Context-based state management for current model/feature
- **`SAEVisualizerPage.tsx`**: Main visualization page
- **Molstar integration**: 3D protein structure rendering with activation highlighting
- **RunPod serverless**: External services handle SAE inference for custom sequences

## Code Style

- ESLint for linting, Prettier for formatting (config in viz/.prettierrc)
- Pre-commit hooks enforce formatting on staged files

## Key Patterns

- Feature data is loaded from remote storage (STORAGE_ROOT_URL in SAEConfigs)
- Visualization files are JSON with activation examples binned by range (0-0.25, 0.25-0.5, etc.)
- Protein structures fetched from RCSB PDB and AlphaFold DB
