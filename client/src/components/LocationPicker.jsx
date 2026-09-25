import { useState } from "react";
import Icon from "./ui/Icon.jsx";
import { Spinner } from "./ui/index.jsx";

/**
 * "Use my location" pin-drop (spec §4.1 — no geocoding UI). Value is a
 * GeoJSON Point `{ type: "Point", coordinates: [lng, lat] }` or null.
 * Only the approximate area is ever shown publicly.
 */
const LocationPicker = ({ value, onChange, hint = "Used for distance search. Only the approximate area is shown publicly, never your address." }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const coords = value?.coordinates;

  const locate = () => {
    if (!navigator.geolocation) {
      setError("Your browser can't share a location.");
      return;
    }
    setBusy(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        onChange({ type: "Point", coordinates: [Number(pos.coords.longitude.toFixed(5)), Number(pos.coords.latitude.toFixed(5))] });
      },
      () => {
        setBusy(false);
        setError("Location permission was denied.");
      },
      { timeout: 10000 }
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {coords ? (
          <span className="flex items-center gap-2 rounded-[10px] bg-mist px-3.5 py-2.5 text-sm font-semibold text-primary">
            <Icon name="pin" size={16} />
            Location set ({coords[1].toFixed(2)}, {coords[0].toFixed(2)})
          </span>
        ) : (
          <span className="text-sm text-ink-2">No location set</span>
        )}
        <button type="button" className="btn btn-soft btn-sm" onClick={locate} disabled={busy}>
          {busy ? <Spinner /> : <Icon name="locate" size={16} />}
          {coords ? "Update to my current location" : "Use my current location"}
        </button>
        {coords && (
          <button type="button" className="border-0 bg-transparent text-[13px] font-semibold text-ink-2 hover:text-danger" onClick={() => onChange(null)}>
            Remove
          </button>
        )}
      </div>
      {error ? <span className="field-err">{error}</span> : <span className="field-hint">{hint}</span>}
    </div>
  );
};

export default LocationPicker;
