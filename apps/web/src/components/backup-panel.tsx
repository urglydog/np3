'use client';

import { useRef, useState, useCallback } from 'react';
import { Download, Upload, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { exportPlanAction, importPlanAction } from '@/app/(app)/settings/actions';

type Status = 'idle' | 'loading' | 'ok' | 'error';

export function BackupPanel() {
  const [exportStatus, setExportStatus] = useState<Status>('idle');
  const [importStatus, setImportStatus] = useState<Status>('idle');
  const [importMsg, setImportMsg] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingJson, setPendingJson] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    setExportStatus('loading');
    const result = await exportPlanAction();
    if (!result.ok) {
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 3000);
      return;
    }
    // Tạo file tải về trong trình duyệt (không cần server)
    const today = new Date().toISOString().slice(0, 10);
    const blob = new Blob([result.json ?? ''], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roadmap-backup-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportStatus('ok');
    setTimeout(() => setExportStatus('idle'), 3000);
  }, []);

  // ── Import — bước 1: đọc file ──────────────────────────────────────────────
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Reset input để có thể chọn lại cùng file
      e.target.value = '';

      const text = await file.text();
      setPendingJson(text);
      setShowConfirm(true);
      setImportMsg('');
      setImportStatus('idle');
    },
    []
  );

  // ── Import — bước 2: xác nhận ──────────────────────────────────────────────
  const handleConfirmImport = useCallback(async () => {
    if (!pendingJson) return;
    setShowConfirm(false);
    setImportStatus('loading');
    const result = await importPlanAction(pendingJson);
    setPendingJson(null);
    if (result.ok) {
      setImportStatus('ok');
      setImportMsg('Khôi phục thành công! Tải lại trang để thấy dữ liệu mới.');
    } else {
      setImportStatus('error');
      setImportMsg(result.error);
    }
  }, [pendingJson]);

  const handleCancelImport = useCallback(() => {
    setShowConfirm(false);
    setPendingJson(null);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Hộp thoại xác nhận Import */}
      {showConfirm && (
        <div
          role="alertdialog"
          aria-labelledby="import-confirm-title"
          className="flex flex-col gap-3 rounded-md border border-red-500/40 bg-red-500/5 p-4"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />
            <div>
              <p id="import-confirm-title" className="text-sm font-medium text-ink">
                Xác nhận khôi phục
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Việc này sẽ{' '}
                <strong className="text-red-500">xóa toàn bộ tiến độ hiện tại</strong> và thay bằng dữ liệu
                trong file. Không thể hoàn tác.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              id="import-confirm-btn"
              onClick={handleConfirmImport}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white"
            >
              Xác nhận khôi phục
            </button>
            <button
              id="import-cancel-btn"
              onClick={handleCancelImport}
              className="rounded-md border border-line px-4 py-2 text-sm text-ink"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Nút Export */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          id="backup-export-btn"
          onClick={handleExport}
          disabled={exportStatus === 'loading'}
          title="Tải về file JSON chứa toàn bộ tiến độ hiện tại"
          className="flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm text-ink disabled:opacity-60"
        >
          {exportStatus === 'loading' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : exportStatus === 'ok' ? (
            <CheckCircle size={16} className="text-green-500" />
          ) : (
            <Download size={16} />
          )}
          Xuất dữ liệu (.json)
        </button>

        {/* Nút Import — trigger hidden file input */}
        <button
          id="backup-import-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={importStatus === 'loading' || showConfirm}
          title="Chọn file JSON để khôi phục tiến độ"
          className="flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm text-ink disabled:opacity-60"
        >
          {importStatus === 'loading' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : importStatus === 'ok' ? (
            <CheckCircle size={16} className="text-green-500" />
          ) : (
            <Upload size={16} />
          )}
          Khôi phục từ file…
        </button>

        {/* Input ẩn để chọn file */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFileChange}
          aria-hidden="true"
        />
      </div>

      {/* Thông báo kết quả import */}
      {importMsg && (
        <p
          className={`text-sm ${importStatus === 'error' ? 'text-red-500' : 'text-green-600'}`}
        >
          {importMsg}
        </p>
      )}

      <p className="text-xs text-ink-faint">
        File sao lưu chứa: lộ trình, tiến độ từng task, trạng thái tài nguyên (sách/phần mềm).
        Không chứa thông tin đăng nhập.
      </p>
    </div>
  );
}
