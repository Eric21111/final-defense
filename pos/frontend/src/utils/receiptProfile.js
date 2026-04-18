import { API_ENDPOINTS } from '../config/api';

export const RECEIPT_STORAGE_KEY = 'pos-receipt-profile';

export const DEFAULT_RECEIPT_PROFILE = {
  storeName: 'Create Your Style',
  receiptTagline: '',
  receiptAddress: 'Pasonanca, Zamboanga City',
  receiptContactNumber: '+631112224444',
  receiptThankYouMessage: 'Thank you for your purchase!',
  receiptDisclaimer: 'This is not an official receipt'
};

const clamp = (s, max) => String(s ?? '').slice(0, max);

export function mapGlobalSettingsToReceiptCache(data = {}) {
  return {
    storeName: clamp(data.storeName ?? DEFAULT_RECEIPT_PROFILE.storeName, 120).trim() || DEFAULT_RECEIPT_PROFILE.storeName,
    receiptTagline: clamp(data.receiptTagline ?? '', 200),
    receiptAddress:
      clamp(data.receiptAddress ?? DEFAULT_RECEIPT_PROFILE.receiptAddress, 200).trim() ||
      DEFAULT_RECEIPT_PROFILE.receiptAddress,
    receiptContactNumber:
      clamp(data.receiptContactNumber ?? DEFAULT_RECEIPT_PROFILE.receiptContactNumber, 60).trim() ||
      DEFAULT_RECEIPT_PROFILE.receiptContactNumber,
    receiptThankYouMessage:
      clamp(data.receiptThankYouMessage ?? DEFAULT_RECEIPT_PROFILE.receiptThankYouMessage, 300).trim() ||
      DEFAULT_RECEIPT_PROFILE.receiptThankYouMessage,
    receiptDisclaimer:
      clamp(data.receiptDisclaimer ?? DEFAULT_RECEIPT_PROFILE.receiptDisclaimer, 300).trim() ||
      DEFAULT_RECEIPT_PROFILE.receiptDisclaimer
  };
}

export function getReceiptProfile() {
  try {
    const raw = localStorage.getItem(RECEIPT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_RECEIPT_PROFILE, ...mapGlobalSettingsToReceiptCache(parsed) };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_RECEIPT_PROFILE };
}

export function setReceiptProfileCache(profile) {
  const normalized = mapGlobalSettingsToReceiptCache(profile);
  localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(normalized));
}

/** Header + footer strings for on-screen receipt modals (matches thermal content). */
export function getReceiptBranding() {
  const p = getReceiptProfile();
  return {
    storeName: p.storeName,
    receiptTagline: p.receiptTagline,
    location: p.receiptAddress,
    contactNumber: p.receiptContactNumber,
    thankYouMessage: p.receiptThankYouMessage,
    disclaimer: p.receiptDisclaimer
  };
}

export async function hydrateReceiptProfileFromServer() {
  const res = await fetch(API_ENDPOINTS.globalSettings, { cache: 'no-store' });
  const json = await res.json();
  if (json.success && json.data) {
    setReceiptProfileCache(mapGlobalSettingsToReceiptCache(json.data));
  }
}
