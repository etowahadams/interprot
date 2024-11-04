import "./App.css";
import { useEffect, useState, useContext } from "react";
import MolstarMulti from "./components/MolstarMulti";
import SeqViewer, { SingleSeq } from "./components/SeqViewer";
import CustomSeqPlayground from "./components/CustomSeqPlayground";
import { Navigate } from "react-router-dom";

import { SAEContext } from "./SAEContext";
import { NUM_SEQS_TO_DISPLAY } from "./config";

const SAEVisualizerPage: React.FC = () => {
  const { selectedFeature, selectedModel, SAEConfig } = useContext(SAEContext);
  const dimToCuratedMap = new Map(SAEConfig?.curated?.map((i) => [i.dim, i]) || []);

  const [featureData, setFeatureData] = useState<SingleSeq[]>([]);
  useEffect(() => {
    const fileURL = `${SAEConfig.baseUrl}${selectedFeature}.json`;
    fetch(fileURL)
      .then((response) => response.json())
      .then((data) => {
        setFeatureData(data.slice(0, NUM_SEQS_TO_DISPLAY));
      });
  }, [SAEConfig, selectedFeature]);

  if (selectedFeature === undefined) {
    return <Navigate to={`/sae-viz/${selectedModel}`} />;
  }

  return (
    <>
      <main className="text-left max-w-full overflow-x-auto">
        <h1 className="text-3xl font-semibold md:mt-0 mt-16">Feature {selectedFeature}</h1>
        {dimToCuratedMap.has(selectedFeature) && (
          <p className="mt-3">{dimToCuratedMap.get(selectedFeature)?.desc}</p>
        )}
        {SAEConfig?.supportsCustomSequence && <CustomSeqPlayground feature={selectedFeature} />}
        <div className="p-4 mt-5 border-2 border-gray-200 border-dashed rounded-lg">
          <div className="overflow-x-auto">
            {featureData.map((seq) => (
              <SeqViewer seq={seq} key={`seq-${seq.alphafold_id}`} />
            ))}
          </div>
        </div>
        <MolstarMulti proteins={featureData} />
      </main>
    </>
  );
};

export default SAEVisualizerPage;
