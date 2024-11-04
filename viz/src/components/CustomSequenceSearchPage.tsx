import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import SAESidebar from "./SAESidebar";

export default function CustomSequenceSearchPage() {
  const [sequence, setSequence] = useState("");

  return (
    <>
      <SAESidebar />
      <main className="flex items-center justify-center min-h-screen p-4 w-full">
        <div className="w-full max-w-xl">
          <h1 className="text-3xl font-semibold text-center mb-8">
            Search Sequence Against All Features
          </h1>
          <div className="space-y-4 flex flex-col items-center">
            <Input
              placeholder="Enter protein sequence..."
              value={sequence}
              onChange={(e) => setSequence(e.target.value)}
              className="w-full"
            />
            <Button className="w-full">Search</Button>
          </div>
        </div>
      </main>
    </>
  );
}
