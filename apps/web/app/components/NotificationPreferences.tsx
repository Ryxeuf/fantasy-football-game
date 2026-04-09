"use client";

import { usePushNotifications } from "../hooks/usePushNotifications";
import { useNotificationPreferences } from "../hooks/useNotificationPreferences";

export default function NotificationPreferences() {
  const push = usePushNotifications();
  const { preferences, loading, saving, error, updatePreferences } =
    useNotificationPreferences();

  const handleTogglePush = async () => {
    if (push.subscribed) {
      await push.unsubscribe();
    } else {
      await push.subscribe();
    }
  };

  const handleTogglePreference = async (
    key: "pushEnabled" | "turnNotification" | "matchFoundNotification",
  ) => {
    await updatePreferences({ [key]: !preferences[key] });
  };

  if (!push.supported) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold mb-4">Notifications</h3>
        <p className="text-sm text-gray-500">
          Les notifications push ne sont pas supportees par votre navigateur.
        </p>
      </div>
    );
  }

  const permissionDenied = push.permission === "denied";

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-xl font-bold mb-4">Notifications</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {permissionDenied && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-yellow-800 text-sm">
            Les notifications sont bloquees par votre navigateur. Modifiez les
            permissions du site dans les parametres de votre navigateur pour les
            reactiver.
          </p>
        </div>
      )}

      {/* Master push toggle */}
      <div className="space-y-4">
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="font-medium">Notifications push</div>
            <div className="text-sm text-gray-500">
              Recevoir des notifications sur cet appareil
            </div>
          </div>
          <button
            onClick={handleTogglePush}
            disabled={push.loading || permissionDenied}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-nuffle-bronze focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              push.subscribed ? "bg-nuffle-bronze" : "bg-gray-300"
            }`}
            role="switch"
            aria-checked={push.subscribed}
            aria-label="Activer les notifications push"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                push.subscribed ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Per-type preferences — only shown when push is active */}
        {push.subscribed && (
          <>
            <hr className="border-gray-200" />
            <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">
              Types de notifications
            </div>

            {/* Master server-side toggle */}
            <ToggleRow
              label="Activer toutes les notifications"
              description="Toggle principal cote serveur"
              checked={preferences.pushEnabled}
              disabled={saving || loading}
              onChange={() => handleTogglePreference("pushEnabled")}
            />

            {/* Turn notification */}
            <ToggleRow
              label={`"C'est votre tour"`}
              description="Notification lorsque c'est a vous de jouer"
              checked={preferences.pushEnabled && preferences.turnNotification}
              disabled={saving || loading || !preferences.pushEnabled}
              onChange={() => handleTogglePreference("turnNotification")}
            />

            {/* Match found notification */}
            <ToggleRow
              label={`"Match trouve"`}
              description="Notification lorsqu'un adversaire est trouve"
              checked={
                preferences.pushEnabled && preferences.matchFoundNotification
              }
              disabled={saving || loading || !preferences.pushEnabled}
              onChange={() => handleTogglePreference("matchFoundNotification")}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle row sub-component
// ---------------------------------------------------------------------------

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <button
        onClick={onChange}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-nuffle-bronze focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
          checked ? "bg-nuffle-bronze" : "bg-gray-300"
        }`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
