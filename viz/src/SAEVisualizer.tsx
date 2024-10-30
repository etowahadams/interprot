import { useEffect, useState } from "react";
// import MolstarViewer from "./components/MolstarViewer";
import MolstarMulti from './components/MolstarMulti';
import SeqViewer, { SingleSeq } from "./components/SeqViewer";
import CustomSeqPlayground from "./components/CustomSeqPlayground";
import { SAE_CONFIGS } from "./SAEConfigs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarProvider,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";

import "./App.css";
import { Toggle } from "./components/ui/toggle";

const NUM_SEQS_TO_DISPLAY = 9;

function SAEVisualizer() {
  const navigate = useNavigate();
  const [selectedModel, setSelectedModel] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("model") || "SAE4096-L24";
  });
  const config = SAE_CONFIGS[selectedModel];
  const dimToCuratedMap = new Map(config.curated?.map((i) => [i.dim, i]));

  const [feature, setFeature] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return parseInt(params.get("feature") || config.defaultDim.toString(), 10);
  });

  useEffect(() => {
    const updateUrl = () => {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("model", selectedModel);
      newUrl.searchParams.set("feature", feature.toString());
      window.history.pushState({}, "", newUrl);
    };
    updateUrl();
  }, [config, feature, selectedModel]);

  const [featureData, setFeatureData] = useState<SingleSeq[]>([]);

  useEffect(() => {
    const fileURL = `${config.baseUrl}${feature}.json`;
    fetch(fileURL)
      .then((response) => response.json())
      .then((data) => {
        setFeatureData(data.slice(0, NUM_SEQS_TO_DISPLAY));
      });
  }, [config, feature]);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div style={{ cursor: "pointer", padding: 10 }} onClick={() => navigate("/")}>
            <h2 className="text-xl font-semibold">InterProt</h2>
          </div>
          <Select value={selectedModel} onValueChange={(value) => setSelectedModel(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select SAE Model" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(SAE_CONFIGS).map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm mt-2 text-left" style={{ paddingLeft: 10, paddingRight: 10 }}>
            <p>
              This SAE was trained on layer {config.plmLayer} of{" "}
              <a href="https://huggingface.co/facebook/esm2_t33_650M_UR50D" className="underline">
                ESM2-650M
              </a>{" "}
              and has {config.numHiddenDims} hidden dimensions. Click on a feature below to
              visualize its activation pattern.
            </p>
          </div>
          <Separator />
        </SidebarHeader>
        <SidebarContent>
          <ul className="space-y-2 font-medium">
            {config.curated?.map((i) => (
              <Toggle
                key={`feature-${i.dim}`}
                style={{ width: "100%", paddingLeft: 20, textAlign: "left" }}
                className="justify-start"
                pressed={feature === i.dim}
                onPressedChange={() => setFeature(i.dim)}
              >
                {i.name}
              </Toggle>
            ))}
            {Array.from({ length: config.numHiddenDims }, (_, i) => i).map((i) => (
              <Toggle
                key={`feature-${i}`}
                style={{ width: "100%", paddingLeft: 20 }}
                className="justify-start"
                pressed={feature === i}
                onPressedChange={() => setFeature(i)}
              >
                {i}
              </Toggle>
            ))}
          </ul>
        </SidebarContent>
      </Sidebar>
      <main className="text-left max-w-full overflow-x-auto">
        <div className="flex items-center justify-between p-4">
          <SidebarTrigger className="md:hidden" />
          <h1 className="text-3xl font-bold">Feature {feature}</h1>
        </div>
        {dimToCuratedMap.has(feature) && <p>{dimToCuratedMap.get(feature)?.desc}</p>}
        {config?.supportsCustomSequence && <CustomSeqPlayground feature={feature} />}
        <div className="p-4 mt-5 border-2 border-gray-200 border-dashed rounded-lg">
          <div className="overflow-x-auto">
            {featureData.map((seq) => (
              <SeqViewer seq={seq} key={`seq-${seq.alphafold_id}`} />
            ))}
          </div>
        </div>

        <MolstarMulti proteins={featureData} />
      </main>
    </SidebarProvider>
  );
}

export default SAEVisualizer;
