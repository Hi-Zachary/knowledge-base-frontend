import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import DocsPage from "./pages/DocsPage";
import QAPage from "./pages/QAPage";
import AssistPage from "./pages/AssistPage";
import { DocsProvider } from "./store/DocsContext";

export default function App() {
  return (
    <DocsProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DocsPage />} />
          <Route path="/qa" element={<QAPage />} />
          <Route path="/assist" element={<AssistPage />} />
        </Route>
      </Routes>
    </DocsProvider>
  );
}
