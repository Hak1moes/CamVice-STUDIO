'use client'

import { Download, X } from 'lucide-react'

interface PDFViewerModalProps {
  dataUrl: string
  title: string
  fileName: string
  onClose: () => void
}

export default function PDFViewerModal({ dataUrl, title, fileName, onClose }: PDFViewerModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950/95">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-900 border-b border-neutral-800 shrink-0">
        <span className="text-white font-medium text-sm truncate">{title}</span>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <a
            href={dataUrl}
            download={fileName}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-neutral-900 text-xs font-medium rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </a>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PDF iframe */}
      <iframe
        src={dataUrl}
        className="flex-1 w-full border-0"
        title={title}
      />
    </div>
  )
}
