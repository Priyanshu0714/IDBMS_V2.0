"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";

function getDisplayName(key) {
  if (!key) return "Unknown";
  const parts = key.split("/");
  const filename = parts[parts.length - 1];
  const match = filename.match(/^\d+_(.+)$/);
  return match ? match[1] : filename;
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function QueryPage() {
  const { user, loading: authLoading, isAuthenticated, authFetch } = useAuth();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [extracted, setExtracted] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const handleSearch = async (searchQuery) => {
    const q = searchQuery !== undefined ? searchQuery : query;
    if (!q.trim() || !isAuthenticated) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await authFetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Query failed with status ${res.status}`);
      }

      const data = await res.json();
      setResults(data.files || []);
      setExtracted(data.extracted || null);
    } catch (err) {
      setError(err.message);
      setResults([]);
      setExtracted(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (key) => {
    try {
      const res = await authFetch(`/api/download-url?key=${encodeURIComponent(key)}&bucket=userbucket`);
      if (!res.ok) {
        // try tempbucket if not in userbucket
        const fallbackRes = await authFetch(`/api/download-url?key=${encodeURIComponent(key)}&bucket=tempbucket`);
        if (!fallbackRes.ok) throw new Error("Could not generate download link");
        const data = await fallbackRes.json();
        window.open(data.download_url, "_blank");
        return;
      }
      const data = await res.json();
      window.open(data.download_url, "_blank");
    } catch (err) {
      alert("Download error: " + err.message);
    }
  };

  const sampleQueries = [
    "I want the list of all files containing Rekhi Foundation",
    "Find files with financial revenue and profit",
    "Show me documents related to architecture and system design",
  ];

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-50">
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <svg className="animate-spin h-5 w-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans">
      <main className="flex flex-1 w-full flex-row items-center justify-between bg-white sm:items-start text-black">
        <Sidebar />

        <div className="flex flex-col w-4/5 h-screen items-center justify-start">
          <div className="flex flex-row w-full h-14 items-center justify-between px-6 bg-amber-500 text-white shadow-sm">
            <div className="flex flex-row items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="font-semibold text-lg">AI DOCUMENT QUERY</span>
            </div>
            <div className="text-xs bg-white/20 px-3 py-1 rounded-full">
              User: <span className="font-semibold">{user?.username}</span>
            </div>
          </div>

          <div className="flex flex-col w-full flex-1 overflow-y-auto p-8">
            <div className="flex flex-col w-full max-w-4xl mx-auto gap-6">

              {/* search input bar */}
              <div className="flex flex-col gap-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSearch();
                  }}
                  className="flex gap-2"
                >
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="e.g. I want the list of all files containing Rekhi Foundation"
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-zinc-900 transition"
                      disabled={loading}
                    />
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="absolute left-3.5 top-3.5 text-zinc-400"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !query.trim()}
                    className="px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white font-medium rounded-xl text-sm transition-all shadow-sm flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        <span>Ask AI</span>
                      </>
                    )}
                  </button>
                </form>

                {/* sample query chips */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className="text-zinc-400">Try asking:</span>
                  {sampleQueries.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setQuery(sample);
                        handleSearch(sample);
                      }}
                      className="px-2.5 py-1 bg-zinc-100 hover:bg-amber-50 hover:text-amber-800 rounded-lg transition-colors border border-zinc-200"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              {/* ai extracted intent badges */}
              {extracted && (extracted.company || extracted.title || extracted.date || (extracted.people && extracted.people.length > 0)) && (
                <div className="flex flex-wrap items-center gap-2 p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900">
                  <span className="font-semibold flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                    </svg>
                    AI Filter Matched:
                  </span>
                  {extracted.company && extracted.company !== "null" && (
                    <span className="bg-amber-200/70 px-2 py-0.5 rounded-md font-medium">
                      Company: {extracted.company}
                    </span>
                  )}
                  {extracted.title && extracted.title !== "null" && (
                    <span className="bg-amber-200/70 px-2 py-0.5 rounded-md font-medium">
                      Title: {extracted.title}
                    </span>
                  )}
                  {extracted.date && extracted.date !== "null" && (
                    <span className="bg-amber-200/70 px-2 py-0.5 rounded-md font-medium">
                      Date: {extracted.date}
                    </span>
                  )}
                  {extracted.people && extracted.people.map((p, i) => (
                    <span key={i} className="bg-amber-200/70 px-2 py-0.5 rounded-md font-medium">
                      Person: {p}
                    </span>
                  ))}
                </div>
              )}

              {/* error message */}
              {error && (
                <div className="flex items-center gap-2 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* results list */}
              {searched && !loading && (
                <div className="flex flex-col gap-4 mt-2">
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                    <h2 className="text-sm font-semibold text-zinc-800">
                      Results ({results.length})
                    </h2>
                    {results.length > 0 && (
                      <span className="text-xs text-zinc-500">
                        Click a file to download
                      </span>
                    )}
                  </div>

                  {results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl text-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 mb-1">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <span className="text-sm font-medium text-zinc-700">No matching documents found</span>
                      <span className="text-xs text-zinc-400 max-w-sm">
                        Try modifying your query or verifying that the document has finished AI header processing.
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {results.map((file, idx) => {
                        const filename = file.name || file.filename || "";
                        const displayName = getDisplayName(filename);
                        const ai = file.aiData || {};

                        return (
                          <div
                            key={file._id || idx}
                            onClick={() => handleDownload(filename)}
                            className="flex items-start justify-between p-4 bg-white border border-zinc-200 hover:border-amber-400 hover:shadow-sm rounded-xl cursor-pointer transition"
                          >
                            <div className="flex items-start gap-3.5">
                              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                              </div>

                              <div className="flex flex-col gap-1 min-w-0">
                                <span className="text-sm font-semibold text-zinc-900 truncate">
                                  {displayName}
                                </span>
                                <span className="text-xs text-zinc-400 truncate">
                                  {filename}
                                </span>

                                {/* AI metadata preview */}
                                {(ai.company || ai.title || ai.date || (ai.people && ai.people.length > 0)) && (
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {ai.company && (
                                      <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 text-[10px] font-medium rounded-md">
                                        Company: {ai.company}
                                      </span>
                                    )}
                                    {ai.title && (
                                      <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 text-[10px] font-medium rounded-md">
                                        Title: {ai.title}
                                      </span>
                                    )}
                                    {ai.date && (
                                      <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 text-[10px] font-medium rounded-md">
                                        Date: {ai.date}
                                      </span>
                                    )}
                                    {ai.people && ai.people.map((p, pIdx) => (
                                      <span key={pIdx} className="px-2 py-0.5 bg-zinc-100 text-zinc-700 text-[10px] font-medium rounded-md">
                                        {p}
                                      </span>
                                    ))}
                                    {ai.financials && ai.financials.revenue && (
                                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded-md">
                                        Rev: {ai.financials.revenue}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col items-end shrink-0 gap-1 pl-4">
                              <span className="text-xs text-zinc-400 font-mono">
                                {formatSize(file.size)}
                              </span>
                              <span className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                                Download &darr;
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
