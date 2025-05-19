import React, { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import Navbar from "./Navbar";
import { SAE_CONFIGS } from "../SAEConfigs";
import MolstarMulti from "./MolstarMulti";
import SeqsViewer, { SeqWithSAEActs } from "./SeqsViewer";
import { STORAGE_ROOT_URL } from "../SAEConfigs";
import proteinEmoji from "../protein.png";
import { Download } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";

const MODEL1 = "SAE4096-L24";
const MODEL2 = "ESM-L24";
const FEATURES_PER_MODEL = 100;

// Define activation ranges
const actRanges: [number, number][] = [
  [0.75, 1],
  [0.5, 0.75],
  [0.25, 0.5],
  [0, 0.25],
];

const rangeNames: string[] = actRanges.map(([start, end]) => `${start}-${end}`);

// Check if the models exist in the configs
const model1Exists = !!SAE_CONFIGS[MODEL1];
const model2Exists = !!SAE_CONFIGS[MODEL2];

interface FeatureWithModel {
  name: string;
  dim: number;
  desc: string;
  modelName: string;
  id: string;
}

interface RatingEntry {
  model: string;
  dim: number;
  rating: number;
}

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

// Helper function to get random dimensions for a model
const getRandomDimensions = (modelName: string, count: number): number[] => {
  const numDims = SAE_CONFIGS[modelName]?.numHiddenDims || 0;
  if (numDims === 0) return [];

  // Create an array of all possible dimensions
  const allDims = Array.from({ length: numDims }, (_, i) => i);

  // Shuffle and take the first 'count' elements
  return allDims.sort(() => Math.random() - 0.5).slice(0, Math.min(count, numDims));
};

const BlindRatingsPage: React.FC = () => {
  const [currentFeature, setCurrentFeature] = useState<FeatureWithModel | null>(null);
  const [ratings, setRatings] = useState<Record<string, RatingEntry>>({});
  const [rangeData, setRangeData] = useState<{ [key: string]: SeqWithSAEActs[] }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDeadLatent, setIsDeadLatent] = useState(false);
  const [totalRated, setTotalRated] = useState(0);
  const [selectedDimensions, setSelectedDimensions] = useState<{
    [model: string]: number[];
  }>({});
  const [remainingFeatures, setRemainingFeatures] = useState<FeatureWithModel[]>([]);

  // Initialize the random dimensions for each model
  useEffect(() => {
    if (model1Exists || model2Exists) {
      const model1Dims = model1Exists ? getRandomDimensions(MODEL1, FEATURES_PER_MODEL) : [];
      const model2Dims = model2Exists ? getRandomDimensions(MODEL2, FEATURES_PER_MODEL) : [];

      setSelectedDimensions({
        [MODEL1]: model1Dims,
        [MODEL2]: model2Dims,
      });

      // Create the list of features to rate
      const featuresToRate: FeatureWithModel[] = [
        ...model1Dims.map((dim) => ({
          name: `Feature ${dim}`,
          dim,
          desc: "",
          modelName: MODEL1,
          id: `${MODEL1}-${dim}`,
        })),
        ...model2Dims.map((dim) => ({
          name: `Feature ${dim}`,
          dim,
          desc: "",
          modelName: MODEL2,
          id: `${MODEL2}-${dim}`,
        })),
      ];

      setRemainingFeatures(featuresToRate);
    }
  }, []);

  // Load previous ratings from localStorage
  useEffect(() => {
    const savedRatings = localStorage.getItem("interpretability-ratings");
    if (savedRatings) {
      const parsedRatings = JSON.parse(savedRatings);
      setRatings(parsedRatings);
      setTotalRated(Object.keys(parsedRatings).length);

      // Filter out already rated features
      if (remainingFeatures.length > 0) {
        setRemainingFeatures((prev) => prev.filter((feature) => !parsedRatings[feature.id]));
      }
    }
  }, [remainingFeatures.length]);

  // Save ratings to localStorage
  useEffect(() => {
    if (Object.keys(ratings).length > 0) {
      localStorage.setItem("interpretability-ratings", JSON.stringify(ratings));
      setTotalRated(Object.keys(ratings).length);
    }
  }, [ratings]);

  // Choose the next feature if none is selected
  useEffect(() => {
    if (!currentFeature && remainingFeatures.length > 0) {
      selectNextFeature();
    }
  }, [currentFeature, remainingFeatures]);

  // Fetch visualization data for the current feature
  useEffect(() => {
    if (!currentFeature) {
      setRangeData({});
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setIsDeadLatent(false);

      try {
        const modelConfig = SAE_CONFIGS[currentFeature.modelName];
        const fileURL = `${STORAGE_ROOT_URL}/${modelConfig.storagePath}/${currentFeature.dim}.json`;

        const response = await fetch(fileURL);
        if (!response.ok) {
          throw new Error("Network response was not ok or file not found");
        }

        const data: VizFile = await response.json();

        // Process the visualization data
        const processedData: { [key: string]: SeqWithSAEActs[] } = {};
        rangeNames.forEach((rangeName) => {
          if (rangeName in data.ranges) {
            processedData[rangeName] = data.ranges[rangeName as `${number}-${number}`].examples;
          }
        });

        setRangeData(processedData);
      } catch (error) {
        console.error("Error fetching visualization data:", error);
        setIsDeadLatent(true);
        setRangeData({});
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentFeature]);

  const selectNextFeature = () => {
    if (remainingFeatures.length === 0) {
      setCurrentFeature(null);
      return;
    }

    // Get a random feature from the remaining ones
    const randomIndex = Math.floor(Math.random() * remainingFeatures.length);
    const nextFeature = remainingFeatures[randomIndex];

    // Remove this feature from the remaining list
    setRemainingFeatures((prev) => prev.filter((_, index) => index !== randomIndex));

    setCurrentFeature(nextFeature);
  };

  const handleRating = (rating: number) => {
    if (!currentFeature) return;

    // Save the rating
    setRatings((prev) => ({
      ...prev,
      [currentFeature.id]: {
        model: currentFeature.modelName,
        dim: currentFeature.dim,
        rating,
      },
    }));

    // Move to the next feature
    setCurrentFeature(null);
  };

  const getTotalRatedCount = () => {
    return totalRated;
  };

  const getTotalFeaturesCount = () => {
    // Return the total number of features to be rated
    const model1Count = selectedDimensions[MODEL1]?.length || 0;
    const model2Count = selectedDimensions[MODEL2]?.length || 0;
    return model1Count + model2Count;
  };

  const downloadRatings = () => {
    if (Object.keys(ratings).length === 0) return;

    // Create CSV content with headers
    const headers = ["Model", "Feature", "Rating"];
    const csvRows = [headers.join(",")];

    // Add data rows
    for (const featureId in ratings) {
      const ratingEntry = ratings[featureId];
      csvRows.push(`${ratingEntry.model},${ratingEntry.dim},${ratingEntry.rating}`);
    }

    // Create blob and download
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "feature_ratings.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetRatings = () => {
    localStorage.removeItem("interpretability-ratings");
    setRatings({});
    setTotalRated(0);

    // Recreate the full list of features to rate
    if (Object.keys(selectedDimensions).length > 0) {
      const featuresToRate: FeatureWithModel[] = [
        ...(selectedDimensions[MODEL1] || []).map((dim) => ({
          name: `Feature ${dim}`,
          dim,
          desc: "",
          modelName: MODEL1,
          id: `${MODEL1}-${dim}`,
        })),
        ...(selectedDimensions[MODEL2] || []).map((dim) => ({
          name: `Feature ${dim}`,
          dim,
          desc: "",
          modelName: MODEL2,
          id: `${MODEL2}-${dim}`,
        })),
      ];
      setRemainingFeatures(featuresToRate);
    }

    // Reset current feature
    setCurrentFeature(null);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Feature Interpretability Ratings</h1>
          <div className="flex gap-2">
            <Button onClick={downloadRatings} variant="outline" className="flex items-center gap-1">
              <Download className="h-4 w-4" />
              Download ratings
            </Button>
            <Button onClick={resetRatings} variant="outline">
              Clear all ratings
            </Button>
          </div>
        </div>

        {!model1Exists || !model2Exists ? (
          <Card className="p-6 mb-6 text-center">
            <h2 className="text-xl font-semibold mb-3">Model Configuration Error</h2>
            <p className="mb-4">
              {!model1Exists && `Model "${MODEL1}" is not configured properly. `}
              {!model2Exists && `Model "${MODEL2}" is not configured properly. `}
              Please check the model configuration.
            </p>
          </Card>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-left mb-2">
                Here are latents from {MODEL1} and {MODEL2} ({FEATURES_PER_MODEL} from each).
              </p>
              <p className="text-left">
                Progress: {getTotalRatedCount()} / {getTotalFeaturesCount()}
              </p>
            </div>

            {currentFeature ? (
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Main content area with width constraints */}
                <Card className="p-6 mb-6 flex-grow w-full lg:max-w-[calc(100%-20rem)] overflow-hidden">
                  {isLoading ? (
                    <div className="flex items-center justify-center w-full mt-5 mb-5">
                      <img
                        src={proteinEmoji}
                        alt="Loading..."
                        className="w-12 h-12 animate-wiggle mb-4"
                      />
                    </div>
                  ) : isDeadLatent ? (
                    <div className="mt-3 mb-5">
                      This is a dead latent. It does not activate on any sequence.
                    </div>
                  ) : (
                    <div className="mb-6 overflow-x-auto">
                      {/* Display protein visualization data */}
                      {rangeData[rangeNames[0]] && rangeData[rangeNames[0]].length > 0 && (
                        <>
                          <div className="max-w-full">
                            <SeqsViewer
                              seqs={rangeData[rangeNames[0]]}
                              title="Top activating sequences"
                            />
                          </div>
                          <MolstarMulti proteins={rangeData[rangeNames[0]]} />

                          <h2 className="text-2xl font-semibold mt-6">
                            Lower activating sequences
                          </h2>
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
                    </div>
                  )}
                </Card>
                {/* Sidebar with rating buttons */}
                <Card className="p-6 mb-6 w-full lg:w-80 h-fit sticky top-24">
                  <p className="mb-4 font-medium">How interpretable is this feature?</p>
                  <div className="flex flex-col gap-3">
                    <Button onClick={() => handleRating(0)} variant="outline" className="w-full">
                      Not Interpretable (0)
                    </Button>
                    <Button onClick={() => handleRating(1)} variant="outline" className="w-full">
                      Unsure (1)
                    </Button>
                    <Button onClick={() => handleRating(2)} variant="outline" className="w-full">
                      Interpretable (2)
                    </Button>
                  </div>
                </Card>
              </div>
            ) : remainingFeatures.length > 0 ? (
              <Card className="p-6 mb-6 text-center">
                <h2 className="text-xl font-semibold mb-3">Ready to rate features?</h2>
                <Button onClick={selectNextFeature}>Start Rating</Button>
              </Card>
            ) : (
              <Card className="p-6 mb-6 text-center">
                <h2 className="text-xl font-semibold mb-3">All features have been rated!</h2>
                <p className="mb-4">
                  You've rated all {getTotalFeaturesCount()} features. You can download your ratings
                  or clear them to start over.
                </p>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default BlindRatingsPage;
