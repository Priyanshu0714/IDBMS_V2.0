"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./components/Sidebar";
import { useAuth } from "./context/AuthContext";

// Helper to get a display-friendly name from the object key
function getDisplayName(key) {
  if (!key) return "Unknown";
  const parts = key.split("/");
  const filename = parts[parts.length - 1];
  // Strip the unix timestamp prefix (e.g. "1234567890_Report.pdf" -> "Report.pdf")
  const match = filename.match(/^\d+_(.+)$/);
  return match ? match[1] : filename;
}

// Helper to guess file type from key
function getFileType(key) {
  const ext = key.split(".").pop().toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"].includes(ext)) return "img";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (["xls", "xlsx", "csv"].includes(ext)) return "xls";
  if (["ppt", "pptx"].includes(ext)) return "ppt";
  return "other";
}

// Helper to format file size
function formatSize(bytes) {
  if (!bytes || bytes === 0) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

const FileIcon = ({ type }) => {
  if (type === "pdf")
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <text x="8" y="16" fontSize="5" fill="currentColor" stroke="none" fontWeight="bold">PDF</text>
      </svg>
    );
  if (type === "img")
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    );
  if (type === "doc")
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    );
  if (type === "xls")
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <rect x="8" y="12" width="8" height="6" rx="1" />
        <line x1="12" y1="12" x2="12" y2="18" />
        <line x1="8" y1="15" x2="16" y2="15" />
      </svg>
    );
  if (type === "ppt")
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h20v14H2z" />
        <line x1="12" y1="17" x2="12" y2="21" />
        <line x1="8" y1="21" x2="16" y2="21" />
      </svg>
    );
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
};

const iconBg = {
  pdf: "bg-red-50 text-red-500",
  img: "bg-blue-50 text-blue-500",
  doc: "bg-indigo-50 text-indigo-500",
  xls: "bg-emerald-50 text-emerald-600",
  ppt: "bg-orange-50 text-orange-500",
  other: "bg-zinc-100 text-zinc-500",
};

export default function DashboardPage() {
  const { user, loading: authLoading, isAuthenticated, authFetch } = useAuth();
  const router = useRouter();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bucket, setBucket] = useState("tempbucket");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchFiles = async (selectedBucket) => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/files?bucket=${selectedBucket}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      setError(err.message);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchFiles(bucket);
    }
  }, [bucket, isAuthenticated]);

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

        {/* dashboard */}
        <div className="flex flex-col w-4/5 h-screen items-center justify-start">
          {/* dashboard header */}
          <div className="flex flex-row w-full h-14 items-center justify-between px-6 bg-amber-500 text-white shadow-sm">
            <div className="flex flex-row items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
              <span className="font-semibold text-lg">DASHBOARD</span>
              <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full ml-2">
                /{user?.username}
              </span>
            </div>
            <div className="flex flex-row items-center gap-3">
              <button
                onClick={() => fetchFiles(bucket)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-medium transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Refresh
              </button>
            </div>
          </div>

          {/* bucket toggle */}
          <div className="flex flex-row w-full items-center justify-between px-6 pt-5 pb-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-500">Storage View:</span>
              <div className="flex flex-row bg-zinc-100 rounded-lg p-0.5">
                <button
                  onClick={() => setBucket("tempbucket")}
                  className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                    bucket === "tempbucket"
                      ? "bg-white shadow text-amber-700"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  Temp Bucket (Uploads)
                </button>
                <button
                  onClick={() => setBucket("userbucket")}
                  className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                    bucket === "userbucket"
                      ? "bg-white shadow text-amber-700"
                      : "text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  Main Bucket (Processed)
                </button>
              </div>
            </div>

            <div className="text-xs text-zinc-400">
              Only showing files belonging to <span className="font-semibold text-zinc-600">{user?.username}</span>
            </div>
          </div>

          {/* main content - file grid */}
          <div className="flex flex-col w-full flex-1 overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-zinc-800 mb-4">
              Your Files
              {!loading && (
                <span className="text-sm font-normal text-zinc-400 ml-2">
                  ({files.length} file{files.length !== 1 ? "s" : ""})
                </span>
              )}
            </h2>

            {loading && (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-zinc-400 py-20">
                <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span className="text-sm">Loading your files...</span>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 py-12">
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
                <button
                  onClick={() => fetchFiles(bucket)}
                  className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                >
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && files.length === 0 && (
              <div className="flex flex-col items-center justify-center flex-1 gap-2 text-zinc-400 py-24 border border-dashed border-zinc-200 rounded-2xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="text-sm font-medium">No files found in your folder</span>
                <span className="text-xs text-zinc-400">Upload a file to get started</span>
              </div>
            )}

            {!loading && !error && files.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {files.map((file, index) => {
                  const type = getFileType(file.key);
                  const name = getDisplayName(file.key);
                  return (
                    <div
                      key={file.key || index}
                      className="group relative flex flex-col items-center justify-center p-4 rounded-xl border border-zinc-200 hover:border-amber-300 hover:shadow-md bg-white cursor-pointer transition-all gap-3"
                      title={`${file.key}\nSize: ${formatSize(file.size)}\nModified: ${file.last_modified ? new Date(file.last_modified).toLocaleString() : "—"}`}
                    >
                      <div className={`flex items-center justify-center w-14 h-14 rounded-lg ${iconBg[type]}`}>
                        <FileIcon type={type} />
                      </div>
                      <span className="text-xs text-zinc-600 text-center truncate w-full font-medium">
                        {name}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {formatSize(file.size)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
