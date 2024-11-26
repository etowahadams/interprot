import "./App.css";
import { useEffect, useState, useContext } from "react";
import MolstarMulti from "./components/MolstarMulti";
import CustomSeqPlayground from "./components/CustomSeqPlayground";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import proteinEmoji from "./protein.png";

import { SAEContext } from "./SAEContext";
import { NUM_SEQS_TO_DISPLAY } from "./config";
import { CONTRIBUTORS } from "./SAEConfigs";
import SeqsViewer, { SeqWithSAEActs } from "./components/SeqsViewer";

const actRanges: [number, number][] = [
  [0, 0.25],
  [0.25, 0.5],
  [0.5, 0.75],
  [0.75, 1],
];

const rangeNames: string[] = actRanges.map(([start, end]) => `${start}-${end}`);

const TOP_RANGE = rangeNames[rangeNames.length - 1];
const BOTTOM_RANGE = rangeNames[0];

interface VizFile {
  ranges: {
    [key in `${number}-${number}`]: {
      examples: SeqWithSAEActs[];
    };
  };
  freq_active: number;
  n_seqs: number;
  top_pfam: string[];
  max_act: number;
}

interface FeatureStats {
  freq_active: number;
  top_pfam: string[];
}

const SAEVisualizerPage: React.FC = () => {
  const { selectedFeature, selectedModel, SAEConfig } = useContext(SAEContext);
  const dimToCuratedMap = new Map(SAEConfig?.curated?.map((i) => [i.dim, i]) || []);
  const [featureStats, setFeatureStats] = useState<FeatureStats>();

  const [topFeatureData, setTopFeatureData] = useState<SeqWithSAEActs[]>([]);
  const [bottomFeatureData, setBottomFeatureData] = useState<SeqWithSAEActs[]>([]);
  // Toggle for showing the bottom Molstar
  const [showBottomMolstar, setShowBottomMolstar] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fileURL = `${SAEConfig.baseUrl}${selectedFeature}.json`;
    // Reset the bottom Molstar visibility
    setFeatureStats(undefined);
    setShowBottomMolstar(false);
    setIsLoading(true);

    fetch(fileURL)
      .then((response) => response.json())
      .then((data: VizFile) => {
        if (TOP_RANGE in data["ranges"]) {
          const topQuarter = data["ranges"][TOP_RANGE as `${number}-${number}`];
          const examples = topQuarter["examples"];
          setTopFeatureData(examples.slice(0, NUM_SEQS_TO_DISPLAY));
          setFeatureStats({
            freq_active: data["freq_active"],
            top_pfam: data["top_pfam"],
          });
        }
        if (BOTTOM_RANGE in data["ranges"]) {
          const bottomQuarter = data["ranges"][BOTTOM_RANGE as `${number}-${number}`];
          const examples = bottomQuarter["examples"];
          setBottomFeatureData(examples.slice(0, NUM_SEQS_TO_DISPLAY));
        }
        setIsLoading(false);
      });
  }, [SAEConfig, selectedFeature]);

  if (selectedFeature === undefined) {
    return <Navigate to={`/sae-viz/${selectedModel}`} />;
  }
  let desc = <>{dimToCuratedMap.get(selectedFeature)?.desc}</>;
  const contributor = dimToCuratedMap.get(selectedFeature)?.contributor;
  if (contributor && contributor in CONTRIBUTORS) {
    desc = (
      <div className="flex flex-col gap-2">
        <p>{dimToCuratedMap.get(selectedFeature)?.desc}</p>
        <p>
          This feature was identified by{" "}
          <a
            href={CONTRIBUTORS[contributor]}
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {contributor}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      <main className="text-left max-w-full overflow-x-auto">
        <div className="flex justify-between items-center mt-3 mb-3">
          <h1 className="text-3xl font-semibold md:mt-0 mt-16">Feature {selectedFeature}</h1>
            {featureStats && (
            <div>
              Activation frequency: {(featureStats.freq_active * 100).toFixed(2)}%
            </div>
            )}
        </div>
        <div>
          {featureStats && featureStats.top_pfam.length > 0 && (
            <div>
              Highly activating Pfams:{" "}
              {featureStats.top_pfam.map((pfam) => (
                <a
                  key={pfam}
                  href={`https://www.ebi.ac.uk/interpro/entry/pfam/${pfam}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span key={pfam} className="px-2 py-1 bg-gray-200 rounded-md mx-1">
                    {pfam}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3">{dimToCuratedMap.has(selectedFeature) && desc}</div>
        {SAEConfig?.supportsCustomSequence && <CustomSeqPlayground feature={selectedFeature} />}
        {isLoading ? (
          <div className="flex items-center justify-center w-full mt-5">
            <img src={proteinEmoji} alt="Loading..." className="w-12 h-12 animate-wiggle mb-4" />
          </div>
        ) : (
          <>
            <SeqsViewer seqs={topFeatureData} title={"Top activating sequences"} />
            <MolstarMulti proteins={topFeatureData} />
            <SeqsViewer seqs={bottomFeatureData} title={"Sequences with max activation < 0.25"} />
            <Button
              onClick={() => setShowBottomMolstar(!showBottomMolstar)}
              variant="outline"
              className="mb-3 mt-3"
            >
              {showBottomMolstar ? "Hide" : "Show"} structures
            </Button>
            {showBottomMolstar && <MolstarMulti proteins={bottomFeatureData} />}
          </>
        )}
      </main>
    </>
  );
};

export default SAEVisualizerPage;
