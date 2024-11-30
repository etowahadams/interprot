import { createContext, useState, useEffect } from "react";
import { SAE_CONFIGS, SAEConfig } from "./SAEConfigs";
import { DEFAULT_SAE_MODEL } from "./config";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useNavigate } from "react-router-dom";
import SAESidebar from "./components/SAESidebar";

interface SAEContextType {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  selectedFeature: number | undefined;
  setSelectedFeature: (feature: number | undefined) => void;
  SAEConfig: SAEConfig;
}

export const SAEContext = createContext<SAEContextType>({
  selectedModel: DEFAULT_SAE_MODEL,
  setSelectedModel: () => {},
  SAEConfig: SAE_CONFIGS[DEFAULT_SAE_MODEL],
  selectedFeature: SAE_CONFIGS[DEFAULT_SAE_MODEL].defaultDim,
  setSelectedFeature: () => {},
});

export const SAEProvider = ({ children }: { children: React.ReactNode }) => {
  const path = window.location.hash.substring(1);

  const modelMatch = path.match(/\/(?:sae-viz\/)?([^/]+)/);
  const featureMatch = path.match(/\/(?:sae-viz\/)?[^/]+\/(\d+)/);

  const urlModel = modelMatch ? modelMatch[1] : DEFAULT_SAE_MODEL;
  const [selectedModel, setSelectedModel] = useState<string>(
    SAE_CONFIGS[urlModel] ? urlModel : DEFAULT_SAE_MODEL
  );

  const urlFeature = featureMatch ? Number(featureMatch[1]) : undefined;
  const [selectedFeature, setSelectedFeature] = useState<number | undefined>(urlFeature);

  const navigate = useNavigate();

  useEffect(() => {
    if (urlFeature !== undefined && urlFeature !== selectedFeature) {
      setSelectedFeature(urlFeature);
    }
  }, [urlFeature, selectedFeature]);

  return (
    <SAEContext.Provider
      value={{
        selectedModel: selectedModel,
        setSelectedModel: (model: string) => {
          setSelectedModel(model);
          if (selectedFeature !== undefined) {
            navigate(`/sae-viz/${model}/${selectedFeature}`);
          } else {
            navigate(`/sae-viz/${model}`);
          }
        },
        selectedFeature: selectedFeature,
        setSelectedFeature: (feature: number | undefined) => {
          setSelectedFeature(feature);
          if (feature !== undefined) {
            const seqMatch = path.match(/\?seq=([^&]+)/);
            const pdbMatch = path.match(/\?pdb=([^&]+)/);
            const seq = seqMatch ? seqMatch[1] : "";
            const pdb = pdbMatch ? pdbMatch[1] : "";
            const queryParams = [];
            if (seq) queryParams.push(`seq=${seq}`);
            if (pdb) queryParams.push(`pdb=${pdb}`);
            const queryString = queryParams.length ? `?${queryParams.join("&")}` : "";
            navigate(`/sae-viz/${selectedModel}/${feature}${queryString}`);
          }
        },
        SAEConfig: SAE_CONFIGS[selectedModel],
      }}
    >
      <SidebarProvider>
        <SAESidebar />
        {children}
      </SidebarProvider>
    </SAEContext.Provider>
  );
};
