"use client";

import { Folder, File, Download, Trash2 } from "lucide-react";
import { FileItem } from "../types";
import { FileTypeBadge } from "./FileTypeBadge";

interface FileRowProps {
  item: FileItem;
  currentPath: string;
  onNavigate: (path: string) => void;
  onDelete: (path: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "-";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);

  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FileRow({
  item,
  currentPath,
  onNavigate,
  onDelete,
}: FileRowProps) {
  const isDirectory = item.type === "directory";
  const Icon = isDirectory ? Folder : File;
  const filePath = currentPath ? `${currentPath}/${item.name}` : item.name;

  const handleClick = () => {
    if (isDirectory) {
      onNavigate(filePath);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `/api/backups/download?path=${encodeURIComponent(filePath)}`;
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const itemType = isDirectory ? "directory" : "file";
    if (
      window.confirm(
        `Are you sure you want to delete this ${itemType}?\n\n${item.name}`,
      )
    ) {
      onDelete(filePath);
    }
  };

  return (
    <tr
      onClick={handleClick}
      className={`transition-colors hover:bg-zinc-800/50 ${
        isDirectory ? "cursor-pointer" : ""
      }`}
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <Icon
            className={`h-5 w-5 flex-shrink-0 ${
              isDirectory ? "text-cyan-400" : "text-zinc-500"
            }`}
          />
          <span
            className={`text-sm font-medium truncate ${
              isDirectory ? "text-zinc-100" : "text-zinc-300"
            }`}
            title={item.name}
          >
            {item.name}
          </span>
        </div>
      </td>
      <td className="px-4 py-3.5 text-sm">
        <FileTypeBadge extension={item.extension} isDirectory={isDirectory} />
      </td>
      <td className="px-4 py-3.5 text-sm text-zinc-400">
        {formatFileSize(item.size)}
      </td>
      <td className="px-4 py-3.5 text-sm text-zinc-400">
        {formatDate(item.modifiedAt)}
      </td>
      <td className="px-4 py-3.5 text-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            className="rounded-md border border-red-700/50 bg-red-900/20 p-1.5 text-red-400 transition-colors hover:border-red-600 hover:bg-red-900/40 hover:text-red-300"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {!isDirectory && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-700 hover:text-zinc-100"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
