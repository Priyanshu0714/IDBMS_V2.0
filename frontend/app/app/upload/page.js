"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";

const STATUS = {
  IDLE: "idle",
  GETTING_URL: "getting_url",
  UPLOADING: "uploading",
  SUCCESS: "success",
  ERROR: "error",
};

export default function UploadPage() {
  const { user, loading: authLoading, isAuthenticated, authFetch } = useAuth();
  const router = useRouter();

  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(STATUS.IDLE);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setStatus(STATUS.IDLE);
      setError(null);
      setResult(null);
    }
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setStatus(STATUS.IDLE);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !isAuthenticated) return;

    try {
      // Step 1: Get presigned upload URL from authenticated API
      setStatus(STATUS.GETTING_URL);
      setProgress("Generating secure upload URL...");
      setError(null);

      const params = new URLSearchParams({
        filename: file.name,
      });

      const urlRes = await authFetch(`/api/upload-url?${params}`);
      if (!urlRes.ok) {
        const errData = await urlRes.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to get upload URL (${urlRes.status})`);
      }
      const { upload_url, key } = await urlRes.json();

      // Step 2: Upload file directly to MinIO temp bucket via presigned PUT
      setStatus(STATUS.UPLOADING);
      setProgress("Uploading file to your temporary storage...");

      const uploadRes = await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed (${uploadRes.status})`);
      }

      // Step 3: File is now in temp bucket!
      // Immediately return without blocking the user.
      setStatus(STATUS.SUCCESS);
      setProgress("");
      setResult({ key });

      // Trigger asynchronous background processing (fire-and-forget)
      const fileKey = key.split("/").slice(1).join("/");
      authFetch(`/api/process-file?filename=${encodeURIComponent(fileKey)}`, {
        method: "POST",
      }).catch((bgErr) => {
        console.warn("Background processing notification:", bgErr);
      });

    } catch (err) {
      setStatus(STATUS.ERROR);
      setError(err.message);
      setProgress("");
    }
  };

  const reset = () => {
    setFile(null);
    setStatus(STATUS.IDLE);
    setProgress("");
    setError(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const isUploading = [STATUS.GETTING_URL, STATUS.UPLOADING].includes(status);

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

        {/* upload content */}
        <div className="flex flex-col w-4/5 h-screen items-center justify-start">
          {/* header */}
          <div className="flex flex-row w-full h-14 items-center justify-between px-6 bg-amber-500 text-white shadow-sm">
            <div className="flex flex-row items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="font-semibold text-lg">UPLOAD FILE</span>
            </div>
            <div className="text-xs bg-white/20 px-3 py-1 rounded-full">
              Folder: <span className="font-semibold">{user?.username}/</span>
            </div>
          </div>

          {/* upload area */}
          <div className="flex flex-col items-center justify-center flex-1 w-full p-8">
            <div className="flex flex-col w-full max-w-xl gap-6">

              {/* Destination badge */}
              <div className="flex items-center justify-between p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                  </svg>
                  <span>Saving to your private directory: <strong className="font-semibold">{user?.username}/</strong></span>
                </div>
                <span className="bg-amber-200/60 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-medium">Isolated</span>
              </div>

              {/* drag-and-drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isUploading && inputRef.current?.click()}
                className={`flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                  dragOver
                    ? "border-amber-400 bg-amber-50"
                    : file
                    ? "border-amber-300 bg-amber-50/50"
                    : "border-zinc-300 bg-zinc-50 hover:border-amber-300 hover:bg-amber-50/30"
                } ${isUploading ? "opacity-60 pointer-events-none" : ""}`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />

                {!file ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 mb-3">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span className="text-sm text-zinc-600 font-medium">
                      Drag & drop a file here, or click to browse
                    </span>
                    <span className="text-xs text-zinc-400 mt-1">
                      Uploads move to temp storage immediately without waiting
                    </span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 mb-2">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="text-sm text-zinc-700 font-medium">{file.name}</span>
                    <span className="text-xs text-zinc-400 mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB • {file.type || "file"}
                    </span>
                    {!isUploading && (
                      <span className="text-xs text-amber-600 mt-2 font-medium">Click to select different file</span>
                    )}
                  </>
                )}
              </div>

              {/* Status / Progress */}
              {isUploading && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                  <svg className="animate-spin shrink-0" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <span>{progress}</span>
                </div>
              )}

              {status === STATUS.ERROR && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {status === STATUS.SUCCESS && (
                <div className="flex flex-col gap-3 px-4 py-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 shrink-0">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span className="font-semibold">File uploaded to temp storage! Processing in background.</span>
                  </div>
                  {result?.key && (
                    <div className="text-xs text-emerald-700 bg-emerald-100/60 p-2 rounded-lg font-mono break-all">
                      Path: {result.key}
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-1">
                    <Link
                      href="/"
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline"
                    >
                      Go to Dashboard &rarr;
                    </Link>
                    <button
                      onClick={reset}
                      className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
                    >
                      Upload another
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-row items-center gap-3">
                <button
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors shadow-sm"
                >
                  {isUploading ? (
                    <>
                      <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      Upload File
                    </>
                  )}
                </button>
                <button
                  onClick={reset}
                  disabled={isUploading}
                  className="px-4 py-2.5 rounded-lg border border-zinc-300 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-zinc-600 transition-colors"
                >
                  Reset
                </button>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
