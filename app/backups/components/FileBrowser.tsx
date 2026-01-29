"use client";

import { useState, useEffect, useCallback } from "react";
import { DirectoryListing } from "../types";
import { Breadcrumbs } from "./Breadcrumbs";
import { FileList } from "./FileList";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

export function FileBrowser() {
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("");

  const fetchDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/backups?path=${encodeURIComponent(path)}`,
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load directory");
      }

      const data: DirectoryListing = await response.json();
      setListing(data);
      setCurrentPath(data.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setListing(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDirectory(currentPath);
  }, []);

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    fetchDirectory(path);
  };

  const handleRefresh = () => {
    fetchDirectory(currentPath);
  };

  const handleDelete = async (path: string) => {
    try {
      const response = await fetch(
        `/api/backups?path=${encodeURIComponent(path)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete");
      }

      fetchDirectory(currentPath);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  if (loading && !listing) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (error && !listing) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 py-16">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="mt-4 text-red-400">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-4 flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Breadcrumbs path={currentPath} onNavigate={handleNavigate} />
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-amber-400" />
          <p className="text-sm text-amber-400">{error}</p>
        </div>
      )}

      {listing && (
        <FileList
          items={listing.items}
          currentPath={currentPath}
          onNavigate={handleNavigate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
