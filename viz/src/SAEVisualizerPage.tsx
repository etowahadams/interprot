import "./App.css";
import { useEffect, useState, useContext } from "react";
import MolstarMulti from "./components/MolstarMulti";
import CustomSeqPlayground from "./components/CustomSeqPlayground";
import { Navigate } from "react-router-dom";
import proteinEmoji from "./protein.png";

import { SAEContext } from "./SAEContext";
import { NUM_SEQS_TO_DISPLAY } from "./config";
import { CONTRIBUTORS } from "./SAEConfigs";
import SeqsViewer, { SeqWithSAEActs } from "./components/SeqsViewer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const actRanges: [number, number][] = [
  [0.75, 1],
  [0.5, 0.75],
  [0.25, 0.5],
  [0, 0.25],
];

const rangeNames: string[] = actRanges.map(([start, end]) => `${start}-${end}`);

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

const fetchData = async (fileURL: string) => {
  const response = await fetch(fileURL);
  if (!response.ok) {
    throw new Error("Network response was not ok or file not found");
  }
  return response.json();
};

const processData = (data: VizFile) => {
  const processedData: { [key: string]: SeqWithSAEActs[] } = {};
  rangeNames.forEach((rangeName) => {
    if (rangeName in data.ranges) {
      processedData[rangeName] = data.ranges[rangeName as `${number}-${number}`].examples.slice(
        0,
        NUM_SEQS_TO_DISPLAY
      );
    }
  });

  const featureStats = {
    freq_active: data.freq_active,
    top_pfam: data.top_pfam,
  };

  return { rangeData: processedData, featureStats };
};

const SAEVisualizerPage: React.FC = () => {
  const { selectedFeature, selectedModel, SAEConfig } = useContext(SAEContext);
  const dimToCuratedMap = new Map(SAEConfig?.curated?.map((i) => [i.dim, i]) || []);
  const [featureStats, setFeatureStats] = useState<FeatureStats>();

  const [rangeData, setRangeData] = useState<{ [key: string]: SeqWithSAEActs[] }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDeadLatent, setIsDeadLatent] = useState(false);

  useEffect(() => {
    const fileURL = `${SAEConfig.baseUrl}${selectedFeature}.json`;

    const loadData = async () => {
      setFeatureStats(undefined);
      setIsLoading(true);
      setIsDeadLatent(false);

      try {
        const data = await fetchData(fileURL);
        const { rangeData, featureStats } = processData(data);
        setRangeData(rangeData);
        setFeatureStats(featureStats);
      } catch {
        setIsDeadLatent(true);
        setRangeData({});
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
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
      <main className="text-left max-w-full overflow-x-auto w-full">
        <div className="flex justify-between items-center mt-3 mb-3">
          <h1 className="text-3xl font-semibold md:mt-0 mt-16">Feature {selectedFeature}</h1>
          {featureStats && (
            <div>Activation frequency: {(featureStats.freq_active * 100).toFixed(2)}%</div>
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
        {isDeadLatent ? (
          <div className="mt-3">This is a dead latent. It does not activate on any sequence.</div>
        ) : (
          <>
            <div className="mt-3">{dimToCuratedMap.has(selectedFeature) && desc}</div>
            {SAEConfig?.supportsCustomSequence && (
              <CustomSeqPlayground feature={selectedFeature} saeName={selectedModel} />
            )}
            {isLoading ? (
              <div className="flex items-center justify-center w-full mt-5">
                <img
                  src={proteinEmoji}
                  alt="Loading..."
                  className="w-12 h-12 animate-wiggle mb-4"
                />
              </div>
            ) : (
              <>
                {!isLoading && (
                  <>
                    <SeqsViewer seqs={rangeData[rangeNames[0]]} title="Top activating sequences" />
                    <MolstarMulti proteins={rangeData[rangeNames[0]]} />
                    <h2 className="text-2xl font-semibold mt-6">Lower activating sequences</h2>
                    <Accordion type="multiple" className="w-full mt-6">
                      {rangeNames.slice(1).map(
                        (rangeName) =>
                          rangeData[rangeName]?.length > 0 && (
                            <AccordionItem key={rangeName} value={rangeName}>
                              <AccordionTrigger className="text-lg">
                                Top sequences in activation range {rangeName}
                              </AccordionTrigger>
                              <AccordionContent>
                                <SeqsViewer seqs={rangeData[rangeName]} />
                                <MolstarMulti proteins={rangeData[rangeName]} />
                              </AccordionContent>
                            </AccordionItem>
                          )
                      )}
                    </Accordion>
                  </>
                )}
              </>
            )}
          </>
        )}
      </main>
    </>
  );
};

export default SAEVisualizerPage;
