'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Bell, BellOff, Send, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

// VAPID public key từ env — an toàn để bundle xuống trình duyệt
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

type PushSupport =
  | 'checking'
  | 'unsupported'   // trình duyệt không hỗ trợ
  | 'denied'        // người dùng đã từ chối quyền
  | 'not_subscribed'
  | 'subscribed';

export function PushToggle() {
  // Kiểm tra đồng bộ (chạy 1 lần khi mount, không qua effect)
  const initialSupport = useMemo<PushSupport>(() => {
    if (typeof window === 'undefined') return 'checking';
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    if (!supported) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    return 'checking'; // vẫn cần check async subscription
  }, []);

  const [support, setSupport] = useState<PushSupport>(initialSupport);
  const [loading, setLoading] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Kiểm tra async: đã có subscription chưa?
  // Dùng getRegistration() thay vì serviceWorker.ready để không bị treo
  // khi chưa có service worker nào được đăng ký (lần đầu vào trang).
  useEffect(() => {
    if (support !== 'checking') return;
    navigator.serviceWorker.getRegistration('/sw.js')
      .then((reg) => {
        if (!reg) {
          setSupport('not_subscribed');
          return;
        }
        return reg.pushManager.getSubscription().then((sub) =>
          setSupport(sub ? 'subscribed' : 'not_subscribed')
        );
      })
      .catch(() => setSupport('not_subscribed'));
  }, [support]);

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) {
      setMessage('Thông báo đẩy chưa được thiết lập trên hệ thống. Vui lòng thử lại sau.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      // Đăng ký service worker nếu chưa có
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Xin quyền — chỉ gọi từ cú click của người dùng (đúng luật)
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setSupport(permission === 'denied' ? 'denied' : 'not_subscribed');
        setMessage('Bạn chưa cho phép thông báo.');
        setLoading(false);
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? 'Lỗi không xác định.');
      }

      setSupport('subscribed');
      setMessage('Đã bật thông báo thành công!');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể bật thông báo.');
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSupport('not_subscribed');
      setMessage('Đã tắt thông báo.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể tắt thông báo.');
    } finally {
      setLoading(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    setSendStatus('sending');
    setMessage('');
    try {
      const res = await fetch('/api/push/send-test', { method: 'POST' });
      const json = (await res.json()) as { ok?: boolean; error?: string; succeeded?: number; failed?: number };
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Lỗi gửi thử.');
      setSendStatus('ok');
      setMessage(`Đã gửi thử thành công (${json.succeeded ?? 1} thiết bị). Kiểm tra góc màn hình!`);
    } catch (err) {
      setSendStatus('error');
      setMessage(err instanceof Error ? err.message : 'Lỗi gửi thử.');
    } finally {
      setTimeout(() => setSendStatus('idle'), 3000);
    }
  }, []);

  // --- Render ---
  if (support === 'checking') {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <Loader2 size={16} className="animate-spin" />
        <span>Đang kiểm tra hỗ trợ thông báo…</span>
      </div>
    );
  }

  if (support === 'unsupported') {
    return (
      <div className="flex items-start gap-2 rounded-md border border-line bg-surface-raised p-3 text-sm text-ink-muted">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
        <span>
          Trình duyệt này chưa hỗ trợ Push Notification.{' '}
          <span className="text-ink-faint">(Dùng Chrome/Firefox desktop, hoặc PWA đã cài trên iOS 16.4+)</span>
        </span>
      </div>
    );
  }

  if (support === 'denied') {
    return (
      <div className="flex items-start gap-2 rounded-md border border-line bg-surface-raised p-3 text-sm text-ink-muted">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />
        <span>
          Bạn đã chặn thông báo từ trang này. Hãy vào cài đặt trình duyệt để mở lại quyền, sau đó tải lại trang.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {support === 'not_subscribed' ? (
          <button
            id="push-subscribe-btn"
            onClick={subscribe}
            disabled={loading}
            title="Bật thông báo để nhắc học hàng ngày"
            className="btn-primary disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Bell size={16} />
            )}
            Bật thông báo
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-md border border-line bg-surface-raised px-3 py-2 text-sm text-ink">
              <CheckCircle size={16} className="text-green-500" />
              <span>Thông báo đang bật</span>
            </div>
            <button
              id="push-send-test-btn"
              onClick={sendTest}
              disabled={sendStatus === 'sending'}
              title="Gửi một thông báo thử để kiểm tra"
              className="flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm text-ink disabled:opacity-60"
            >
              {sendStatus === 'sending' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Gửi thông báo thử
            </button>
            <button
              id="push-unsubscribe-btn"
              onClick={unsubscribe}
              disabled={loading}
              title="Tắt thông báo từ trang này"
              className="flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm text-ink-muted disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <BellOff size={16} />
              )}
              Tắt thông báo
            </button>
          </>
        )}
      </div>

      {message && (
        <p
          className={`text-sm ${
            sendStatus === 'error' || (support !== 'subscribed' && message.startsWith('Không'))
              ? 'text-red-500'
              : 'text-green-600'
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
