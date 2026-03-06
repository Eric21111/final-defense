/**
 * GCash Payment Settings — Admin Page
 *
 * Owner-only page for configuring GCash for Business / PayMongo credentials.
 *
 * Features:
 * - Input app_id, private_key, public_key
 * - Select sandbox/production environment
 * - Auto-generated webhook URL (read-only)
 * - Test connection button
 * - Credentials encrypted at rest (backend handles encryption)
 * - Private key never shown after save
 */

import { memo, useCallback, useEffect, useState } from "react";
import {
    FaCheckCircle,
    FaCog,
    FaEye,
    FaEyeSlash,
    FaKey,
    FaLink,
    FaShieldAlt,
    FaSpinner,
    FaTimesCircle,
    FaTrash,
} from "react-icons/fa";
import Header from "../../components/shared/header";
import { API_BASE_URL as API_BASE } from "../../config/api";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

const GCashSettings = () => {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const isDark = theme === "dark";

  // Form state
  const [appId, setAppId] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [environment, setEnvironment] = useState("sandbox");
  const [merchantName, setMerchantName] = useState("POS System");
  const [paymentExpiryMinutes, setPaymentExpiryMinutes] = useState(15);
  const [webhookUrl, setWebhookUrl] = useState("");

  // UI state
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [lastUpdated, setLastUpdated] = useState(null);

  // Load existing settings
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/merchant-settings`);
      const data = await response.json();

      if (data.success && data.data) {
        const settings = data.data;
        setAppId(settings.appId || "");
        setPublicKey(settings.publicKey || "");
        setEnvironment(settings.environment || "sandbox");
        setMerchantName(settings.merchantName || "POS System");
        setPaymentExpiryMinutes(settings.paymentExpiryMinutes || 15);
        setWebhookUrl(settings.webhookUrl || "");
        setIsConfigured(true);
        setLastUpdated(settings.updatedAt || settings.createdAt);
        // Private key is NEVER returned from backend
        setPrivateKey("");
      } else {
        setIsConfigured(false);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      setMessage({
        type: "error",
        text: "Failed to load settings. Is the backend running?",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Save settings
  const handleSave = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (!appId.trim() || !publicKey.trim()) {
      setMessage({
        type: "error",
        text: "App ID and Public Key are required.",
      });
      return;
    }

    if (!isConfigured && !privateKey.trim()) {
      setMessage({
        type: "error",
        text: "Private Key is required for initial setup.",
      });
      return;
    }

    if (isConfigured && !privateKey.trim()) {
      // Allow save without private key if updating other fields?
      // No — re-saving credentials requires providing the key again.
      setMessage({
        type: "error",
        text: "Please re-enter your Private Key to save changes.",
      });
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`${API_BASE}/api/merchant-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: appId.trim(),
          privateKey: privateKey.trim(),
          publicKey: publicKey.trim(),
          environment,
          merchantName: merchantName.trim(),
          paymentExpiryMinutes,
          configuredBy: currentUser?._id || currentUser?.id || "",
          configuredByName: currentUser?.name || "",
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: "success",
          text: "Payment gateway configured successfully!",
        });
        setPrivateKey(""); // Clear after save
        setIsConfigured(true);
        if (data.data?.webhookUrl) setWebhookUrl(data.data.webhookUrl);
        setLastUpdated(new Date().toISOString());
      } else {
        setMessage({
          type: "error",
          text: data.message || "Failed to save settings.",
        });
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  // Test connection
  const handleTestConnection = async () => {
    setMessage({ type: "", text: "" });

    if (!isConfigured) {
      setMessage({
        type: "error",
        text: "Please save your credentials first before testing.",
      });
      return;
    }

    try {
      setTesting(true);
      const response = await fetch(`${API_BASE}/api/merchant-settings/test`, {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: "success", text: `✅ ${data.message}` });
      } else {
        setMessage({
          type: "error",
          text: data.message || "Connection test failed.",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Unable to test connection." });
    } finally {
      setTesting(false);
    }
  };

  // Delete configuration
  const handleDelete = async () => {
    if (
      !window.confirm(
        "Are you sure you want to remove the payment gateway configuration? GCash payments will be disabled.",
      )
    ) {
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch(`${API_BASE}/api/merchant-settings`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: "success",
          text: "Configuration removed successfully.",
        });
        setAppId("");
        setPrivateKey("");
        setPublicKey("");
        setEnvironment("sandbox");
        setMerchantName("POS System");
        setWebhookUrl("");
        setIsConfigured(false);
        setLastUpdated(null);
      } else {
        setMessage({
          type: "error",
          text: data.message || "Failed to remove configuration.",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Network error." });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <FaSpinner className="w-8 h-8 text-[#8B7355] animate-spin" />
      </div>
    );
  }

  return (
    <div className="font-poppins">
      <Header pageName="GCash Payment Settings" showBorder={false} />

      <div className="max-w-2xl mx-auto mt-6">
        {/* Status Banner */}
        <div
          className={`rounded-xl p-4 mb-6 flex items-center gap-3 ${
            isConfigured
              ? isDark
                ? "bg-green-900/20 border border-green-800"
                : "bg-green-50 border border-green-200"
              : isDark
                ? "bg-yellow-900/20 border border-yellow-800"
                : "bg-yellow-50 border border-yellow-200"
          }`}
        >
          {isConfigured ? (
            <>
              <FaCheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p
                  className={`font-medium ${isDark ? "text-green-400" : "text-green-700"}`}
                >
                  GCash Payment Gateway Connected
                </p>
                <p
                  className={`text-xs ${isDark ? "text-green-500/70" : "text-green-600/70"}`}
                >
                  Environment: {environment.toUpperCase()}
                  {lastUpdated &&
                    ` • Updated: ${new Date(lastUpdated).toLocaleDateString()}`}
                </p>
              </div>
            </>
          ) : (
            <>
              <FaCog className="w-5 h-5 text-yellow-500 flex-shrink-0" />
              <div>
                <p
                  className={`font-medium ${isDark ? "text-yellow-400" : "text-yellow-700"}`}
                >
                  Payment Gateway Not Configured
                </p>
                <p
                  className={`text-xs ${isDark ? "text-yellow-500/70" : "text-yellow-600/70"}`}
                >
                  Enter your GCash for Business / PayMongo credentials below
                </p>
              </div>
            </>
          )}
        </div>

        {/* Security Notice */}
        <div
          className={`rounded-xl p-4 mb-6 flex items-start gap-3 ${isDark ? "bg-[#2A2724]" : "bg-gray-50"}`}
        >
          <FaShieldAlt
            className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDark ? "text-blue-400" : "text-blue-500"}`}
          />
          <div>
            <p
              className={`text-xs font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}
            >
              Security
            </p>
            <p
              className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}
            >
              Your private key is encrypted with AES-256-GCM before storage and
              is never exposed to the frontend after saving. All payment
              communications use HTTPS. Webhook signatures are verified using
              HMAC-SHA256.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave}>
          <div
            className={`rounded-xl border p-6 space-y-5 ${isDark ? "bg-[#1E1B18] border-gray-700" : "bg-white border-gray-200"}`}
          >
            {/* App ID */}
            <div>
              <label
                className={`block text-sm font-medium mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}
              >
                App ID / API Key ID
              </label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="pk_test_xxxxxxxxxxxx"
                className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B7355] ${
                  isDark
                    ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                required
              />
              <p
                className={`text-xs mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
              >
                Your PayMongo public API key
              </p>
            </div>

            {/* Private Key */}
            <div>
              <label
                className={`block text-sm font-medium mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}
              >
                <FaKey className="inline w-3 h-3 mr-1" />
                Secret Key (Private Key)
              </label>
              <div className="relative">
                <input
                  type={showPrivateKey ? "text" : "password"}
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder={
                    isConfigured
                      ? "••••••••••••••• (re-enter to update)"
                      : "sk_test_xxxxxxxxxxxx"
                  }
                  className={`w-full px-4 py-2.5 pr-10 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B7355] ${
                    isDark
                      ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                  required={!isConfigured}
                />
                <button
                  type="button"
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? "text-gray-400" : "text-gray-500"}`}
                >
                  {showPrivateKey ? (
                    <FaEyeSlash className="w-4 h-4" />
                  ) : (
                    <FaEye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p
                className={`text-xs mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
              >
                Your PayMongo secret key — encrypted before storage, never
                exposed after save
              </p>
            </div>

            {/* Public Key */}
            <div>
              <label
                className={`block text-sm font-medium mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}
              >
                Public Key
              </label>
              <input
                type="text"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder="pk_test_xxxxxxxxxxxx"
                className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B7355] ${
                  isDark
                    ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                required
              />
            </div>

            {/* Environment */}
            <div>
              <label
                className={`block text-sm font-medium mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}
              >
                Environment
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEnvironment("sandbox")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                    environment === "sandbox"
                      ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                      : isDark
                        ? "border-gray-600 bg-[#2A2724] text-gray-400 hover:border-gray-500"
                        : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  🧪 Sandbox
                </button>
                <button
                  type="button"
                  onClick={() => setEnvironment("production")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                    environment === "production"
                      ? "border-green-500 bg-green-50 text-green-700"
                      : isDark
                        ? "border-gray-600 bg-[#2A2724] text-gray-400 hover:border-gray-500"
                        : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  🚀 Production
                </button>
              </div>
            </div>

            {/* Merchant Name */}
            <div>
              <label
                className={`block text-sm font-medium mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}
              >
                Merchant Display Name
              </label>
              <input
                type="text"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder="Your Store Name"
                className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B7355] ${
                  isDark
                    ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              />
            </div>

            {/* Payment Expiry */}
            <div>
              <label
                className={`block text-sm font-medium mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}
              >
                Payment Expiry (minutes)
              </label>
              <input
                type="number"
                value={paymentExpiryMinutes}
                onChange={(e) =>
                  setPaymentExpiryMinutes(
                    Math.min(60, Math.max(5, parseInt(e.target.value) || 15)),
                  )
                }
                min="5"
                max="60"
                className={`w-24 px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B7355] ${
                  isDark
                    ? "bg-[#2A2724] border-gray-600 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              />
              <p
                className={`text-xs mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
              >
                QR codes expire after this many minutes (5–60)
              </p>
            </div>

            {/* Webhook URL (read-only) */}
            {webhookUrl && (
              <div>
                <label
                  className={`block text-sm font-medium mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}
                >
                  <FaLink className="inline w-3 h-3 mr-1" />
                  Webhook URL (auto-generated)
                </label>
                <div
                  className={`w-full px-4 py-2.5 border rounded-lg font-mono text-xs break-all ${
                    isDark
                      ? "bg-[#2A2724] border-gray-600 text-gray-400"
                      : "bg-gray-100 border-gray-200 text-gray-600"
                  }`}
                >
                  {webhookUrl}
                </div>
                <p
                  className={`text-xs mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
                >
                  Register this URL in your PayMongo dashboard under Webhooks →
                  Source Chargeable
                </p>
              </div>
            )}
          </div>

          {/* Message */}
          {message.text && (
            <div
              className={`mt-4 rounded-lg p-3 flex items-center gap-2 ${
                message.type === "success"
                  ? isDark
                    ? "bg-green-900/20 text-green-400"
                    : "bg-green-50 text-green-700"
                  : isDark
                    ? "bg-red-900/20 text-red-400"
                    : "bg-red-50 text-red-700"
              }`}
            >
              {message.type === "success" ? (
                <FaCheckCircle className="w-4 h-4 flex-shrink-0" />
              ) : (
                <FaTimesCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="text-sm">{message.text}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 px-6 rounded-lg font-semibold text-white bg-[#8B7355] hover:bg-[#6d5a43] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <FaSpinner className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : isConfigured ? (
                "Update Configuration"
              ) : (
                "Save Configuration"
              )}
            </button>

            {isConfigured && (
              <>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className={`py-3 px-6 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                    isDark
                      ? "bg-[#2A2724] text-gray-300 hover:bg-[#322f2c]"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  } disabled:opacity-50`}
                >
                  {testing ? (
                    <FaSpinner className="w-4 h-4 animate-spin" />
                  ) : (
                    "Test"
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="py-3 px-4 rounded-lg font-semibold text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                >
                  <FaTrash className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </form>

        {/* Setup Guide */}
        <div
          className={`mt-8 rounded-xl border p-6 ${isDark ? "bg-[#1E1B18] border-gray-700" : "bg-white border-gray-200"}`}
        >
          <h3
            className={`text-sm font-semibold mb-3 ${isDark ? "text-gray-200" : "text-gray-800"}`}
          >
            📋 Setup Guide
          </h3>
          <ol
            className={`text-xs space-y-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}
          >
            <li>
              <strong>1.</strong> Sign up for{" "}
              <a
                href="https://dashboard.paymongo.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 underline"
              >
                PayMongo
              </a>{" "}
              (GCash for Business payment processor)
            </li>
            <li>
              <strong>2.</strong> Get your API keys from the PayMongo Dashboard
              → Developers → API Keys
            </li>
            <li>
              <strong>3.</strong> Enter your Secret Key (sk_test_xxx) and Public
              Key (pk_test_xxx) above
            </li>
            <li>
              <strong>4.</strong> Start with <strong>Sandbox</strong>{" "}
              environment for testing
            </li>
            <li>
              <strong>5.</strong> Click &quot;Save Configuration&quot; then
              &quot;Test&quot; to verify
            </li>
            <li>
              <strong>6.</strong> Register the Webhook URL above in PayMongo
              Dashboard → Webhooks → Event: <code>source.chargeable</code>
            </li>
            <li>
              <strong>7.</strong> Set <code>PAYMONGO_WEBHOOK_SECRET</code> env
              var with the webhook signing key from PayMongo
            </li>
            <li>
              <strong>8.</strong> Switch to <strong>Production</strong> when
              ready to accept real payments
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default memo(GCashSettings);
