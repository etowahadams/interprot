import { useContext } from "react";
import { CuratedFeature, SAE_CONFIGS } from "../SAEConfigs";
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
  SidebarHeader,
  useSidebar,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import HomeNavigator from "@/components/HomeNavigator";
import { Toggle } from "@/components/ui/toggle";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dices, Search } from "lucide-react";
import { SHOW_MODEL_SELECTOR } from "../config";
import { SAEContext } from "../SAEContext";

export default function SAESidebar() {
  const { setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const { selectedModel, setSelectedModel, selectedFeature, setSelectedFeature, SAEConfig } =
    useContext(SAEContext);

  const handleFeatureChange = (feature: number) => {
    setSelectedFeature(feature);
    setOpenMobile(false);
  };

  const groupedFeatures = SAEConfig.curated?.reduce((acc, feature) => {
    const group = feature.group || "not classified";
    if (!acc[group]) acc[group] = [];
    acc[group].push(feature);
    return acc;
  }, {} as Record<string, CuratedFeature[]>);

  return (
    <>
      <div
        className="fixed top-0 w-full bg-background border-b border-border z-50 py-4 px-8 md:hidden"
        style={{ marginLeft: -28, width: "100%" }}
      >
        <div className="flex items-center justify-between">
          <SidebarTrigger />
        </div>
      </div>
      <Sidebar>
        <SidebarHeader>
          <div className="m-3">
            <HomeNavigator />
          </div>
          {SHOW_MODEL_SELECTOR && (
            <Select value={selectedModel} onValueChange={(value) => setSelectedModel(value)}>
              <SelectTrigger className="mb-3">
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
          )}
          <div className="text-sm text-left px-3 mb-2">
            <p>
              This{" "}
              <a href="https://huggingface.co/liambai/InterProt-ESM2-SAEs" className="underline">
                SAE
              </a>{" "}
              was trained on layer {SAEConfig.plmLayer} of{" "}
              <a href="https://huggingface.co/facebook/esm2_t33_650M_UR50D" className="underline">
                ESM2-650M
              </a>{" "}
              and has {SAEConfig.numHiddenDims} hidden dimensions. Click on a feature below to
              visualize its activation pattern.
            </p>
          </div>
          <Button
            variant="outline"
            className="mb-3 mx-3"
            onClick={() => {
              handleFeatureChange(Math.floor(Math.random() * SAEConfig.numHiddenDims));
            }}
          >
            <Dices className="w-4 h-4 mr-2" /> Random Feature
          </Button>
          <Button
            variant="outline"
            className="mb-3 mx-3 whitespace-normal text-left h-auto py-2"
            onClick={() => {
              navigate(`/sae-viz/${selectedModel}`);
              setSelectedFeature(undefined);
              setOpenMobile(false);
            }}
          >
            <Search className="w-4 h-4 mr-2 shrink-0" />
            <span>Search sequence against SAE features</span>
          </Button>
          <Separator />
        </SidebarHeader>
        <SidebarContent>
          <ul className="space-y-2 font-medium">
            {groupedFeatures &&
              (Object.entries(groupedFeatures) as [string, CuratedFeature[]][]).map(
                ([group, features]) => (
                  <SidebarGroup key={group}>
                    <SidebarGroupLabel>{group}</SidebarGroupLabel>
                    {features.map((c) => (
                      <Toggle
                        key={`feature-${c.dim}`}
                        style={{ width: "100%", paddingLeft: 20, textAlign: "left" }}
                        className="justify-start"
                        pressed={selectedFeature === c.dim}
                        onPressedChange={() => handleFeatureChange(c.dim)}
                      >
                        {c.name}
                      </Toggle>
                    ))}
                  </SidebarGroup>
                )
              )}
            <SidebarGroup>
              <SidebarGroupLabel>all features</SidebarGroupLabel>
              {Array.from({ length: SAEConfig.numHiddenDims }, (_, i) => i).map((i) => (
                <Toggle
                  key={`feature-${i}`}
                  style={{ width: "100%", paddingLeft: 20 }}
                  className="justify-start"
                  pressed={selectedFeature === i}
                  onPressedChange={() => handleFeatureChange(i)}
                >
                  {i}
                </Toggle>
              ))}
            </SidebarGroup>
          </ul>
        </SidebarContent>
      </Sidebar>
    </>
  );
}
