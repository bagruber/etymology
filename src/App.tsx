import { useMemo } from "react";
import { Route, Routes } from "react-router-dom";
import { dataset } from "./data/dataset.ts";
import { buildIndex } from "./graph/graph.ts";
import HomePage from "./pages/HomePage.tsx";
import WordPage from "./pages/WordPage.tsx";

export default function App() {
  // The graph index is derived once from the static dataset.
  const index = useMemo(() => buildIndex(dataset), []);
  return (
    <Routes>
      <Route path="/" element={<HomePage nodes={dataset.nodes} />} />
      <Route path="/word/:id" element={<WordPage index={index} nodes={dataset.nodes} />} />
    </Routes>
  );
}
