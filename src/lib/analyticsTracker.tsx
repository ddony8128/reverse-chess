import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    window.gtag("config", "G-T4GWKRT7N7", {
      page_path: location.pathname
    });
  }, [location]);

  return null;
}
