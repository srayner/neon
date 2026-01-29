"use client";

import { FileItem } from "../types";
import { FileRow } from "./FileRow";
import { FolderOpen } from "lucide-react";

interface FileListProps {
  items: FileItem[];
  currentPath: string;
  onNavigate: (path: string) => void;
  onDelete: (path: string) => void;
}

export function FileList({
  items,
  currentPath,
  onNavigate,
  onDelete,
}: FileListProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 py-16">
        <FolderOpen className="h-12 w-12 text-zinc-600" />
        <p className="mt-4 text-zinc-400">This folder is empty</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="w-[40%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Name
              </th>
              <th className="w-24 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Type
              </th>
              <th className="w-24 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Size
              </th>
              <th className="w-44 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Modified
              </th>
              <th className="w-36 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {items.map((item) => (
              <FileRow
                key={item.name}
                item={item}
                currentPath={currentPath}
                onNavigate={onNavigate}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
