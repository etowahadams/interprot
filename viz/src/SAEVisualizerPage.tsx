import "./App.css";
import { useEffect, useState, useContext } from "react";
import MolstarMulti from "./components/MolstarMulti";
import CustomSeqPlayground from "./components/CustomSeqPlayground";
import { Navigate } from "react-router-dom";

import { SAEContext } from "./SAEContext";
import { NUM_SEQS_TO_DISPLAY } from "./config";
import { CONTRIBUTORS } from "./SAEConfigs";
import SeqsViewer, { SeqWithSAEActs } from "./components/SeqsViewer";
import { tokensToSequence } from "./utils";

const SAEVisualizerPage: React.FC = () => {
  const { selectedFeature, selectedModel, SAEConfig } = useContext(SAEContext);
  const dimToCuratedMap = new Map(SAEConfig?.curated?.map((i) => [i.dim, i]) || []);

  const [featureData, setFeatureData] = useState<SeqWithSAEActs[]>([]);
  useEffect(() => {
    const fileURL = `${SAEConfig.baseUrl}${selectedFeature}.json`;
    fetch(fileURL)
      .then((response) => response.json())
      .then((data) => {
        // NOTE(liam): important data transformation
        setFeatureData(
          data
            .slice(0, NUM_SEQS_TO_DISPLAY)
            .map(
              (seq: {
                tokens_acts_list: number[];
                tokens_list: number[];
                alphafold_id: string;
              }) => ({
                sae_acts: seq.tokens_acts_list,
                sequence: tokensToSequence(seq.tokens_list),
                alphafold_id: seq.alphafold_id,
              })
            )
        );
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
        {dimToCuratedMap.has(selectedFeature) && <div className="mt-3">{desc}</div>}
        {SAEConfig?.supportsCustomSequence && <CustomSeqPlayground feature={selectedFeature} />}
        <SeqsViewer seqs={featureData} />
        <MolstarMulti proteins={featureData} />
      </main>
    </>
  );
};

export default SAEVisualizerPage;
