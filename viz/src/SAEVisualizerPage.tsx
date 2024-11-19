import "./App.css";
import { useEffect, useState, useContext } from "react";
import MolstarMulti from "./components/MolstarMulti";
import CustomSeqPlayground from "./components/CustomSeqPlayground";
import { Navigate } from "react-router-dom";

import { SAEContext } from "./SAEContext";
import { NUM_SEQS_TO_DISPLAY } from "./config";
import { CONTRIBUTORS } from "./SAEConfigs";
import SeqsViewer, { SeqWithSAEActs } from "./components/SeqsViewer";

interface VizFile {
  quartiles: {
    Q4?: {
      examples: SeqWithSAEActs[];
      interpro: {
        interpro_ids: string[];
        freq: number[];
      };
    };
  };
  freq_activate_among_all_seqs: number;
}

interface FeatureStats {
  activation_frequency: number;
  top_families: { id: string; freq: number }[];
}

const SAEVisualizerPage: React.FC = () => {
  const { selectedFeature, selectedModel, SAEConfig } = useContext(SAEContext);
  const dimToCuratedMap = new Map(SAEConfig?.curated?.map((i) => [i.dim, i]) || []);
  const [featureStats, setFeatureStats] = useState<FeatureStats>();

  const [featureData, setFeatureData] = useState<SeqWithSAEActs[]>([]);
  useEffect(() => {
    const fileURL = `${SAEConfig.baseUrl}${selectedFeature}.json`;
    fetch(fileURL)
      .then((response) => response.json())
      .then((data: VizFile) => {
        console.warn(data);
        if ("Q4" in data["quartiles"]) {
          const Q4 = data["quartiles"]["Q4"]!;
          const examples = Q4["examples"];
          setFeatureData(examples.slice(0, NUM_SEQS_TO_DISPLAY));
          setFeatureStats({
            activation_frequency: data["freq_activate_among_all_seqs"],
            top_families: Q4["interpro"]["interpro_ids"].map((id, i) => ({
              id,
              freq: Q4["interpro"]["freq"][i],
            })),
          });
        }
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
        <h1 className="text-3xl font-semibold md:mt-0 mt-16">Feature {selectedFeature}</h1>
        <div className="mt-3">
          Activation frequency: {featureStats?.activation_frequency.toFixed(2)} <br />
          Top InterPro families:{" "}
          {featureStats?.top_families.slice(5).map((f) => `${f.id} (${f.freq.toFixed(2)})`).join(", ")}
        </div>
        {dimToCuratedMap.has(selectedFeature) && <div className="mt-3">{desc}</div>}
        {SAEConfig?.supportsCustomSequence && <CustomSeqPlayground feature={selectedFeature} />}
        <SeqsViewer seqs={featureData} />
        <MolstarMulti proteins={featureData} />
      </main>
    </>
  );
};

export default SAEVisualizerPage;
