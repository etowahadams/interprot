import "./App.css";
import { useEffect, useState, useContext } from "react";
import MolstarMulti from "./components/MolstarMulti";
import CustomSeqPlayground from "./components/CustomSeqPlayground";
import { Navigate } from "react-router-dom";
import proteinEmoji from "./protein.png";

import { SAEContext } from "./SAEContext";
import { NUM_SEQS_TO_DISPLAY } from "./config";
import { CONTRIBUTORS, STORAGE_ROOT_URL } from "./SAEConfigs";
import SeqsViewer, { SeqWithSAEActs } from "./components/SeqsViewer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Markdown from "@/components/Markdown";
import { Info } from "lucide-react";

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
  const { feature, model, SAEConfig } = useContext(SAEContext);
  const dimToCuratedMap = new Map(SAEConfig?.curated?.map((i) => [i.dim, i]) || []);
  const [featureStats, setFeatureStats] = useState<FeatureStats>();

  const [rangeData, setRangeData] = useState<{ [key: string]: SeqWithSAEActs[] }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDeadLatent, setIsDeadLatent] = useState(false);

  useEffect(() => {
    const fileURL = `${STORAGE_ROOT_URL}/${SAEConfig.storagePath}/${feature}.json`;

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
  }, [SAEConfig, feature]);

  if (feature === undefined) {
    return <Navigate to={`/sae-viz/${model}`} />;
  }
  let descStr = dimToCuratedMap.get(feature)?.desc || "";
  const contributor = dimToCuratedMap.get(feature)?.contributor;
  if (contributor && contributor in CONTRIBUTORS) {
    descStr += `\n\n This feature was identified by [${contributor}](${CONTRIBUTORS[contributor]}).`;
  }

  return (
    <>
      <main className="text-left max-w-full overflow-x-auto w-full">
        <div className="flex justify-between items-center mt-3 mb-3">
          <h1 className="text-3xl font-semibold md:mt-0 mt-16">Feature {feature}</h1>
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
          <div className="mt-3">
            <Markdown>{descStr}</Markdown>
            {SAEConfig?.supportsCustomSequence ? (
              <CustomSeqPlayground />
            ) : (
              <div className="mb-10 mt-10 p-4 border-2 border-gray-200 rounded-lg bg-gray-50 flex items-center gap-4">
                <div className="text-amber-600">
                  <Info className="h-6 w-6" />
                </div>
                <p className="text-gray-700">
                  Some of our SAEs support custom sequence inputs. This one currently does not. Try
                  a different model in the model dropdown to search and steer your own sequence.
                </p>
              </div>
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
          </div>
        )}
      </main>
    </>
  );
};

export default SAEVisualizerPage;
